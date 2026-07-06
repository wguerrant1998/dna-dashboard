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

      // 1. Core Identification and Type Rules
      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      let genNum = performance.ageing?.generation ?? identity.generation ?? '1';
      let fNumber = `F${genNum}`;

      // Mapping 'type' key to Core Classes
      let typeStr = String(identity.type || '').toLowerCase();
      let coreClass = 'Genesis';
      if (typeStr.includes('morph')) coreClass = 'Morph';
      else if (typeStr.includes('freak')) coreClass = 'Freak';
      else if (typeStr.includes('x')) coreClass = 'X-Class';

      // 2. Map Dynamic Colors
      let colorHex = '#1e3a8a'; 
      let colorStr = String(identity.color || identity.name || '').toLowerCase();
      if (colorStr.includes('red')) colorHex = '#dc2626';
      else if (colorStr.includes('blue')) colorHex = '#2563eb';
      else if (colorStr.includes('green')) colorHex = '#16a34a';
      else if (colorStr.includes('yellow') || colorStr.includes('gold')) colorHex = '#d97706';
      else if (colorStr.includes('purple')) colorHex = '#7c3aed';
      else if (colorStr.includes('pink')) colorHex = '#db2777';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // 3. Extract Statistics out of Nested Vehicle Maps
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0;
      let activeDistances = [];

      // Loop over possible vehicles
      const vehicles = ['hstats_bike', 'hstats_car', 'hstats_horse'];
      vehicles.forEach(vKey => {
        const vData = performance[vKey];
        if (!vData) return;

        // Process overall vehicle stats
        if (vData.total_races || vData.races) totalRaces += Number(vData.total_races || vData.races || 0);
        if (vData.wins) totalWins += Number(vData.wins || 0);
        if (vData.weth_profit) wethProfit += Number(vData.weth_profit || 0);
        if (vData.dez_profit) dezProfit += Number(vData.dez_profit || 0);

        // Dig inside distance submaps if present
        const distMap = vData.distances || vData.distance_stats || {};
        Object.keys(distMap).forEach(d => {
          activeDistances.push(String(d));
          const dData = distMap[d] || {};
          // Fallback parsing if main totals are empty
          if (!vData.total_races) {
            totalRaces += Number(dData.total_races || dData.races || 0);
            totalWins += Number(dData.wins || 0);
          }
          if (dData.blue_star_pct) blueStar = Number(dData.blue_star_pct);
          if (dData.yellow_star_pct) yellowStar = Number(dData.yellow_star_pct);
        });
      });

      const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        element,
        fNumber,
        coreClass,
        colorHex,
        gender: String(gender).toLowerCase(),
        bestDistance: activeDistances.length > 0 ? activeDistances[0] : '1000',
        allDistances: activeDistances, // Sent to frontend for advanced sorting
        totalRaces,
        winRate,
        blueStar: Number(blueStar).toFixed(1),
        yellowStar: Number(yellowStar).toFixed(1),
        wethProfit: Number(wethProfit).toFixed(4),
        dezProfit: Number(dezProfit).toFixed(2)
      };
    });

    return res.status(200).json(combinedData);
  } catch (error) {
    return res.status(200).json([]);
  }
}
