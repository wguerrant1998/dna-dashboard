import { useState, useEffect } from 'react';

export default function Inspector() {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
      .then(data => {
        setRawData(data);
        setLoading(false);
      })
      .catch(err => {
        setRawData({ error: err.message });
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', backgroundColor: '#0f172a', color: '#38bdf8', minHeight: '100vh' }}>
      <h2>DNA API Data Structure Inspector</h2>
      <p style={{ color: '#94a3b8' }}>This screen displays the raw properties coming back from the server.</p>
      <hr style={{ borderColor: '#334155', margin: '20px 0' }} />
      
      {loading ? (
        <p>Fetching raw data packages...</p>
      ) : (
        <pre style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', overflowX: 'auto', color: '#f1f5f9' }}>
          {JSON.stringify(rawData, null, 2)}
        </pre>
      )}
    </div>
  );
}
