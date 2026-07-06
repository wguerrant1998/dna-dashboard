import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedDistance, setSelectedDistance] = useState('All');
  const [selectedVehicle, setSelectedVehicle] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
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

  const getSortValue = (item, field) => {
    if (!item || item[field] === undefined || item[field] === null) return 0;
    const val = item[field];
    return isNaN(Number(val)) ? String(val).toLowerCase() : Number(val);
  };

  const filteredCores = cores
    .filter(core => {
      if (!core) return false;
      
      const coreName = String(core.name || '').toLowerCase();
      const coreId = String(core.hid || '');
      const searchStr = search.toLowerCase();
      if (!coreName.includes(searchStr) && !coreId.includes(searchStr)) return false;

      // Safe Gender Filter
      if (selectedGender !== 'All' && core.gender !== selectedGender.toLowerCase()) return false;

      // Smart Vehicle Filter: don't disappear if they ran it at least once
      if (selectedVehicle !== 'All') {
        if (selectedVehicle === 'Bike' && core.bikeRaces === 0) return false;
        if (selectedVehicle === 'Car' && core.carRaces === 0) return false;
        if (selectedVehicle === 'Horse' && core.horseRaces === 0) return false;
      }
      
      if (selectedDistance !== 'All' && String(core.bestDistance) !== String(selectedDistance)) return false;

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
    padding: '6px 10px',
    marginRight: '6px',
    marginBottom: '6px',
    backgroundColor: active ? '#3b82f6' : '#1e293b',
    color: '#fff',
    border: '1px solid #334155',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? 'bold' : 'normal'
  });

  const safeRender = (val, fallback = '0') => {
    if (val === undefined || val === null) return fallback;
    return String(val);
  };

  const distances = ['All', '900', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '2100', '2200'];

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <h2>DNA Racing Advanced Analytics</h2>
      <p style={{ color: '#94a3b8' }}>Total Loaded Cores: {cores.length}</p>

      <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #334155' }}>
        {/* Vehicle Filter */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Vehicle:</span>
          {['All', 'Car', 'Horse', 'Bike'].map(v => (
            <button key={v} onClick={() => setSelectedVehicle(v)} style={filterButtonStyle(selectedVehicle === v)}>{v}</button>
          ))}
        </div>

        {/* New Gender Filter Option */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Gender:</span>
          {['All', 'Male', 'Female'].map(g => (
            <button key={g} onClick={() => setSelectedGender(g)} style={filterButtonStyle(selectedGender === g)}>{g}</button>
          ))}
        </div>

        {/* Distance Filter */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Distance:</span>
          {distances.map(d => (
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

        <div>
          <span style={{ marginRight: '15px', color: '#94a3b8', display: 'inline-block', width: '100px' }}>Race Type:</span>
          {['All', 'WTA', '1v1', 'Top 2', 'Top 3', 'Spin and Go'].map(t => (
            <button key={t} onClick={() => setSelectedType(t)} style={filterButtonStyle(selectedType === t)}>{t}</button>
          ))}
        </div>
      </div>

      <input 
        type="text" 
        placeholder="Search core name or custom ID..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff' }}
      />

      {error && <p style={{ color: '#ef4444' }}>Error: {error}</p>}

      {loading ? <p>Loading all 176 cores and aggregating historical stats...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', cursor: 'pointer', borderBottom: '2px solid #334155' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '12px' }}>Core Name & Details {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
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
              filteredCores.map((core, i) => (
                <tr key={core.hid || i} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{safeRender(core.name, 'Unnamed')}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      <span style={{ backgroundColor: '#334155', padding: '2px 6px', borderRadius: '4px', marginRight: '5px', textTransform: 'capitalize' }}>{safeRender(core.element)}</span>
                      <span style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px', marginRight: '5px' }}>{safeRender(core.fNumber)}</span>
                      <span style={{ border: '1px solid #475569', padding: '2px 6px', borderRadius: '4px', marginRight: '5px', textTransform: 'uppercase', fontSize: '10px' }}>{safeRender(core.coreClass)}</span>
                      <span style={{ color: core.gender === 'male' ? '#38bdf8' : '#f472b6', textTransform: 'capitalize' }}>{safeRender(core.gender)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>{safeRender(core.totalRaces)}</td>
                  <td style={{ padding: '12px', color: '#10b981' }}>{safeRender(core.winRate)}%</td>
                  <td style={{ padding: '12px', color: '#38bdf8' }}>{safeRender(core.blueStar)}%</td>
                  <td style={{ padding: '12px', color: '#eab308' }}>{safeRender(core.yellowStar)}%</td>
                  <td style={{ padding: '12px' }}>{safeRender(core.wethProfit)}</td>
                  <td style={{ padding: '12px', color: '#a855f7' }}>{safeRender(core.dezProfit)}</td>
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
