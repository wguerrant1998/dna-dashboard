import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedDistance, setSelectedDistance] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
  const [selectedElement, setSelectedElement] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
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

      if (selectedDistance !== 'All' && !core.allDistances?.includes(String(selectedDistance))) return false;

      return true;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (!isNaN(Number(valA))) { valA = Number(valA); valB = Number(valB); }
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
    fontSize: '13px'
  });

  const distances = ['All', '900', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '2100', '2200'];

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#ffffff', color: '#0f172a', minHeight: '100vh' }}>
      <h2 style={{ color: '#1e3a8a', marginBottom: '4px' }}>DNA Racing Advanced Analytics</h2>
      <p style={{ color: '#64748b', marginBottom: '25px' }}>Total Loaded Cores: {cores.length}</p>

      <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
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

        <div>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '100px', fontWeight: '600' }}>Distance:</span>
          {distances.map(d => (
            <button key={d} onClick={() => setSelectedDistance(d)} style={filterButtonStyle(selectedDistance === d)}>{d}</button>
          ))}
        </div>
      </div>

      <input 
        type="text" 
        placeholder="Search core name..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '25px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
      />

      {loading ? <p>Processing dashboard analytics...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Core Name & Details</th>
              <th onClick={() => handleSort('totalRaces')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Total Races</th>
              <th onClick={() => handleSort('winRate')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Win %</th>
              <th onClick={() => handleSort('blueStar')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Blue Star %</th>
              <th onClick={() => handleSort('yellowStar')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Yellow Star %</th>
              <th onClick={() => handleSort('wethProfit')} style={{ padding: '14px 12px', cursor: 'pointer' }}>WETH Profit</th>
              <th onClick={() => handleSort('dezProfit')} style={{ padding: '14px 12px', cursor: 'pointer' }}>DEZ Profit</th>
            </tr>
          </thead>
          <tbody>
            {filteredCores.map((core, i) => (
              <tr key={core.hid || i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: core.colorHex }}>{core.name}</div>
                  <div style={{ fontSize: '11px', marginTop: '6px' }}>
                    <span style={{ backgroundColor: '#e2e8f0', color: '#334155', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '600' }}>{core.element}</span>
                    <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '600' }}>{core.fNumber}</span>
                    <span style={{ border: '1px solid #cbd5e1', color: '#475569', padding: '2px 6px', borderRadius: '4px', marginRight: '5px' }}>{core.coreClass}</span>
                    <span style={{ color: core.gender === 'male' ? '#0284c7' : '#db2777', fontWeight: '600' }}>{core.gender}</span>
                  </div>
                  {core.debugText && (
                    <div style={{ padding: '8px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px dashed #ef4444', borderRadius: '4px', fontSize: '10px', marginTop: '10px', fontFamily: 'monospace', maxWidth: '600px', overflowX: 'auto' }}>
                      {core.debugText}
                    </div>
                  )}
                </td>
                <td style={{ padding: '14px 12px', fontWeight: '500' }}>{core.totalRaces}</td>
                <td style={{ padding: '14px 12px', color: '#16a34a', fontWeight: '600' }}>{core.winRate}%</td>
                <td style={{ padding: '14px 12px', color: '#0284c7' }}>{core.blueStar}%</td>
                <td style={{ padding: '14px 12px', color: '#d97706' }}>{core.yellowStar}%</td>
                <td style={{ padding: '14px 12px' }}>{core.wethProfit}</td>
                <td style={{ padding: '14px 12px', color: '#7c3aed' }}>{core.dezProfit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
