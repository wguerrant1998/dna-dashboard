import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Sorting states
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedDistance, setSelectedDistance] = useState('All');
  const [selectedVehicle, setSelectedVehicle] = useState('All');
  const [selectedGates, setSelectedGates] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  useEffect(() => {
    fetch('/api/cores')
      .then(res => {
        if (!res.ok) throw new Error('API failed to return data');
        return res.json();
      })
      .then(data => {
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

  // Safe sorting helper
  const getSortValue = (item, field) => {
    if (!item) return 0;
    return item[field] !== undefined ? item[field] : 0;
  };

  // Filter & Sort Logic
  const filteredCores = cores
    .filter(core => {
      if (!core) return false;
      
      // Text Search Filter
      const coreName = (core.name || '').toLowerCase();
      const coreId = (core.hid || '').toString();
      const searchStr = search.toLowerCase();
      if (!coreName.includes(searchStr) && !coreId.includes(searchStr)) return false;

      // Filter: Vehicle Mode
      if (selectedVehicle !== 'All' && core.type !== selectedVehicle.toLowerCase()) return false;
      
      // Filter: Distance
      if (selectedDistance !== 'All' && core.bestDistance !== selectedDistance) return false;

      // Filter: Gates
      if (selectedGates !== 'All') {
        if (selectedGates === '9+' && parseInt(core.threeGateRaces) < 9) return false; // placeholder logic
        // (Real mapping depends on your custom selection)
      }

      return true;
    })
    .sort((a, b) => {
      const valA = getSortValue(a, sortField);
      const valB = getSortValue(b, sortField);
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const filterButtonStyle = (active) => ({
    padding: '8px 14px',
    marginRight: '8px',
    marginBottom: '8px',
    backgroundColor: active ? '#3b82f6' : '#1e293b',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal'
  });

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <h2>DNA Racing Advanced Analytics</h2>
      <p style={{ color: '#94a3b8' }}>Total Loaded Cores: {cores.length}</p>

      {/* --- FILTER INTERFACE PANEL --- */}
      <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #334155' }}>
        
        {/* Vehicle Mode Filter */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Vehicle:</span>
          {['All', 'Car', 'Horse', 'Bike'].map(v => (
            <button key={v} onClick={() => setSelectedVehicle(v)} style={filterButtonStyle(selectedVehicle === v)}>{v}</button>
          ))}
        </div>

        {/* Distance Filter */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Distance:</span>
          {['All', 'Short', 'Medium', 'Long'].map(d => (
            <button key={d} onClick={() => setSelectedDistance(d)} style={filterButtonStyle(selectedDistance === d)}>{d}</button>
          ))}
        </div>

        {/* Gates Filter */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Gates:</span>
          {['All', '1', '2', '3', '4', '5', '6', '7', '8', '9+'].map(g => (
            <button key={g} onClick={() => setSelectedGates(g)} style={filterButtonStyle(selectedGates === g)}>{g}</button>
          ))}
        </div>

        {/* Race Mode Filter */}
        <div>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Race Type:</span>
          {['All', 'WTA', '1v1', 'Top 2', 'Top 3', 'Spin and Go'].map(t => (
            <button key={t} onClick={() => setSelectedType(t)} style={filterButtonStyle(selectedType === t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <input 
        type="text" 
        placeholder="Search core name or custom ID..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
      />

      {error && <p style={{ color: '#ef4444' }}>Error: {error}</p>}

      {/* --- DATA TABLE --- */}
      {loading ? <p>Loading all 176 cores and aggregating historical stats...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', cursor: 'pointer', borderBottom: '2px solid #334155' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '12px' }}>Core Name {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('totalRaces')} style={{ padding: '12px' }}>Total Races {sortField === 'totalRaces' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('winRate')} style={{ padding: '12px' }}>Win % {sortField === 'winRate' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('blueStar')} style={{ padding: '12px' }}>Blue Star % {sortField === 'blueStar' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('yellowStar')} style={{ padding: '12px' }}>Yellow Star % {sortField === 'yellowStar' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('wethProfit')} style={{ padding: '12px' }}>WETH Profit {sortField === 'wethProfit' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('dezProfit')} style={{ padding: '12px' }}>DEZ Profit {sortField === 'dezProfit' ? (sortAsc ? '▲' : '▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCores.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No matching cores found.</td>
              </tr>
            ) : (
              filteredCores.map(core => (
                <tr key={core.hid} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{core.name}</td>
                  <td style={{ padding: '12px' }}>{core.totalRaces}</td>
                  <td style={{ padding: '12px', color: '#10b981' }}>{core.winRate}%</td>
                  <td style={{ padding: '12px', color: '#38bdf8' }}>{core.blueStar}%</td>
                  <td style={{ padding: '12px', color: '#eab308' }}>{core.yellowStar}%</td>
                  <td style={{ padding: '12px' }}>{core.wethProfit} Ξ</td>
                  <td style={{ padding: '12px', color: '#a855f7' }}>{core.dezProfit} DEZ</td>
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
