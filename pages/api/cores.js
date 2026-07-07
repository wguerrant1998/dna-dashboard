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

          statsByMode[mode][doc.hid] = {
            r: career.races_n ?? 0,
            w: career.win_p != null ? Number((career.win_p * 100).toFixed(2)) : 0,
            b: career.bluestar_p != null ? Number((career.bluestar_p * 100).toFixed(2)) : 0,
            y: career.yellowstar_p != null ? Number((career.yellowstar_p * 100).toFixed(2)) : 0,
            raceTypes,
          };
        }
      }
    }

    // 3. Fetch full race-by-race history for the vault (paginated) and bucket each
    //    core's results by field size (rgate = total competitors in that race).
    //    fieldSizeByMode[mode][hid][rgate] = { races_n, win_n }
    const fieldSizeByMode = { bike: {}, car: {}, horse: {} };

    for (let page = 0; page < MAX_RACE_RESULT_PAGES; page++) {
      const raceRes = await fetch("https://api.dnaracing.run/fbike/vault/raceresults", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ vault: VAULT_ADDRESS, page }),
      });

      if (!raceRes.ok) break;

      const raceData = await raceRes.json();
      const races = raceData?.result;

      if (!Array.isArray(races) || races.length === 0) break; // no more pages

      for (const rec of races) {
        const mode = rec?.rvmode;
        const hid = rec?.hid;
        const rgate = rec?.rgate;
        if (!mode || !fieldSizeByMode[mode] || hid == null || rgate == null) continue;

        if (!fieldSizeByMode[mode][hid]) fieldSizeByMode[mode][hid] = {};
        if (!fieldSizeByMode[mode][hid][rgate]) fieldSizeByMode[mode][hid][rgate] = { races_n: 0, win_n: 0 };

        fieldSizeByMode[mode][hid][rgate].races_n += 1;
        if (rec.pos === 1) fieldSizeByMode[mode][hid][rgate].win_n += 1; // assumes pos 1 = win
      }

      if (races.length < 1) break; // extra guard in case page size is 1
    }

    // 4. Join vault metadata with real per-mode stats. No random/simulated values anywhere.
    const structuredCores = cores.map((c) => {
      const hid = Number(c.hid);
      const className = CLASS_NAME_MAP[c.type] || c.type || null;
      const element = titleCase(c.element);

      const modes = {};
      for (const mode of RVMODES) {
        const real = statsByMode[mode][hid];

        // Convert { races_n, win_n } buckets per rgate into { races_n, win_n, win_p } for the frontend
        const rawFieldSize = fieldSizeByMode[mode][hid] || {};
        const fieldSize = {};
        for (const [rgate, bucket] of Object.entries(rawFieldSize)) {
          fieldSize[rgate] = {
            r: bucket.races_n,
            w: bucket.races_n > 0 ? Number(((bucket.win_n / bucket.races_n) * 100).toFixed(2)) : 0,
          };
        }

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
          // Per-field-size breakdown, keyed by rgate (e.g. "3", "4", "5" competitors).
          // Built from actual individual race results, not estimated.
          fieldSize,
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
