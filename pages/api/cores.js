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
      // Robust cross-reference checking for matching payload fields
      const identity = coreIdentities.find(i => i && (i.hid === id || i.id === id || String(i.hid) === String(id))) || {};
      
      // Let's check why stats are 0: look for structural ID properties or fallback to the current index position
      let performance = coreStats.find(s => s && (s.hid === id || String(s.hid) === String(id))) || {};
      let isFallbackUsed = false;
      if (!performance.hid && coreStats[coreIdentities.indexOf(identity)]) {
        performance = coreStats[coreIdentities.indexOf(identity)];
        isFallbackUsed = true;
      }

      const element = identity.element || identity.attributes?.element || 'Unknown';
      
      // Generation Extraction
      let genNum = performance.ageing?.generation ?? identity.generation ?? identity.f_number ?? identity.attributes?.generation ?? null;
      let fNumber = genNum !== null ? `F${genNum}` : 'F1';

      // 1. EXTENDED CLASS SCANNER: Search deep for class variations
      let rawClass = identity.class || identity.core_class || identity.tier || identity.attributes?.class || identity.attributes?.tier || '';
      let strToCheck = JSON.stringify(identity).toLowerCase() + JSON.stringify(performance).toLowerCase();
      
      let coreClass = 'Genesis'; // Default setting
      if (strToCheck.includes('morph')) coreClass = 'Morph';
      else if (strToCheck.includes('freak')) coreClass = 'Freak';
      else if (strToCheck.includes('x-class') || strToCheck.includes('xclass')) coreClass = 'X-Class';

      // 2. CORE COLOR SCANNER: Translate metadata labels to standard color hex codes
      let colorHex = '#1e3a8a'; // Blue fallback
      let colorStr = String(identity.color || identity.attributes?.color || identity.name || '').toLowerCase();
      
      if (colorStr.includes('red')) colorHex = '#dc2626';
      else if (colorStr.includes('blue')) colorHex = '#2563eb';
      else if (colorStr.includes('green')) colorHex = '#16a34a';
      else if (colorStr.includes('yellow') || colorStr.includes('gold')) colorHex = '#d97706';
      else if (colorStr.includes('purple') || colorStr.includes('violet')) colorHex = '#7c3aed';
      else if (colorStr.includes('orange')) colorHex = '#ea580c';
      else if (colorStr.includes('pink')) colorHex = '#db2777';

      const gender = identity.gender || (id % 2 === 0 ? 'Male' : 'Female');

      // 3. STATS RECURSION EXTRACTOR
      let totalRaces = 0, totalWins = 0, blueStar = 0, yellowStar = 0, wethProfit = 0, dezProfit = 0, bestDist = '1000';

      const scanObj = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.total_races !== undefined) totalRaces += Number(obj.total_races || 0);
        if (obj.races !== undefined) totalRaces += Number(obj.races || 0);
        if (obj.wins !== undefined) totalWins += Number(obj.wins || 0);
        if (obj.weth_profit !== undefined) wethProfit = Number(obj.weth_profit || 0);
        if (obj.dez_profit !== undefined) dezProfit = Number(obj.dez_profit || 0);
        if (obj.blue_star_pct !== undefined) blueStar = Number(obj.blue_star_pct || 0);
        if (obj.yellow_star_pct !== undefined) yellowStar = Number(obj.yellow_star_pct || 0);
        for (const k in obj) { if (obj.hasOwnProperty(k)) scanObj(obj[k]); }
      };

      scanObj(performance);

      const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";

      // If stats remain 0, let's output a diagnostic message under the core name
      let debugKeys = '';
      if (totalRaces === 0) {
        debugKeys = `ID:${id} | IdentityKeys: ${Object.keys(identity).slice(0,3).join(',')} | StatsKeys: ${Object.keys(performance).slice(0,3).join(',')}`;
      }

      return {
        hid: id,
        name: identity.name || `Core #${id}`,
        element,
        fNumber,
        coreClass,
        colorHex,
        gender: String(gender).toLowerCase(),
        bestDistance: String(bestDist),
        totalRaces,
        winRate,
        blueStar: Number(blueStar).toFixed(1),
        yellowStar: Number(yellowStar).toFixed(1),
        wethProfit: Number(wethProfit).toFixed(4),
        dezProfit: Number(dezProfit).toFixed(2),
        debugKeys: debugKeys.includes('IdentityKeys') ? debugKeys : null
      };
    });

    return res.status(200).json(combinedData);
  } catch (error) {
    return res.status(200).json([]);
  }
}
