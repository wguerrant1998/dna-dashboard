export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success" || !vaultData.result) return res.status(200).json([]);

    const hids = vaultData.result || [];
    if (hids.length === 0) return res.status(200).json([]);

    const batchSize = 20;
    let coreIdentities = [];
    let coreStats = [];

    for (let i = 0; i < hids.length; i += batchSize) {
      const batch = hids.slice(i, i + batchSize);
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

    const combinedData = hids.map(id => {
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id)) || {};
      const performance = coreStats.find(s => s && (s.hid === id || s.id === id)) || {};

      // DEEP RECURSIVE SCANNER: Look through every property in the stats payload to grab performance keys
      let total = 0, wins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0, bestDist = '1000';

      const deepSearch = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Match base tokens or profit declarations
        if (obj.weth_profit !== undefined) wethProfit = obj.weth_profit;
        if (obj.dez_profit !== undefined) dezProfit = obj.dez_profit;
        if (obj.tourney_profits !== undefined && wethProfit === 0) wethProfit = obj.tourney_profits;

        // Match common racing counters
        if (obj.total_races !== undefined) total = obj.total_races;
        if (obj.races !== undefined && total === 0) total = obj.races;
        if (obj.wins !== undefined) wins = obj.wins;

        // Look for stars percentages
        if (obj.blue_star_pct !== undefined) blueStar = obj.blue_star_pct;
        if (obj.yellow_star_pct !== undefined) yellowStar = obj.yellow_star_pct;

        // Pull explicit numerical metrics if available
        if (obj.best_distance !== undefined) bestDist = String(obj.best_distance);
        if (obj.best_distance_text !== undefined && isNaN(Number(obj.best_distance_text)) === false) bestDist = String(obj.best_distance_text);

        for (const key in obj) {
          if (obj.hasOwnProperty(key)) deepSearch(obj[key]);
        }
      };

      deepSearch(performance);

      // Handle win calculation safely
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        type: identity.type || 'bike', 
        bestDistance: bestDist,
        totalRaces: total,
        winRate: winRate,
        blueStar: Number(blueStar).toFixed(1),
        yellowStar: Number(yellowStar).toFixed(1),
        wethProfit: wethProfit,
        dezProfit: dezProfit
      };
    });

    return res.status(200).json(combinedData);

  } catch (error) {
    return res.status(200).json([]);
  }
}
