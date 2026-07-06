import { useState, useEffect } from 'react';

export default function Diagnostics() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', backgroundColor: '#0f172a', color: '#38bdf8', minHeight: '100vh' }}>
      <h2>System Reset: Connection Diagnostics</h2>
      <hr style={{ borderColor: '#334155', marginBottom: '20px' }} />
      
      {loading ? (
        <p style={{ color: '#e2e8f0', fontWeight: 'bold' }}>Pinging DNA Racing Network Servers...</p>
      ) : (
        <pre style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', overflowX: 'auto', color: '#f1f5f9' }}>
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}
