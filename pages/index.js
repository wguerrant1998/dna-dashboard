import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
      .then(data => {
        setCores(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSort = (field) => {
    setSortAsc(sortField === field ? !sortAsc : true);
    setSortField(field);
  };

  const sortedCores = [...cores]
    .filter(core => 
      core.name?.toLowerCase().includes(search.toLowerCase()) || 
      core.element?.toLowerCase().includes(search.toLowerCase()) ||
      core.hid?.toString().includes(search)
    )
    .sort((a, b) => {
      if (a[sortField] < b[sortField]) return sortAsc ? -1 : 1;
      if (a[sortField] > b[sortField]) return sortAsc ? 1 : -1;
      return 0;
    });

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <h2>DNA Racing Core Performance Analytics</h2>
      <p>Analyze 3-gate performance, best distances, and core profits in real-time.</p>
      
      <input 
        type="text" 
        placeholder="Search by ID, Name, or Element..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '30px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
      />

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
            {sortedCores.map(core => (
              <tr key={core.hid} style={{ borderBottom: '1px solid #334155', backgroundColor: '#0f172a' }}>
                <td style={{ padding: '12px' }}>#{core.hid}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{core.name}</td>
                <td style={{ padding: '12px', textTransform: 'capitalize' }}>{core.element}</td>
                <td style={{ padding: '12px', color: '#10b981' }}>{core.threeGateWins} W</td>
                <td style={{ padding: '12px' }}>{core.threeGateRaces}</td>
                <td style={{ padding: '12px', color: '#38bdf8' }}>{core.bestDistance}</td>
                <td style={{ padding: '12px', color: '#fbbf24' }}>{core.totalProfit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
