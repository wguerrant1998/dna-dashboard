export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    // 1. Fetch vault inventory
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success" || !vaultData.result) return res.status(200).json([]);

    const hids = vaultData.result || [];
    if (hids.length === 0) return res.status(200).json([]);

    // 2. Fetch bulk data payloads
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

    // 3. Process and match items across array pairs
    const combinedData = hids.map((id, index) => {
      // Direct ID matching or positional tracking fallback
      const identity = coreIdentities.find(i => i && (Number(i.hid) === Number(id) || Number(i.id) === Number(id))) || coreIdentities[index] || {};
      const performance = coreStats.find(s => s && (Number(s.hid) === Number(id) || Number(s.id) === Number(id))) || coreStats[index] || {};

      // Parse metadata traits
      const name = identity.name || `Core #${id}`;
      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      // Parse Class Typings using the confirmed "type" variable configuration
      let typeStr = String(identity.type || identity.class || '').toLowerCase();
      let coreClass = 'Genesis';
      if (typeStr.includes('morph')) coreClass = 'Morph';
      else if (typeStr.includes('freak')) coreClass = 'Freak';
      else if (typeStr.includes('x')) coreClass = 'X-Class';

      // Parse Generations out of the ageing configurations block
      let genNum = performance.ageing?.generation ?? identity.generation ?? '1';
      let fNumber = `F${genNum}`;

      // Set Font colors based on labels found inside the metadata profile
      let colorHex = '#1e3a8a'; 
      let colorStr = String(identity.color || identity.name || '').toLowerCase();
      if (colorStr.includes('red')) colorHex = '#dc2626';
      else if (colorStr.includes('blue')) colorHex = '#2563eb';
      else if (colorStr.includes('green')) colorHex = '#16a34a';
      else if (colorStr.includes('yellow') || colorStr.includes('gold')) colorHex = '#d97706';
      else if (colorStr.includes('purple')) colorHex = '#7c3aed';
      else if (colorStr.includes('pink')) colorHex = '#db2777';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // 4. Aggressive Deep Object Scanner
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0;
      let activeDistances = [];

      const parseDeepValues = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        // Pull common stat attributes wherever they live in the payload hierarchy
        if (obj.total_races !== undefined) totalRaces += Number(obj.total_races || 0);
        if (obj.races !== undefined) totalRaces += Number(obj.races || 0);
        if (obj.wins !== undefined) totalWins += Number(obj.wins || 0);
        if (obj.weth_profit !== undefined) wethProfit += Number(obj.weth_profit || 0);
        if (obj.dez_profit !== undefined) dezProfit += Number(obj.dez_profit || 0);
        if (obj.blue_star_pct !== undefined) blueStar = Number(obj.blue_star_pct || 0);
        if (obj.yellow_star_pct !== undefined) yellowStar = Number(obj.yellow_star_pct || 0);

        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            // Track strings that look like valid distance ranges
            if (!isNaN(Number(key)) && key.length >= 3) {
              activeDistances.push(String(key));
            }
            parseDeepValues(obj[key]);
          }
        }
      };

      // Run scanner on the entire stats bundle
      parseDeepValues(performance);

      // Final mathematical fallback check for missing vehicle keys
      if (totalRaces === 0) {
        ['hstats_bike', 'hstats_car', 'hstats_horse'].forEach(vKey => {
          const vData = performance[vKey] || {};
          totalRaces += Number(vData.total_races || vData.races || 0);
          totalWins += Number(vData.wins || 0);
          wethProfit += Number(vData.weth_profit || 0);
          dezProfit += Number(vData.dez_profit || 0);
          
          const dMap = vData.distances || vData.distance_stats || {};
          Object.keys(dMap).forEach(d => { if (!activeDistances.includes(d)) activeDistances.push(String(d)); });
        });
      }

      const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";

      return {
        hid: id,
        name,
        element,
        fNumber,
        coreClass,
        colorHex,
        gender: String(gender).toLowerCase(),
        bestDistance: activeDistances.length > 0 ? activeDistances[0] : '1000',
        allDistances: activeDistances.length > 0 ? activeDistances : ['1000', '900', '1100', '1200', '1300', '1400', '1500'],
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
