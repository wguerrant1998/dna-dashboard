import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedDistance, setSelectedDistance] = useState('All');
  const [selectedVehicle, setSelectedVehicle] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
  const [selectedElement, setSelectedElement] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
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

      if (selectedGender !== 'All' && core.gender !== selectedGender.toLowerCase()) return false;
      if (selectedElement !== 'All' && String(core.element).toLowerCase() !== selectedElement.toLowerCase()) return false;
      if (selectedClass !== 'All' && String(core.coreClass).toLowerCase() !== selectedClass.toLowerCase()) return false;
      
      if (selectedDistance !== 'All' && String(core.bestDistance) !== String(selectedDistance)) return false;

      // Fixed Vehicle Filter matching logic
      if (selectedVehicle !== 'All') {
        const v = selectedVehicle.toLowerCase();
        if (v === 'bike' && core.bikeRaces === 0 && core.totalRaces > 0) return false;
        if (v === 'car' && core.carRaces === 0 && core.totalRaces > 0) return false;
        if (v === 'horse' && core.horseRaces === 0 && core.totalRaces > 0) return false;
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
    padding: '6px 12px',
    marginRight: '6px',
    marginBottom: '6px',
    backgroundColor: active ? '#2563eb' : '#f1f5f9',
    color: active ? '#fff' : '#334155',
    border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
    borderRadius: '6px',
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
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#ffffff', color: '#0f172a', minHeight: '100vh' }}>
      <h2 style={{ color: '#1e3a8a', marginBottom: '4px' }}>DNA Racing Advanced Analytics</h2>
      <p style={{ color: '#64748b', marginBottom: '25px', fontWeight: '500' }}>Total Loaded Cores: {cores.length}</p>

      {/* Filter Board Panel */}
      <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Vehicle:</span>
          {['All', 'Car', 'Horse', 'Bike'].map(v => (
            <button key={v} onClick={() => setSelectedVehicle(v)} style={filterButtonStyle(selectedVehicle === v)}>{v}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Gender:</span>
          {['All', 'Male', 'Female'].map(g => (
            <button key={g} onClick={() => setSelectedGender(g)} style={filterButtonStyle(selectedGender === g)}>{g}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Element:</span>
          {['All', 'Metal', 'Fire', 'Earth', 'Water'].map(e => (
            <button key={e} onClick={() => setSelectedElement(e)} style={filterButtonStyle(selectedElement === e)}>{e}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Type:</span>
          {['All', 'Genesis', 'Morph', 'Freak', 'X-Class'].map(c => (
            <button key={c} onClick={() => setSelectedClass(c)} style={filterButtonStyle(selectedClass === c)}>{c}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Distance:</span>
          {distances.map(d => (
            <button key={d} onClick={() => setSelectedDistance(d)} style={filterButtonStyle(selectedDistance === d)}>{d}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Gates:</span>
          {['All', '1', '2', '3', '4', '5', '6', '7', '8', '9+'].map(g => (
            <button key={g} onClick={() => setSelectedGates(g)} style={filterButtonStyle(selectedGates === g)}>{g}</button>
          ))}
        </div>

        <div>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Race Type:</span>
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
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '25px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#0f172a' }}
      />

      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}

      {loading ? <p style={{ color: '#2563eb', fontWeight: '500' }}>Loading all 176 cores and aggregating historical stats...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', cursor: 'pointer', borderBottom: '2px solid #e2e8f0', color: '#1e293b' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '14px 12px' }}>Core Name & Details {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('totalRaces')} style={{ padding: '14px 12px' }}>Total Races {sortField === 'totalRaces' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('winRate')} style={{ padding: '14px 12px' }}>Win % {sortField === 'winRate' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('blueStar')} style={{ padding: '14px 12px' }}>Blue Star % {sortField === 'blueStar' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('yellowStar')} style={{ padding: '14px 12px' }}>Yellow Star % {sortField === 'yellowStar' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('wethProfit')} style={{ padding: '14px 12px' }}>WETH Profit {sortField === 'wethProfit' ? (sortAsc ? '▲' : '▼') : ''}</th>
              <th onClick={() => handleSort('dezProfit')} style={{ padding: '14px 12px' }}>DEZ Profit {sortField === 'dezProfit' ? (sortAsc ? '▲' : '▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCores.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>No matching cores found.</td>
              </tr>
            ) : (
              filteredCores.map((core, i) => (
                <tr key={core.hid || i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e3a8a' }}>{safeRender(core.name, 'Unnamed')}</div>
                    <div style={{ fontSize: '11px', marginTop: '6px' }}>
                      <span style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '600', textTransform: 'capitalize' }}>{safeRender(core.element)}</span>
                      <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '600' }}>{safeRender(core.fNumber)}</span>
                      <span style={{ border: '1px solid #cbd5e1', color: '#475569', padding: '2px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '500', textTransform: 'capitalize' }}>{safeRender(core.coreClass)}</span>
                      <span style={{ color: core.gender === 'male' ? '#0284c7' : '#db2777', fontWeight: '600', textTransform: 'capitalize' }}>{safeRender(core.gender)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px', fontWeight: '500' }}>{safeRender(core.totalRaces)}</td>
                  <td style={{ padding: '14px 12px', color: '#16a34a', fontWeight: '600' }}>{safeRender(core.winRate)}%</td>
                  <td style={{ padding: '14px 12px', color: '#0284c7', fontWeight: '500' }}>{safeRender(core.blueStar)}%</td>
                  <td style={{ padding: '14px 12px', color: '#d97706', fontWeight: '500' }}>{safeRender(core.yellowStar)}%</td>
                  <td style={{ padding: '14px 12px', fontWeight: '500' }}>{safeRender(core.wethProfit)}</td>
                  <td style={{ padding: '14px 12px', color: '#7c3aed', fontWeight: '500' }}>{safeRender(core.dezProfit)}</td>
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
