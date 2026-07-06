export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    // 1. Fetch all core IDs owned by the vault address
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const vaultData = await vaultRes.json();
    if (vaultData.status !== "success" || !vaultData.result) return res.status(200).json([]);

    const hids = vaultData.result || [];
    if (hids.length === 0) return res.status(200).json([]);

    // 2. Fetch all Identity Metadata Profiles in batches
    const batchSize = 25;
    let coreIdentities = [];
    for (let i = 0; i < hids.length; i += batchSize) {
      const batch = hids.slice(i, i + batchSize);
      const infoRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hids: batch }) 
      }).then(r => r.json()).catch(() => ({ result: [] }));

      if (infoRes.result) coreIdentities = coreIdentities.concat(infoRes.result);
    }

    // 3. Hydrate Live Performance Stats Directly per Core
    // We request the direct endpoints to bypass bulk payload array structural mismatches
    const combinedData = await Promise.all(hids.map(async (id) => {
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id)) || {};

      // Fallback API polling for individual statistics profiles
      let performance = {};
      try {
        const statsRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/${id}/racing_stats`, {
          headers: { "Authorization": `Bearer ${API_KEY}` }
        }).then(r => r.json());
        if (statsRes.result) performance = statsRes.result;
      } catch (e) {
        // If the direct endpoint layout varies, try alternative path string configurations
        try {
          const altRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/stats/${id}`, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
          }).then(r => r.json());
          if (altRes.result) performance = altRes.result;
        } catch (err) {}
      }

      // Element & Generation parsing
      const element = identity.element || identity.attributes?.element || 'Unknown';
      let genNum = identity.generation ?? identity.f_number ?? performance.ageing?.generation ?? '1';
      let fNumber = `F${genNum}`;

      // Set class types accurately
      let typeStr = String(identity.type || identity.class || '').toLowerCase();
      let coreClass = 'Genesis';
      if (typeStr.includes('morph')) coreClass = 'Morph';
      else if (typeStr.includes('freak')) coreClass = 'Freak';
      else if (typeStr.includes('x')) coreClass = 'X-Class';

      // Set Core Font Hex color values
      let colorHex = '#1e3a8a'; 
      let colorStr = String(identity.color || identity.name || '').toLowerCase();
      if (colorStr.includes('red')) colorHex = '#dc2626';
      else if (colorStr.includes('blue')) colorHex = '#2563eb';
      else if (colorStr.includes('green')) colorHex = '#16a34a';
      else if (colorStr.includes('yellow') || colorStr.includes('gold')) colorHex = '#d97706';
      else if (colorStr.includes('purple')) colorHex = '#7c3aed';
      else if (colorStr.includes('pink')) colorHex = '#db2777';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // Universally extract fields out of any nested properties found inside the payload response
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0;
      let activeDistances = [];

      const deepSearch = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.total_races !== undefined) totalRaces += Number(obj.total_races || 0);
        if (obj.races !== undefined) totalRaces += Number(obj.races || 0);
        if (obj.wins !== undefined) totalWins += Number(obj.wins || 0);
        if (obj.weth_profit !== undefined) wethProfit = Number(obj.weth_profit || 0);
        if (obj.dez_profit !== undefined) dezProfit = Number(obj.dez_profit || 0);
        if (obj.blue_star_pct !== undefined) blueStar = Number(obj.blue_star_pct || 0);
        if (obj.yellow_star_pct !== undefined) yellowStar = Number(obj.yellow_star_pct || 0);

        // Scan keys to find active distance tags (e.g., "1200", "1600")
        for (const k in obj) {
          if (obj.hasOwnProperty(k)) {
            if (!isNaN(Number(k)) && k.length >= 3) activeDistances.push(String(k));
            deepSearch(obj[k]);
          }
        }
      };

      deepSearch(performance);

      // Check alternative parent nodes if direct root recursion missed nested data points
      ['hstats_bike', 'hstats_car', 'hstats_horse'].forEach(vKey => {
        const vData = performance[vKey] || {};
        if (vData.total_races || vData.races) {
          if (totalRaces === 0) {
            totalRaces += Number(vData.total_races || vData.races || 0);
            totalWins += Number(vData.wins || 0);
            wethProfit += Number(vData.weth_profit || 0);
            dezProfit += Number(vData.dez_profit || 0);
          }
          const dMap = vData.distances || vData.distance_stats || {};
          Object.keys(dMap).forEach(d => { if (!activeDistances.includes(d)) activeDistances.push(String(d)); });
        }
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
        allDistances: activeDistances.length > 0 ? activeDistances : ['1000'],
        totalRaces,
        winRate,
        blueStar: Number(blueStar).toFixed(1),
        yellowStar: Number(yellowStar).toFixed(1),
        wethProfit: Number(wethProfit).toFixed(4),
        dezProfit: Number(dezProfit).toFixed(2)
      };
    }));

    return res.status(200).json(combinedData);
  } catch (error) {
    return res.status(200).json([]);
  }
}
