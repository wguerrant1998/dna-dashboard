export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    // 1. Get Core IDs first
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success" || !vaultData.result) {
      return res.status(200).json([]);
    }

    const hids = vaultData.result;
    if (hids.length === 0) return res.status(200).json([]);
    
    // Take the top 20 cores to keep things fast
    const targetedHids = hids.slice(0, 20);

    // 2. Fire BOTH secondary requests simultaneously in parallel to beat the timeout
    const [infoRes, statsRes] = await Promise.all([
      fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hids: targetedHids }) 
      }).then(r => r.json()).catch(() => ({ result: [] })), // fail gracefully
      
      fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/racing_stats_bulk`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hids: targetedHids })
      }).then(r => r.json()).catch(() => ({ result: [] })) // fail gracefully
    ]);

    const coreIdentities = infoRes.result || [];
    const coreStats = statsRes.result || [];

    // 3. Merge Data with fallbacks
    const combinedData = targetedHids.map(id => {
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id)) || {};
      const performance = coreStats.find(s => s && (s.hid === id || s.id === id)) || {};
      const bikeStats = performance.hstats_bike?.career || performance.stats?.career || {};

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        element: identity.element || 'Unknown',
        threeGateWins: bikeStats.gates_3_wins || performance.gates_3_wins || 0,
        threeGateRaces: bikeStats.gates_3_races || performance.gates_3_races || 0,
        bestDistance: bikeStats.best_distance_text || 'N/A',
        totalProfit: performance.tourney_profits || performance.profit || 0
      };
    });

    return res.status(200).json(combinedData);

  } catch (error) {
    console.error("Parallel Fetch Failed:", error.message);
    return res.status(200).json([]);
  }
}
