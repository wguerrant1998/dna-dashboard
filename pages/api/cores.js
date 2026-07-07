export default async function handler(req, res) {
  const API_KEY = process.env.DNA_API_KEY; 
  const TEST_ID = 17851; // Inspecting one of your real vault IDs

  try {
    const response = await fetch(`https://api.dnaracing.run/fbike/pub/v1/market/cores/${TEST_ID}`, {
      headers: { 
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json"
      }
    });
    
    const status = response.status;
    const rawData = await response.json();
    
    return res.status(200).json({
      testId: TEST_ID,
      apiConnectionStatus: status,
      dnaCoreMetadataResponse: rawData
    });
  } catch (error) {
    return res.status(500).json({ 
      error: "Could not fetch specific core metadata", 
      message: error.message 
    });
  }
}
