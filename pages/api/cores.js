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

      // Explicit Identity Parsing
      const element = identity.element || identity.attributes?.element || 'Unknown';
      const fNumber = identity.f_number || identity.fnumber || identity.generation || 'F?';
      const coreClass = identity.class || identity.core_class || 'Standard'; // Genesis, Morph, Freak, X-Class
      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female'); // Fallback strategy if missing

      // Explicit Multi-Vehicle Performance Parsing
      // Combines bike, car, and horse totals to ensure stats show up globally or can be filtered
      const bikeCareer = performance.hstats_bike?.career || {};
      const carCareer = performance.hstats_car?.career || {};
      const horseCareer = performance.hstats_horse?.career || {};

      const totalRaces = (bikeCareer.total_races || 0) + (carCareer.total_races || 0) + (horseCareer.total_races || 0);
      const totalWins = (bikeCareer.wins || 0) + (carCareer.wins || 0) + (horseCareer.wins || 0);
      const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";

      const blueStar = bikeCareer.blue_star_pct || carCareer.blue_star_pct || horseCareer.blue_star_pct || 0;
      const yellowStar = bikeCareer.yellow_star_pct || carCareer.yellow_star_pct || horseCareer.yellow_star_pct || 0;

      // Extract profits
      const wethProfit = performance.weth_profit || performance.tourney_profits || 0;
      const dezProfit = performance.dez_profit || 0;
      const bestDist = bikeCareer.best_distance_text || carCareer.best_distance_text || horseCareer.best_distance_text || '1000';

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        element,
        fNumber,
        coreClass,
        gender: String(gender).toLowerCase(),
        bestDistance: String(bestDist),
        totalRaces,
        winRate,
        blueStar: Number(blueStar).toFixed(1),
        yellowStar: Number(yellowStar).toFixed(1),
        wethProfit,
        dezProfit,
        // Keep separate types accessible for frontend filtering
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
