import { put } from "@vercel/blob";

// Allows this job to run up to 300 seconds (Pro plan limit) instead of the default timeout.
export const config = {
  maxDuration: 300,
};

const CACHE_KEY = "cores-cache.json";

export default async function handler(req, res) {
  // Optional protection so random visitors can't trigger this expensive job by hitting the URL.
  // Set a CRON_SECRET env var in Vercel to enable this check; if unset, the check is skipped.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const API_KEY = process.env.DNA_API_KEY;
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90";
  const RVMODES = ["bike", "car", "horse"];
  const STATS_CHUNK_SIZE = 50; // untested upper bound - lower this if the API rejects large batches
  const MAX_RACE_RESULT_PAGES = 2000; // raised from 200 - was truncating multi-year history

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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
        let statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ hids: batch, rvmode: mode }),
        });

        // Retry once on rate limit before giving up on this batch
        if (statsRes.status === 429) {
          console.warn(`hstats_doc_bulk rate limited (mode ${mode}), retrying once after backoff`);
          await sleep(800);
          statsRes = await fetch("https://api.dnaracing.run/fbike/cores/hstats_doc_bulk", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ hids: batch, rvmode: mode }),
          });
        }

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

        await sleep(120); // small pacing delay between batches
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
    let pagesFetched = 0;
    let hitPageCap = true;
    const RACERESULTS_MAX_RETRIES = 4;
    const RACERESULTS_RETRY_BASE_DELAY_MS = 800;
    const RACERESULTS_PAGE_PAUSE_MS = 150; // small pacing delay between pages to avoid tripping rate limits

    for (let page = 0; page < MAX_RACE_RESULT_PAGES; page++) {
      let races = null;
      let gaveUpOnPage = false;

      for (let attempt = 0; attempt <= RACERESULTS_MAX_RETRIES; attempt++) {
        const raceRes = await fetch("https://api.dnaracing.run/fbike/vault/raceresults", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ vault: VAULT_ADDRESS, page }),
        });

        if (raceRes.ok) {
          const raceData = await raceRes.json();
          races = raceData?.result?.races;
          break;
        }

        // Rate limited or transient error - back off and retry this same page rather than
        // abandoning all remaining pagination (a single 429 used to wipe out everything).
        if (attempt < RACERESULTS_MAX_RETRIES) {
          const delay = RACERESULTS_RETRY_BASE_DELAY_MS * Math.pow(2, attempt); // exponential backoff
          console.warn(`raceresults page ${page} got status ${raceRes.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${RACERESULTS_MAX_RETRIES})`);
          await sleep(delay);
        } else {
          console.error(`raceresults page ${page} failed permanently after ${RACERESULTS_MAX_RETRIES + 1} attempts: status ${raceRes.status}`);
          gaveUpOnPage = true;
        }
      }

      if (gaveUpOnPage) {
        // Stop pagination here, but keep everything collected from earlier pages.
        hitPageCap = false;
        break;
      }

      pagesFetched++;

      if (!Array.isArray(races) || races.length === 0) {
        hitPageCap = false;
        break; // no more pages - reached the natural end of history
      }

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

      await sleep(RACERESULTS_PAGE_PAUSE_MS); // pace requests instead of bursting
    }

    console.log(
      `raceresults: fetched ${raceResultsFetched} individual race records across ${pagesFetched} pages for vault ${VAULT_ADDRESS}` +
      (hitPageCap ? ` — WARNING: hit MAX_RACE_RESULT_PAGES cap (${MAX_RACE_RESULT_PAGES}), history may still be truncated. Raise the cap further.` : ` (stopped: natural end of history or persistent errors after retries)`)
    );

    // 4. Fetch Power/Variance/Adj. Odds ("powcard") per core. This endpoint only accepts
    //    one hid per call, so we run these with limited concurrency rather than one at a time.
    //    Retries on failure since intermittent/rate-limited failures were causing ~half of
    //    cores to come back with no PWR/VAR/ADJ data.
    //    powCardByHid[hid][mode] = { power, variance, adjodds }
    const POWCARD_CONCURRENCY = 4; // lowered further after confirming real rate limiting (429s)
    const POWCARD_MAX_RETRIES = 4;
    const POWCARD_RETRY_BASE_DELAY_MS = 600;
    const powCardByHid = {};
    let powcardSucceeded = 0;
    let powcardFailed = 0;
    const powcardFailureStatusCounts = {};

    await runWithConcurrency(hids, POWCARD_CONCURRENCY, async (hid) => {
      for (let attempt = 0; attempt <= POWCARD_MAX_RETRIES; attempt++) {
        try {
          const powRes = await fetch("https://api.dnaracing.run/fbike/i/powcard", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ hid }),
          });

          if (!powRes.ok) {
            const statusKey = String(powRes.status);
            powcardFailureStatusCounts[statusKey] = (powcardFailureStatusCounts[statusKey] || 0) + 1;
            if (attempt < POWCARD_MAX_RETRIES) {
              await sleep(POWCARD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)); // exponential backoff
              continue;
            }
            powcardFailed++;
            return;
          }

          const powData = await powRes.json();
          const powerByMode = powData?.result?.power;
          if (!powerByMode) {
            powcardFailed++;
            return;
          }

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
          powcardSucceeded++;
          return;
        } catch (err) {
          if (attempt < POWCARD_MAX_RETRIES) {
            await sleep(POWCARD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
            continue;
          }
          console.error(`powcard fetch failed for hid ${hid} after ${POWCARD_MAX_RETRIES + 1} attempts:`, err);
          powcardFailed++;
          return;
        }
      }
    });

    console.log(
      `powcard: ${powcardSucceeded} succeeded, ${powcardFailed} failed (out of ${hids.length}).` +
      (powcardFailed > 0 ? ` Failure status codes: ${JSON.stringify(powcardFailureStatusCounts)}` : "")
    );

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

    const updatedAt = new Date().toISOString();
    const payload = { updatedAt, cores: structuredCores };

    await put(CACHE_KEY, JSON.stringify(payload), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    console.log(`refresh-cores: saved ${structuredCores.length} cores to cache at ${updatedAt}`);

    return res.status(200).json({ status: "ok", updatedAt, coreCount: structuredCores.length });
  } catch (error) {
    console.error("refresh-cores.js error:", error);
    return res.status(500).json({ error: "Failed to refresh core data" });
  }
}
