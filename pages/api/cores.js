export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY;
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90";
  const RVMODES = ["bike", "car", "horse"];
  const STATS_CHUNK_SIZE = 50; // untested upper bound - lower this if the API rejects large batches

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

          statsByMode[mode][doc.hid] = {
            r: career.races_n ?? 0,
            w: career.win_p != null ? Number((career.win_p * 100).toFixed(2)) : 0,
            b: career.bluestar_p != null ? Number((career.bluestar_p * 100).toFixed(2)) : 0,
            y: career.yellowstar_p != null ? Number((career.yellowstar_p * 100).toFixed(2)) : 0,
          };
        }
      }
    }

    // 3. Join vault metadata with real per-mode stats. No random/simulated values anywhere.
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
