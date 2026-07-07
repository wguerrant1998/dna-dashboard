export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const VAULT_ADDRESS = "0x1a1d4c5c255635a796ad6f64d16431acb2d37c90"; 

  try {
    // Accessing the authorized races scope endpoint
    const response = await fetch(`https://api.dnaracing.run/fbike/pub/v1/vault/${VAULT_ADDRESS}/races`, {
      headers: { 
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json"
      }
    });
    
    const status = response.status;
    const rawData = await response.json();
    
    // We sample up to the first 3 match entries to inspect the data shape
    const sampleLogs = Array.isArray(rawData.result) ? rawData.result.slice(0, 3) : rawData;

    return res.status(200).json({
      apiConnectionStatus: status,
      dataTypeDetected: typeof rawData,
      isArray: Array.isArray(rawData.result),
      raceLogsSample: sampleLogs
    });
  } catch (error) {
    return res.status(500).json({ 
      error: "Could not fetch vault racing history data structure", 
      message: error.message 
    });
  }
}
