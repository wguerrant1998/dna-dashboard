export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "YOUR_ACTUAL_VAULT_ADDRESS_OR_EMAIL_HERE"; // <-- Make sure your address stays here!

  try {
    // 1. Get Core IDs
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success") return res.status(500).json({ error: vaultData.err });
    const hids = vaultData.result.slice(0, 20); // Pulling top 20 cores for safety

    // 2. Fetch Core Identity Info
    const infoRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hids }) 
    });
    const infoData = await infoRes.json();
    const coreIdentities = infoData.result || [];

    // 3. Fetch Racing Stats (Wins, career performance, etc.)
    const statsRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/racing_stats_bulk`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ hids })
    });
    const statsData = await statsRes.json();
    const coreStats = statsData.result || [];

    // 4. Merge Identity and Racing Stats together by Core ID (hid)
    const combinedData = coreIdentities.map(identity => {
      // Find the performance stats for this specific core
      const performance = coreStats.find(s => s.hid === identity.hid) || {};
      
      // Look inside 'hstats_bike' for career stats if they exist, otherwise default to 0
      const bikeStats = performance.hstats_bike?.career || {};

      return {
        hid: identity.hid,
        name: identity.name || 'Unnamed',
        type: identity.type,
        element: identity.element,
        // Grabbing data from the API structure
        threeGateWins: bikeStats.gates_3_wins || 0,
        threeGateRaces: bikeStats.gates_3_races || 0,
        bestDistance: bikeStats.best_distance_text || 'N/A',
        totalProfit: performance.tourney_profits || 0
      };
    });

    res.status(200).json(combinedData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch aggregated data" });
  }
}
