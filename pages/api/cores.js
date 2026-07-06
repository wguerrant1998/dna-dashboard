export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90

"; // <-- Make sure your address stays here!

  console.log("Starting API Fetch for Vault:", VAULT_ADDRESS);

  try {
    // 1. Get Core IDs
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success") {
      console.error("Vault Error Details:", vaultData.err);
      return res.status(200).json([]);
    }

    const hids = vaultData.result;
    console.log("Found Core IDs:", hids ? hids.length : 0, "cores found.");

    if (!hids || hids.length === 0) return res.status(200).json([]);
    const targetedHids = hids.slice(0, 20);

    // 2. Fetch Core Identity Info
    const infoRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
      method: 'POST',
      headers: { 
        "Authorization": `Bearer ${API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ hids: targetedHids }) 
    });
    const infoData = await infoRes.json();
    console.log("Identity Bulk Status:", infoData.status, "Count:", infoData.result ? infoData.result.length : 0);

    // 3. Fetch Racing Stats
    const statsRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/racing_stats_bulk`, {
      method: 'POST',
      headers: { 
        "Authorization": `Bearer ${API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ hids: targetedHids })
    });
    const statsData = await statsRes.json();
    console.log("Racing Stats Bulk Status:", statsData.status, "Count:", statsData.result ? statsData.result.length : 0);

    // 4. Merge Data
    const coreIdentities = infoData.result || [];
    const coreStats = statsData.result || [];

    const combinedData = targetedHids.map(id => {
      const identity = coreIdentities.find(i => i.hid === id) || {};
      const performance = coreStats.find(s => s.hid === id) || {};
      const bikeStats = performance.hstats_bike?.career || {};

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        type: identity.type || 'N/A',
        element: identity.element || 'N/A',
        threeGateWins: bikeStats.gates_3_wins || 0,
        threeGateRaces: bikeStats.gates_3_races || 0,
        bestDistance: bikeStats.best_distance_text || 'N/A',
        totalProfit: performance.tourney_profits || 0
      };
    });

    return res.status(200).json(combinedData);

  } catch (error) {
    console.error("System Fetch Crash:", error.message);
    return res.status(200).json([]);
  }
}
