export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    // 1. Fetch all Core IDs from the Vault
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success" || !vaultData.result) return res.status(200).json([]);

    const hids = vaultData.result || [];
    if (hids.length === 0) return res.status(200).json([]);

    // 2. Helper function to split your 176 cores into clean batches of 20
    const batchSize = 20;
    let coreIdentities = [];
    let coreStats = [];

    for (let i = 0; i < hids.length; i += batchSize) {
      const batch = hids.slice(i, i + batchSize);

      // Fire both bulk requests for the current batch in parallel
      const [infoRes, statsRes] = await Promise.all([
        fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
          method: 'POST',
          headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ hids: batch }) 
        }).then(r => r.json()).catch(() => ({ result: [] })),
        
        fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/racing_stats_bulk`, {
          method: 'POST',
          headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ hids: batch })
        }).then(r => r.json()).catch(() => ({ result: [] }))
      ]);

      if (infoRes.result) coreIdentities = coreIdentities.concat(infoRes.result);
      if (statsRes.result) coreStats = coreStats.concat(statsRes.result);
    }

    // 3. Merge every single batch together safely
    const combinedData = hids.map(id => {
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id)) || {};
      const performance = coreStats.find(s => s && (s.hid === id || s.id === id)) || {};
      
      // Checking alternative property paths to guarantee stats capture
      const career = performance.hstats_bike?.career || performance.stats?.career || performance.career || {};

      const total = career.total_races || performance.total_races || performance.races || 0;
      const wins = career.wins || performance.wins || 0;
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        type: identity.type || 'bike', 
        bestDistance: career.best_distance_text || 'Medium',
        totalRaces: total,
        winRate: winRate,
        blueStar: career.blue_star_pct || performance.blue_star_pct || 0,
        yellowStar: career.yellow_star_pct || performance.yellow_star_pct || 0,
        wethProfit: performance.weth_profit || performance.weth || 0,
        dezProfit: performance.dez_profit || performance.dez || 0
      };
    });

    return res.status(200).json(combinedData);

  } catch (error) {
    console.error("Batch processing broke down:", error.message);
    return res.status(200).json([]);
  }
}
