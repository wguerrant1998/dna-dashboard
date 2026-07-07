export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY;
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90";
  const RVMODES = ["bike", "car", "horse"];
  const STATS_CHUNK_SIZE = 50; // untested upper bound - lower this if the API rejects large batches
  const MAX_RACE_RESULT_PAGES = 200; // safety cap so a bug in pagination can't loop forever

  // Race-type keys as they appear in the API's `payouts_data` object,
  // mapped to the labels used in the dashboard's race-type buttons.
  const RACE_TYPE_MAP = {
    wta: "WTA",
    "1v1": "1v1",
    top2: "Top 2",
    top3: "Top 3",
    dblup: "Double Up",
    spin_n_go: "Spin & Go",
  };

  // Maps the vault endpoint's raw `type` field to the display class names
  // your dashboard already uses.
  const CLASS_NAME_MAP = {
    genesis: "Genesis",
    freak: "Freak",
    morphed: "Morph",
    xclass: "X-Class",
  };

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // Runs async tasks with a max concurrency limit, since powcard only accepts one hid per call.
  async function runWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let index = 0;
    async function next() {
      while (index < items.length) {
        const current = index++;
        results[current] = await worker(items[current]);
      }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, next);
    await Promise.all(workers);
    return results;
  }

  function titleCase(str) {
    if (!str) return null;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    };
  }

  try {
    // 1. Fetch the real cores in this vault: hid, name, element, type (class), etc.
    const vaultRes = await fetch("https://api.dnaracing.run/fbike/vault/bikes_inf", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ vault: VAULT_ADDRESS }),
    });

    if (!vaultRes.ok) {
      return res.status(502).json({ error: `Vault fetch failed with status ${vaultRes.status}` });
    }

    const vaultData = await vaultRes.json();

    if (!vaultData || vaultData.status !== "success" || !Array.isArray(vaultData.result)) {
      return res.status(200).json([]);
    }

    const cores = vaultData.result;
    const hids = cores.map((c) => Number(c.hid)).filter((n) => !isNaN(n));

    // 2. Fetch real career stats per vehicle mode (bike / car / horse), in batches.
    const statsByMode = { bike: {}, car: {}, horse: {} };

    for (const mode of RVMODES) {
      const batches = chunk(hids, STATS_CHUNK_SIZE);

      for (const batch of batches) {
        const statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ hids: batch, rvmode: mode }),
        });

        if (!statsRes.ok) continue; // skip this batch rather than fail the whole request

        const statsData = await statsRes.json();
        if (!statsData || statsData.status !== "success" || !Array.isArray(statsData.result)) continue;

        for (const doc of statsData.result) {
          const career = doc?.data?.career;
          if (!career) continue;

          const raceTypes = {};
          const payoutsData = doc?.payouts_data || {};
          for (const rtKey of Object.keys(RACE_TYPE_MAP)) {
            const rtCareer = payoutsData?.[rtKey]?.career;
            if (!rtCareer) continue;
            raceTypes[rtKey] = {
              label: RACE_TYPE_MAP[rtKey],
              r: rtCareer.races_n ?? 0,
              w: rtCareer.win_p != null ? Number((rtCareer.win_p * 100).toFixed(2)) : 0,
              b: rtCareer.bluestar_p != null ? Number((rtCareer.bluestar_p * 100).toFixed(2)) : 0,
              y: rtCareer.yellowstar_p != null ? Number((rtCareer.yellowstar_p * 100).toFixed(2)) : 0,
            };
          }

          // Per-distance breakdown: doc.data has keys "9" through "23", each meaning
          // that key * 100 meters (e.g. "9" = 900m, "23" = 2300m).
          const distances = {};
          for (const [key, bucket] of Object.entries(doc?.data || {})) {
            if (key === "career") continue;
            const distanceMeters = Number(key) * 100;
            if (isNaN(distanceMeters) || !bucket) continue;
            distances[distanceMeters] = {
              r: bucket.races_n ?? 0,
              w: bucket.win_p != null ? Number((bucket.win_p * 100).toFixed(2)) : 0,
              b: bucket.bluestar_p != null ? Number((bucket.bluestar_p * 100).toFixed(2)) : 0,
              y: bucket.yellowstar_p != null ? Number((bucket.yellowstar_p * 100).toFixed(2)) : 0,
            };
          }

          statsByMode[mode][doc.hid] = {
            r: career.races_n ?? 0,
            w: career.win_p != null ? Number((career.win_p * 100).toFixed(2)) : 0,
            b: career.bluestar_p != null ? Number((career.bluestar_p * 100).toFixed(2)) : 0,
            y: career.yellowstar_p != null ? Number((career.yellowstar_p * 100).toFixed(2)) : 0,
            raceTypes,
            distances,
          };
        }
      }
    }

    // 3. Fetch full race-by-race history for the vault (paginated) and build a compact
    //    raw race list per core+mode. Each entry carries distance (cb*100), field size
    //    (rgate, bucketed), and race type (raw format/payout values) TOGETHER, so the
    //    dashboard can filter by any combination of these and compute real intersected
    //    stats - rather than three separate pre-aggregated slices that can't combine.
    //    rawRacesByMode[mode][hid] = [{ distance, fieldSizeBucket, format, payout, win }]
    const rawRacesByMode = { bike: {}, car: {}, horse: {} };
    const FIELD_SIZE_BUCKETS = ["2", "3", "4", "5", "6", "7+"];

    function fieldSizeBucket(rgate) {
      const n = Number(rgate);
      if (isNaN(n) || n < 2) return null;
      return n >= 7 ? "7+" : String(n);
    }

    let raceResultsFetched = 0;

    for (let page = 0; page < MAX_RACE_RESULT_PAGES; page++) {
      const raceRes = await fetch("https://api.dnaracing.run/fbike/vault/raceresults", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ vault: VAULT_ADDRESS, page }),
      });

      if (!raceRes.ok) {
        console.error(`raceresults fetch failed on page ${page}: status ${raceRes.status}`);
        break;
      }

      const raceData = await raceRes.json();
      const races = raceData?.result?.races;

      if (!Array.isArray(races) || races.length === 0) break; // no more pages

      for (const rec of races) {
        raceResultsFetched++;
        const mode = rec?.rvmode;
        const hid = rec?.hid;
        const bucket = fieldSizeBucket(rec?.rgate);
        const distance = rec?.cb != null && !isNaN(Number(rec.cb)) ? Number(rec.cb) * 100 : null;
        if (!mode || !rawRacesByMode[mode] || hid == null) continue;

        if (!rawRacesByMode[mode][hid]) rawRacesByMode[mode][hid] = [];
        rawRacesByMode[mode][hid].push({
          distance,
          fieldSizeBucket: bucket,
          format: rec?.format ?? null,
          payout: rec?.payout ?? null,
          win: rec.pos === 1, // assumes pos 1 = win
        });
      }

      if (races.length < 1) break; // extra guard in case page size is 1
    }

    console.log(`raceresults: fetched ${raceResultsFetched} individual race records for vault ${VAULT_ADDRESS}`);

    // 4. Fetch Power/Variance/Adj. Odds ("powcard") per core. This endpoint only accepts
    //    one hid per call, so we run these with limited concurrency rather than one at a time.
    //    powCardByHid[hid][mode] = { power, variance, adjodds }
    const POWCARD_CONCURRENCY = 10; // untested - lower this if the API starts rejecting/rate-limiting
    const powCardByHid = {};

    await runWithConcurrency(hids, POWCARD_CONCURRENCY, async (hid) => {
      try {
        const powRes = await fetch("https://api.dnaracing.run/fbike/i/powcard", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ hid }),
        });

        if (!powRes.ok) return;

        const powData = await powRes.json();
        const powerByMode = powData?.result?.power;
        if (!powerByMode) return;

        powCardByHid[hid] = {};
        for (const mode of RVMODES) {
          const m = powerByMode[mode];
          if (!m) continue;
          powCardByHid[hid][mode] = {
            power: m?.power?.fill?.per ?? null,
            variance: m?.variance?.fill?.per ?? null,
            adjodds: m?.adjodds?.fill?.per ?? null,
          };
        }
      } catch (err) {
        console.error(`powcard fetch failed for hid ${hid}:`, err);
      }
    });

    // 5. Join vault metadata with real per-mode stats. No random/simulated values anywhere.
    const structuredCores = cores.map((c) => {
      const hid = Number(c.hid);
      const className = CLASS_NAME_MAP[c.type] || c.type || null;
      const element = titleCase(c.element);

      const modes = {};
      for (const mode of RVMODES) {
        const real = statsByMode[mode][hid];

        modes[mode] = {
          class: className,
          element,
          r: real?.r ?? 0,
          w: real?.w ?? 0,
          b: real?.b ?? 0,
          y: real?.y ?? 0,
          // Per-race-type career breakdown (WTA, 1v1, Top 2, Double Up, Spin & Go, etc.),
          // keyed by the raw API key so the dashboard can look up whichever type is selected.
          raceTypes: real?.raceTypes ?? {},
          // Per-distance breakdown, keyed by distance in meters (900, 1000, ... 2300).
          distances: real?.distances ?? {},
          // Raw individual race list - each entry has distance, field size bucket, and
          // race type together, so the dashboard can compute stats for ANY combination
          // of these filters selected at once, not just one at a time.
          races: rawRacesByMode[mode][hid] ?? [],
          // Power / Variance / Adj. Odds ratings from the powcard endpoint (0-100 scale).
          // null if this core has no powcard data for this mode.
          power: powCardByHid[hid]?.[mode]?.power ?? null,
          variance: powCardByHid[hid]?.[mode]?.variance ?? null,
          adjodds: powCardByHid[hid]?.[mode]?.adjodds ?? null,
        };
      }

      return {
        hid,
        name: c.name || `Core #${hid}`,
        modes,
      };
    });

    return res.status(200).json(structuredCores);
  } catch (error) {
    console.error("cores.js error:", error);
    return res.status(500).json({ error: "Failed to fetch core data" });
  }
}
