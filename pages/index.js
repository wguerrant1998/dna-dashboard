import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [sortField, setSortField] = useState('races');
  const [sortAsc, setSortAsc] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedDistance, setSelectedDistance] = useState('All');
  const [selectedGender, setSelectedGender] = useState('All');
  const [selectedElement, setSelectedElement] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedGate, setSelectedGate] = useState('All');
  const [selectedFormat, setSelectedFormat] = useState('All');
  const [selectedVehicleType, setSelectedVehicleType] = useState('All');

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
      .then(data => {
        setCores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSort = (field) => {
    setSortAsc(sortField === field ? !sortAsc : true);
    setSortField(field);
  };

  const getElementStyle = (element) => {
    const el = String(element).toLowerCase();
    let bg = '#64748b'; 
    if (el.includes('water')) bg = '#2563eb';
    if (el.includes('fire')) bg = '#ea580c';
    if (el.includes('earth')) bg = '#78350f';
    if (el.includes('metal')) bg = '#475569';

    return {
      backgroundColor: bg, color: '#ffffff', padding: '4px 9px', borderRadius: '5px',
      marginRight: '6px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
      display: 'inline-block'
    };
  };

  const renderProfit = (value, isWeth = false) => {
    const num = Number(value);
    const formatted = isWeth ? num.toFixed(4) : num.toFixed(2);
    const isNegative = num < 0;

    return (
      <span style={{ color: isNegative ? '#dc2626' : '#16a34a', fontWeight: '600' }}>
        {num > 0 ? `+${formatted}` : formatted}
      </span>
    );
  };

  const computeActiveStats = (core) => {
    let totalRaces = 0, totalWins = 0, totalWeth = 0, totalDez = 0;
    if (!core.performanceLog || core.performanceLog.length === 0) {
      return { races: 0, winRate: "0.0", weth: 0, dez: 0, blueStar: core.blueStar || "0.0", yellowStar: core.yellowStar || "0.0" };
    }

    core.performanceLog.forEach(node => {
      const dMatch = selectedDistance === 'All' || String(node.distance) === String(selectedDistance);
      const gMatch = selectedGate === 'All' || String(node.gate) === String(selectedGate);
      const fMatch = selectedFormat === 'All' || String(node.format).toLowerCase().includes(selectedFormat.toLowerCase());

      if (dMatch && gMatch && fMatch) {
        totalRaces += Number(node.races || 0);
        totalWins += Number(node.wins || 0);
        totalWeth += Number(node.weth || 0);
        totalDez += Number(node.dez || 0);
      }
    });

    const winRate = totalRaces > 0 ? ((totalWins / totalRaces) * 100).toFixed(1) : "0.0";
    return { races: totalRaces, winRate, weth: totalWeth, dez: totalDez, blueStar: core.blueStar, yellowStar: core.yellowStar };
  };

  const processedCores = cores.map(core => ({
    ...core,
    calculatedStats: computeActiveStats(core)
  }));

  const filteredCores = processedCores
    .filter(core => {
      const coreName = String(core.name || '').toLowerCase();
      const coreId = String(core.hid || '');
      const searchStr = search.toLowerCase();
      if (!coreName.includes(searchStr) && !coreId.includes(searchStr)) return false;

      if (selectedGender !== 'All' && String(core.gender).toLowerCase() !== selectedGender.toLowerCase()) return false;
      if (selectedElement !== 'All' && String(core.element).toLowerCase() !== selectedElement.toLowerCase()) return false;
      if (selectedClass !== 'All' && String(core.coreClass).toLowerCase() !== selectedClass.toLowerCase()) return false;
      if (selectedVehicleType !== 'All' && String(core.vehicleType).toLowerCase() !== selectedVehicleType.toLowerCase()) return false;

      return true;
    })
    .sort((a, b) => {
      let valA = sortField === 'name' || sortField === 'hid' ? a[sortField] : a.calculatedStats[sortField];
      let valB = sortField === 'name' || sortField === 'hid' ? b[sortField] : b.calculatedStats[sortField];

      if (!isNaN(Number(valA))) { valA = Number(valA); valB = Number(valB); }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const filterButtonStyle = (active) => ({
    padding: '6px 12px', marginRight: '6px', marginBottom: '6px',
    backgroundColor: active ? '#2563eb' : '#f1f5f9', color: active ? '#fff' : '#334155',
    border: active ? '1px solid #2563eb' : '1px solid #cbd5e1', borderRadius: '6px',
    cursor: 'pointer', fontSize: '13px', fontWeight: '600'
  });

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', color: '#0f172a', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h2 style={{ color: '#1e3a8a', marginBottom: '4px' }}>DNA Racing Vault Analytics</h2>
        <p style={{ color: '#64748b', marginBottom: '25px', fontWeight: '500' }}>Active Collection Matrix: {filteredCores.length} / {cores.length} Cores Visualized</p>

        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '12px' }}><span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Vehicle Type:</span>{['All', 'Bike', 'Horse', 'Car'].map(vt => (<button key={vt} onClick={() => setSelectedVehicleType(vt)} style={filterButtonStyle(selectedVehicleType === vt)}>{vt}</button>))}</div>
          <div style={{ marginBottom: '12px' }}><span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Element Type:</span>{['All', 'Metal', 'Fire', 'Earth', 'Water'].map(e => (<button key={e} onClick={() => setSelectedElement(e)} style={filterButtonStyle(selectedElement === e)}>{e}</button>))}</div>
          <div style={{ marginBottom: '12px' }}><span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Core Tier Class:</span>{['All', 'Genesis', 'Morph', 'Freak', 'X-Class'].map(c => (<button key={c} onClick={() => setSelectedClass(c)} style={filterButtonStyle(selectedClass === c)}>{c}</button>))}</div>
          <div style={{ marginBottom: '12px' }}><span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Track Distance:</span>{['All', '900', '1000', '1100', '1200', '1300', '1400', '1500'].map(d => (<button key={d} onClick={() => setSelectedDistance(d)} style={filterButtonStyle(selectedDistance === d)}>{d}</button>))}</div>
          <div><span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Format Type:</span>{['All', '1v1', 'Spin and Go', 'Top 3', 'WTA'].map(f => (<button key={f} onClick={() => setSelectedFormat(f)} style={filterButtonStyle(selectedFormat === f)}>{f}</button>))}</div>
        </div>

        <input type="text" placeholder="Search by name or custom token ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '12px', width: '100%', maxWidth: '400px', marginBottom: '25px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />

        {loading ? <p style={{ color: '#2563eb', fontWeight: 'bold' }}>Parsing deep track logs profile matrices...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#1e293b' }}>
                <th onClick={() => handleSort('name')} style={{ padding: '14px 12px', cursor: 'pointer', textAlign:'left' }}>Core Asset Details</th>
                <th onClick={() => handleSort('races')} style={{ padding: '14px 12px', cursor: 'pointer', textAlign:'left' }}>Total Races</th>
                <th onClick={() => handleSort('winRate')} style={{ padding: '14px 12px', cursor: 'pointer', textAlign:'left' }}>Win Pct</th>
                <th style={{ padding: '14px 12px', textAlign:'left' }}>Blue Star</th>
                <th style={{ padding: '14px 12px', textAlign:'left' }}>Yellow Star</th>
                <th onClick={() => handleSort('weth')} style={{ padding: '14px 12px', cursor: 'pointer', textAlign:'left' }}>WETH Delta</th>
                <th onClick={() => handleSort('dez')} style={{ padding: '14px 12px', cursor: 'pointer', textAlign:'left' }}>DEZ Profit</th>
              </tr>
            </thead>
            <tbody>
              {filteredCores.map((core, i) => (
                <tr key={core.hid} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>{core.name} <span style={{ color: '#94a3b8', fontWeight: '400' }}>#{core.hid}</span></div>
                    <div style={{ fontSize: '11px', marginTop: '6px' }}>
                      <span style={getElementStyle(core.element)}>{core.element}</span>
                      <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '700' }}>{core.vehicleType}</span>
                      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '700' }}>{core.coreClass}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 12px', fontWeight: '600' }}>{core.calculatedStats.races}</td>
                  <td style={{ padding: '14px 12px', color: '#16a34a', fontWeight: '700' }}>{core.calculatedStats.winRate}%</td>
                  <td style={{ padding: '14px 12px', color: '#2563eb', fontWeight: '500' }}>{core.calculatedStats.blueStar}%</td>
                  <td style={{ padding: '14px 12px', color: '#d97706', fontWeight: '500' }}>{core.calculatedStats.yellowStar}%</td>
                  <td style={{ padding: '14px 12px' }}>{renderProfit(core.calculatedStats.weth, true)}</td>
                  <td style={{ padding: '14px 12px' }}>{renderProfit(core.calculatedStats.dez, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
