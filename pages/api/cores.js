export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    const response = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/cores`, {
      headers: { 
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json"
      }
    });
    
    const status = response.status;
    const rawData = await response.json();
    
    // We send back the absolute raw, unfiltered reality of what the API says
    return res.status(200).json({
      apiConnectionStatus: status,
      apiKeyLength: API_KEY ? API_KEY.length : 0,
      dnaApiResponse: rawData
    });
  } catch (error) {
    return res.status(500).json({ 
      error: "Could not establish network connection to DNA Racing server", 
      message: error.message 
    });
  }
}
