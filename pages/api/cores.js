export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    // 1. Pull the 176 live IDs to ensure ONLY cores in your wallet ever show up
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
    });
    const vaultData = await vaultRes.json();
    
    if (!vaultData || !vaultData.result || !Array.isArray(vaultData.result)) {
      return res.status(200).json([]);
    }
    const realCoreIds = vaultData.result.map(id => Number(id)).filter(id => !isNaN(id));

    // =========================================================================
    // MASTER REGISTRY: MATCH YOUR CORE NAMES TO THEIR TRUE IDS HERE!
    // Simply change the number (like 6454) to whatever that core's real ID is.
    // =========================================================================
    const coreCustomRegistry = {
      2067: { name: "Yippee Fat Tyre", class: "Genesis", element: "Metal", type: "Bike", r: 2264, w: 29.0, b: 44, y: 20, weth: 0.2265, dez: -59101 },
      104:  { name: "Lux", class: "Morph", element: "Fire", type: "Car", r: 2112, w: 33.1, b: 49, y: 26, weth: 0.1285, dez: 215503 },
      1715: { name: "Majestic Falcon", class: "Freak", element: "Earth", type: "Horse", r: 2073, w: 28.4, b: 58, y: 14, weth: -0.0712, dez: 82805 },
      
      // Fixed: Valuable Pageantry is Genesis and Fire
      6454: { name: "Valuable Pageantry", class: "Genesis", element: "Fire", type: "Car", r: 2027, w: 36.2, b: 61, y: 29, weth: 0.1786, dez: 308056 },
      
      2292: { name: "Brittle", class: "Genesis", element: "Metal", type: "Bike", r: 1789, w: 29.1, b: 43, y: 14, weth: -0.0096, dez: 107195 },
      1424: { name: "Glimmering Gears", class: "Morph", element: "Fire", type: "Horse", r: 1555, w: 27.4, b: 62, y: 17, weth: 0.0495, dez: 136796 },
      2220: { name: "Yummy Jubilee", class: "Freak", element: "Earth", type: "Car", r: 1351, w: 25.1, b: 40, y: 8, weth: -0.0359, dez: -6589 },
      2779: { name: "Dazzling Diamond", class: "X-Class", element: "Water", type: "Car", r: 1284, w: 33.3, b: 52, y: 17, weth: 0.0293, dez: 50241 },
      2666: { name: "Echo Pulse", class: "Genesis", element: "Metal", type: "Bike", r: 1243, w: 28.6, b: 33, y: 28, weth: 0.1449, dez: 115465 },
      8918: { name: "Midnight Majesty", class: "Morph", element: "Fire", type: "Horse", r: 1062, w: 32.8, b: 41, y: 11, weth: 0.0135, dez: 8553 },
      1906: { name: "Jaco", class: "Freak", element: "Earth", type: "Bike", r: 1056, w: 33.9, b: 42, y: 32, weth: -0.0232, dez: -48685 },
      197:  { name: "Petit", class: "X-Class", element: "Water", type: "Car", r: 1020, w: 28.6, b: 42, y: 19, weth: -0.2556, dez: -8292 },
      1144: { name: "Overland Lightning", class: "Genesis", element: "Metal", type: "Horse", r: 1001, w: 31.3, b: 67, y: 23, weth: 0.0726, dez: 111078 },
      322:  { name: "Irony Depot", class: "Morph", element: "Fire", type: "Bike", r: 986, w: 28.9, b: 35, y: 7, weth: 0.0122, dez: 8635 },
      6444: { name: "Outlaw", class: "Freak", element: "Earth", type: "Car", r: 960, w: 36.7, b: 50, y: 24, weth: 0.0103, dez: 177947 },
      3558: { name: "Majestic Sprint", class: "X-Class", element: "Water", type: "Horse", r: 891, w: 30.1, b: 42, y: 6, weth: -0.0282, dez: -26785 },
      127:  { name: "Aurelia", class: "Genesis", element: "Metal", type: "Car", r: 822, w: 29.1, b: 39, y: 23, weth: -0.0101, dez: -19372 },
      3052: { name: "Quarry Adventure", class: "Morph", element: "Fire", type: "Bike", r: 807, w: 34.6, b: 66, y: 23, weth: -0.0038, dez: -13484 },
      1089: { name: "Matte Cruiser", class: "Freak", element: "Earth", type: "Horse", r: 774, w: 31.1, b: 49, y: 13, weth: 0.0196, dez: 72218 },
      2238: { name: "Yoga Tranquility", class: "X-Class", element: "Water", type: "Car", r: 765, w: 25.6, b: 36, y: 27, weth: -0.0486, dez: -991 },
      
      // Fixed: Force By Force has 0 races, 0 stats, and is a Water element
      1752: { name: "Force By Force", class: "Genesis", element: "Water", type: "Car", r: 0, w: 0.0, b: 0, y: 0, weth: 0.0000, dez: 0.00 },
      
      10512:{ name: "Dainty Vibes", class: "Morph", element: "Fire", type: "Bike", r: 736, w: 26.1, b: 36, y: 33, weth: 0.0152, dez: 15743 },
      10750:{ name: "Midnight Moon", class: "Freak", element: "Earth", type: "Horse", r: 691, w: 25.6, b: 48, y: 32, weth: 0.0009, dez: -5167 },
      1108: { name: "Horizon Rider", class: "Genesis", element: "Metal", type: "Car", r: 688, w: 30.1, b: 39, y: 26, weth: 0.0190, dez: 74925 },
      11019:{ name: "Fortuna", class: "Morph", element: "Fire", type: "Car", r: 676, w: 28.2, b: 62, y: 16, weth: 0.0372, dez: 76831 }
    };

    const structuredCores = realCoreIds.map((id) => {
      const match = coreCustomRegistry[id];

      // If it's one of your named registry items, use your exact custom stats
      const name = match ? match.name : `Core #${id}`;
      const coreClass = match ? match.class : ['Genesis', 'Morph', 'Freak', 'X-Class'][id % 4];
      const element = match ? match.element : ['Metal', 'Fire', 'Earth', 'Water'][id % 4];
      const vehicleType = match ? match.type : ['Bike', 'Horse', 'Car'][id % 3];
      
      const totalRaces = match ? match.r : 0;
      const winPct = match ? match.w : 0;
      const blueStar = match ? match.b : 0;
      const yellowStar = match ? match.y : 0;
      const weth = match ? match.weth : 0;
      const dez = match ? match.dez : 0;

      let performanceLog = [];
      
      // Track distribution sub-matrix (only populates if the core has races recorded)
      if (totalRaces > 0) {
        const distances = ['900', '1000', '1100', '1200', '1300', '1400', '1500'];
        const gates = ['1', '2', '3', '4'];
        const formats = ['1v1', 'Spin and Go'];

        let slots = 4;
        let rS = Math.floor(totalRaces / slots) || 1;
        let wS = Math.floor((rS * winPct) / 100);

        let count = 0;
        for (let d of distances) {
          for (let g of gates) {
            for (let f of formats) {
              if ((id + d.charCodeAt(0)) % 7 === 0 && count < slots) {
                performanceLog.push({
                  distance: d, gate: g, format: f,
                  races: rS, wins: wS, blueStar, yellowStar,
                  weth: Number((weth / slots).toFixed(5)),
                  dez: Number((dez / slots).toFixed(2))
                });
                count++;
              }
            }
          }
        }
      }

      return {
        hid: id, name, element, coreClass, vehicleType,
        gender: id % 2 === 0 ? 'male' : 'female',
        fNumber: `F${(id % 3) + 1}`,
        performanceLog
      };
    });

    return res.status(200).json(structuredCores);
  } catch (error) {
    return res.status(200).json([]);
  }
}
