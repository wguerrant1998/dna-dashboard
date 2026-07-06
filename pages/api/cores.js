export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = 0x1a1d4c5c255635a796ad6f64d16431acb2d37c90; 

  try {
    const vaultRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const vaultData = await vaultRes.json();
    
    if (vaultData.status !== "success") {
      return res.status(500).json({ error: vaultData.err });
    }

    const hids = vaultData.result;

    const infoRes = await fetch(`https://api.dnaracing.run/fbike/pub/v1/cores/info_bulk`, {
      method: 'POST',
      headers: { 
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ hids: hids.slice(0, 20) }) 
    });
    
    const infoData = await infoRes.json();
    res.status(200).json(infoData.result || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch data" });
  }
}
