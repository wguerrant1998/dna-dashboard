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

      // 1. Precise Identity Property Parsing
      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      // Look for any variable that resembles generation or f_number configurations
      let rawF = identity.f_number ?? identity.fnumber ?? identity.generation ?? identity.metadata?.f_number ?? null;
      let fNumber = rawF !== null ? `F${rawF}` : 'F1'; // Defaulting safely if missing
      
      let rawClass = identity.class || identity.core_class || identity.type || 'Genesis';
      if (String(rawClass).toLowerCase().includes('morph')) rawClass = 'Morph';
      if (String(rawClass).toLowerCase().includes('freak')) rawClass = 'Freak';
      if (String(rawClass).toLowerCase().includes('x')) rawClass = 'X-Class';
      if (String(rawClass).toLowerCase().includes('genesis')) rawClass = 'Genesis';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // 2. Comprehensive Scanning Loop for Performance Counters
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0, bestDist = '1000';

      const inspectData = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.weth_profit !== undefined) wethProfit = obj.weth_profit;
        if (obj.dez_profit !== undefined) dezProfit = obj.dez_profit;

        if (obj.total_races !== undefined) totalRaces += Number(obj.total_races);
        if (obj.races !== undefined) totalRaces += Number(obj.races);
        if (obj.wins !== undefined) totalWins += Number(obj.wins);

        if (obj.blue_star_pct !== undefined) blueStar = obj.blue_star_pct;
        if (obj.yellow_star_pct !== undefined) yellowStar = obj.yellow_star_pct;
        if (obj.best_distance !== undefined) bestDist = String(obj.best_distance);

        for (const key in obj) {
          if (obj.hasOwnProperty(key)) inspectData(obj[key]);
        }
      };

      inspectData(performance);

      // Clean fallback if direct calculations were missed inside loops
      const bikeCareer = performance.hstats_bike?.career || {};
      const carCareer = performance.hstats_car?.career || {};
      const horseCareer = performance.hstats_horse?.career || {};

      if (totalRaces === 0) {
        totalRaces = (bikeCareer.total_races || 0) + (carCareer.total_races || 0) + (horseCareer.total_races || 0);
        totalWins = (bikeCareer.wins || 0) + (carCareer.wins || 0) + (horseCareer.wins || 0);
        blueStar = bikeCareer.blue_star_pct || carCareer.blue_star_pct || horseCareer.blue_star_pct || 0;
        yellowStar = bikeCareer.yellow_star_pct || carCareer.yellow_star_pct || horseCareer.yellow_star_pct || 0;
        bestDist = bikeCareer.best_distance_text || carCareer.best_distance_text || horseCareer.best_distance_text || '1000';
      }

      const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        element,
        fNumber,
        coreClass: rawClass,
        gender: String(gender).toLowerCase(),
        bestDistance: String(bestDist),
        totalRaces,
        winRate,
        blueStar: Number(blueStar).toFixed(1),
        yellowStar: Number(yellowStar).toFixed(1),
        wethProfit: wethProfit || performance.weth || 0,
        dezProfit: dezProfit || performance.dez || 0,
        bikeRaces: bikeCareer.total_races || 0,
        carRaces: carCareer.total_races || 0,
        horseRaces: horseCareer.total_races || 0
      };
    });

    return res.status(200).json(combinedData);
  } catch (error) {
    return res.status(200).json([]);
  }
}
