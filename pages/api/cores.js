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

    // DIAGNOSTIC: Let's see how the objects look
    const firstStatObj = coreStats[0] || {};
    const availableStatKeys = Object.keys(firstStatObj).join(', ').slice(0, 50);

    const combinedData = hids.map(id => {
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id || i.core_id === id || i.coreId === id)) || {};
      
      // BROAD MATCHING STRATEGY: check every potential ID field variant
      const performance = coreStats.find(s => s && (
        s.hid === id || 
        s.id === id || 
        s.core_id === id || 
        s.coreId === id ||
        s.core_hid === id
      )) || {};

      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      // Handle F number check
      let rawF = identity.f_number ?? identity.fnumber ?? identity.generation ?? identity.f_num ?? null;
      let fNumber = rawF !== null ? `F${rawF}` : '';
      
      // If F-number is still blank, let's look inside identity keys to see where it lives
      if (!fNumber) {
        const idKeys = Object.keys(identity);
        if (idKeys.includes('f')) fNumber = `F${identity.f}`;
        else fNumber = availableStatKeys ? `Keys: ${availableStatKeys}` : 'F1'; 
      }

      let rawClass = identity.class || identity.core_class || identity.type || 'Genesis';
      if (String(rawClass).toLowerCase().includes('morph')) rawClass = 'Morph';
      if (String(rawClass).toLowerCase().includes('freak')) rawClass = 'Freak';
      if (String(rawClass).toLowerCase().includes('x')) rawClass = 'X-Class';
      if (String(rawClass).toLowerCase().includes('genesis')) rawClass = 'Genesis';

      const gender = identity.gender || identity.sex || (id % 2 === 0 ? 'Male' : 'Female');

      // Unpack racing fields
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0, bestDist = '1000';
      let bikeRaces = 0, carRaces = 0, horseRaces = 0;

      // Extract from vehicle specific objects if present
      if (performance.hstats_bike?.career) {
        bikeRaces = performance.hstats_bike.career.total_races || 0;
        totalRaces += bikeRaces;
        totalWins += performance.hstats_bike.career.wins || 0;
        blueStar = performance.hstats_bike.career.blue_star_pct || 0;
        yellowStar = performance.hstats_bike.career.yellow_star_pct || 0;
      }
      if (performance.hstats_car?.career) {
        carRaces = performance.hstats_car.career.total_races || 0;
        totalRaces += carRaces;
        totalWins += performance.hstats_car.career.wins || 0;
      }
      if (performance.hstats_horse?.career) {
        horseRaces = performance.hstats_horse.career.total_races || 0;
        totalRaces += horseRaces;
        totalWins += performance.hstats_horse.career.wins || 0;
      }

      // If flat metrics exist
      if (performance.total_races) totalRaces = performance.total_races;
      if (performance.wins && totalWins === 0) totalWins = performance.wins;
      wethProfit = performance.weth_profit || performance.tourney_profits || performance.weth || 0;
      dezProfit = performance.dez_profit || performance.dez || 0;

      // For debugging filters: make sure they don't disappear by giving default value if missing
      if (totalRaces === 0) {
        bikeRaces = 1; // Temporary mock value to stop the rows from disappearing while we fix keys
        carRaces = 1;
        horseRaces = 1;
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
        wethProfit,
        dezProfit,
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
