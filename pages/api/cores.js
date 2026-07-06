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

      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      // Generation Pull from performance.ageing
      let genNum = performance.ageing?.generation ?? identity.generation ?? identity.f_number ?? null;
      let fNumber = genNum !== null ? `F${genNum}` : 'F1';

      let rawClass = identity.class || identity.core_class || 'Genesis';
      if (String(rawClass).toLowerCase().includes('morph')) rawClass = 'Morph';
      if (String(rawClass).toLowerCase().includes('freak')) rawClass = 'Freak';
      if (String(rawClass).toLowerCase().includes('x')) rawClass = 'X-Class';
      if (String(rawClass).toLowerCase().includes('genesis')) rawClass = 'Genesis';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // Universal recursive extractor loop
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0, bestDist = '1000';
      let bikeRaces = 0, carRaces = 0, horseRaces = 0;

      const extractAllStats = (obj, currentKey = '') => {
        if (!obj || typeof obj !== 'object') return;

        // Track matches inside specific sub-objects
        if (currentKey.includes('bike') && (obj.total_races !== undefined || obj.races !== undefined)) {
          bikeRaces = Number(obj.total_races || obj.races || 0);
        }
        if (currentKey.includes('car') && (obj.total_races !== undefined || obj.races !== undefined)) {
          carRaces = Number(obj.total_races || obj.races || 0);
        }
        if (currentKey.includes('horse') && (obj.total_races !== undefined || obj.races !== undefined)) {
          horseRaces = Number(obj.total_races || obj.races || 0);
        }

        // Aggregate core numbers
        if (obj.total_races !== undefined) totalRaces += Number(obj.total_races);
        if (obj.wins !== undefined) totalWins += Number(obj.wins);
        if (obj.weth_profit !== undefined) wethProfit = Number(obj.weth_profit);
        if (obj.dez_profit !== undefined) dezProfit = Number(obj.dez_profit);
        if (obj.blue_star_pct !== undefined) blueStar = Number(obj.blue_star_pct);
        if (obj.yellow_star_pct !== undefined) yellowStar = Number(obj.yellow_star_pct);
        if (obj.best_distance !== undefined) bestDist = String(obj.best_distance);

        for (const k in obj) {
          if (obj.hasOwnProperty(k)) extractAllStats(obj[k], k);
        }
      };

      extractAllStats(performance);

      // Clean fallback step if properties are flat rather than deep-nested
      if (totalRaces === 0) {
        const b = performance.hstats_bike || {};
        const c = performance.hstats_car || {};
        const h = performance.hstats_horse || {};

        bikeRaces = b.races || b.total_races || b.career?.total_races || 0;
        carRaces = c.races || c.total_races || c.career?.total_races || 0;
        horseRaces = h.races || h.total_races || h.career?.total_races || 0;

        totalRaces = bikeRaces + carRaces + horseRaces;
        totalWins = (b.wins || b.career?.wins || 0) + (c.wins || c.career?.wins || 0) + (h.wins || h.career?.wins || 0);
        blueStar = b.blue_star_pct || b.career?.blue_star_pct || 0;
        yellowStar = b.yellow_star_pct || b.career?.yellow_star_pct || 0;
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
        wethProfit: Number(wethProfit).toFixed(4),
        dezProfit: Number(dezProfit).toFixed(2),
        bikeRaces || (totalRaces > 0 ? 1 : 0), // Protective fallback prevents filter disappearances
        carRaces || (totalRaces > 0 ? 1 : 0),
        horseRaces || (totalRaces > 0 ? 1 : 0)
      };
    });

    return res.status(200).json(combinedData);
  } catch (error) {
    return res.status(200).json([]);
  }
}
