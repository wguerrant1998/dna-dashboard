export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90

"; // Kept locked from your logs

  try {
    // 1. Get Core IDs
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success") return res.status(200).json([]);

    const hids = vaultData.result || [];
    if (hids.length === 0) return res.status(200).json([]);
    
    // Take the top 20 cores to populate the dashboard safely
    const targetedHids = hids.slice(0, 20);

    // 2. Fetch Core Identity Info
    const infoRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hids: targetedHids }) 
    });
    const infoData = await infoRes.json();
    const coreIdentities = infoData.result || [];

    // 3. Fetch Racing Stats
    const statsRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/racing_stats_bulk`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hids: targetedHids })
    });
    const statsData = await statsRes.json();
    const coreStats = statsData.result || [];

    // DEBUG LOGGING - Let's print out exactly what the API returned to the Vercel logs
    console.log("SAMPLE IDENTITY OBJECT:", JSON.stringify(coreIdentities[0] || "EMPTY"));
    console.log("SAMPLE STATS OBJECT:", JSON.stringify(coreStats[0] || "EMPTY"));

    // 4. Merge Data (With absolute fallback guarantees)
    const combinedData = targetedHids.map(id => {
      // Find matches safely by matching either raw ID or property
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id)) || {};
      const performance = coreStats.find(s => s && (s.hid === id || s.id === id)) || {};
      
      // Navigate nested objects carefully
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
    console.error("System Fetch Crash:", error.message);
    return res.status(200).json([]);
  }
}
