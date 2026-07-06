import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/cores')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch from API bridge');
        return res.json();
      })
      .then(data => {
        // Ensure data is always an array so it doesn't crash .filter()
        setCores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSort = (field) => {
    setSortAsc(sortField === field ? !sortAsc : true);
    setSortField(field);
  };

  // Safely grab values for sorting, substituting 0 or empty string if missing
  const getSortValue = (item, field) => {
    if (!item) return '';
    return item[field] !== undefined ? item[field] : '';
  };

  const sortedCores = [...cores]
    .filter(core => {
      if (!core) return false;
      const coreName = (core.name || '').toLowerCase();
      const coreElement = (core.element || '').toLowerCase();
      const coreId = (core.hid || '').toString();
      const searchStr = search.toLowerCase();
      return coreName.includes(searchStr) || coreElement.includes(searchStr) || coreId.includes(searchStr);
    })
    .sort((a, b) => {
      const valA = getSortValue(a, sortField);
      const valB = getSortValue(b, sortField);
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <h2>DNA Racing Core Performance Analytics</h2>
      <p>Analyze 3-gate performance, best distances, and core profits safely.</p>
      
      <input 
        type="text" 
        placeholder="Search by ID, Name, or Element..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '30px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
      />

      {error && (
        <div style={{ padding: '15px', backgroundColor: '#991b1b', borderRadius: '6px', marginBottom: '20px' }}>
          <strong>Error Loading Data:</strong> {error}
        </div>
      )}

      {loading ? <p>Loading live data and performance stats...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', cursor: 'pointer' }}>
              <th onClick={() => handleSort('hid')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>Core ID {sortField === 'hid' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('name')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('element')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>Element {sortField === 'element' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('threeGateWins')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>3-Gate Wins {sortField === 'threeGateWins' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('threeGateRaces')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>3-Gate Races {sortField === 'threeGateRaces' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('bestDistance')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>Best Distance {sortField === 'bestDistance' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('totalProfit')} style={{ padding: '12px', borderBottom: '2px solid #334155' }}>Profits ($) {sortField === 'totalProfit' ? (sortAsc ? '▲' : '▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {sortedCores.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No cores found or data is empty.</td>
              </tr>
            ) : (
              sortedCores.map(core => (
                <tr key={core.hid} style={{ borderBottom: '1px solid #334155', backgroundColor: '#0f172a' }}>
                  <td style={{ padding: '12px' }}>#{core.hid}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{core.name || 'Unnamed'}</td>
                  <td style={{ padding: '12px', textTransform: 'capitalize' }}>{core.element || 'N/A'}</td>
                  <td style={{ padding: '12px', color: '#10b981' }}>{core.threeGateWins ?? 0} W</td>
                  <td style={{ padding: '12px' }}>{core.threeGateRaces ?? 0}</td>
                  <td style={{ padding: '12px', color: '#38bdf8' }}>{core.bestDistance || 'N/A'}</td>
                  <td style={{ padding: '12px', color: '#fbbf24' }}>{core.totalProfit ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
