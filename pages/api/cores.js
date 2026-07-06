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
      const performance = coreStats.find(s => s && s.hid === id) || {};

      // 1. Identity, Element, Class Parsing
      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      // Extract Generation details straight from the newly found "ageing" object
      let genNum = performance.ageing?.generation ?? identity.generation ?? identity.f_number ?? null;
      let fNumber = genNum !== null ? `F${genNum}` : 'F1';

      let rawClass = identity.class || identity.core_class || 'Genesis';
      if (String(rawClass).toLowerCase().includes('morph')) rawClass = 'Morph';
      if (String(rawClass).toLowerCase().includes('freak')) rawClass = 'Freak';
      if (String(rawClass).toLowerCase().includes('x')) rawClass = 'X-Class';
      if (String(rawClass).toLowerCase().includes('genesis')) rawClass = 'Genesis';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // 2. Direct Target Drilling for Racing Stats
      const bike = performance.hstats_bike || {};
      const car = performance.hstats_car || {};
      const horse = performance.hstats_horse || {};

      // Summing global actions
      const bikeRaces = bike.races || bike.total_races || bike.career?.total_races || 0;
      const carRaces = car.races || car.total_races || car.career?.total_races || 0;
      const horseRaces = horse.races || horse.total_races || horse.career?.total_races || 0;

      const bikeWins = bike.wins || bike.career?.wins || 0;
      const carWins = car.wins || car.career?.wins || 0;
      const horseWins = horse.wins || horse.career?.wins || 0;

      const totalRaces = bikeRaces + carRaces + horseRaces;
      const totalWins = bikeWins + carWins + horseWins;
      
      const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";

      // Calculate Stars safely by parsing potential variations inside the vehicle payload
      const blueStar = bike.blue_star_pct || bike.career?.blue_star_pct || car.blue_star_pct || 0;
      const yellowStar = bike.yellow_star_pct || bike.career?.yellow_star_pct || car.yellow_star_pct || 0;

      // Extract profits
      const wethProfit = performance.weth_profit || performance.tourney_profits || bike.weth_profit || 0;
      const dezProfit = performance.dez_profit || bike.dez_profit || 0;
      const bestDist = bike.best_distance || car.best_distance || '1000';

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
        wethProfit: Number(wethProfit).toFixed(4),
        dezProfit: Number(dezProfit).toFixed(2),
        bikeRaces,
        carRaces,
        horseRaces
      };
    });

    return res.status(200).json(combinedData);
  } catch (error) {
    return res.status(200).json([]);
  }
}
