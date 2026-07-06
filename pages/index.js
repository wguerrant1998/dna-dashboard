import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [sortField, setSortField] = useState('hid');
  const [sortAsc, setSortAsc] = useState(true);

  // Filters
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
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
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

    return {
      backgroundColor: bg, color: '#ffffff', padding: '4px 9px', borderRadius: '5px',
      marginRight: '6px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase',
      display: 'inline-block', letterSpacing: '0.5px'
    };
  };

  const renderProfit = (value, isWeth = false) => {
    const num = Number(value);
    const formatted = isWeth ? num.toFixed(4) : num.toFixed(2);
    const isNegative = num < 0;

    return (
      <span style={{ color: isNegative ? '#dc2626' : '#0f172a', fontWeight: isNegative ? '700' : '500' }}>
        {formatted}
      </span>
    );
  };

  const computeActiveStats = (core) => {
    let races = 0, wins = 0, blueStar = 0, yellowStar = 0, weth = 0, dez = 0;
    let matches = 0;

    if (!core.performanceLog) return { races, winRate: "0.0", blueStar: "0.0", yellowStar: "0.0", weth: 0, dez: 0 };

    core.performanceLog.forEach(node => {
      const dMatch = selectedDistance === 'All' || String(node.distance) === String(selectedDistance);
      const gMatch = selectedGate === 'All' || String(node.gate) === String(selectedGate);
      
      let fMatch = selectedFormat === 'All';
      if (!fMatch) {
        const nodeF = String(node.format).toLowerCase();
        const selF = selectedFormat.toLowerCase();
        if (selF === 'spin and go' && (nodeF.includes('spin') || nodeF.includes('go'))) fMatch = true;
        else if (selF === 'double up' && (nodeF.includes('double') || nodeF.includes('up'))) fMatch = true;
        else if (nodeF.includes(selF)) fMatch = true;
      }

      if (dMatch && gMatch && fMatch) {
        races += Number(node.races || 0);
        wins += Number(node.wins || 0);
        blueStar += Number(node.blueStar || 0);
        yellowStar += Number(node.yellowStar || 0);
        weth += Number(node.weth || 0);
        dez += Number(node.dez || 0);
        matches++;
      }
    });

    const winRate = races > 0 ? ((wins / races) * 100).toFixed(1) : "0.0";
    const finalBlue = matches > 0 ? (blueStar / matches).toFixed(1) : "0.0";
    const finalYellow = matches > 0 ? (yellowStar / matches).toFixed(1) : "0.0";

    return { races, winRate, blueStar: finalBlue, yellowStar: finalYellow, weth, dez };
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

      if (selectedGender !== 'All' && core.gender !== selectedGender.toLowerCase()) return false;
      if (selectedElement !== 'All' && String(core.element).toLowerCase() !== selectedElement.toLowerCase()) return false;
      if (selectedClass !== 'All' && String(core.coreClass).toLowerCase() !== selectedClass.toLowerCase()) return false;
      if (selectedVehicleType !== 'All' && String(core.vehicleType) !== selectedVehicleType) return false;

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

  const distances = ['All', '900', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '2100', '2200'];
  const gates = ['All', '1', '2', '3', '4', '5', '6', '7', '8', '9+'];
  const formats = ['All', '1v1', 'Spin and Go', 'Top 2', 'Double Up', 'Top 3', 'WTA'];

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#ffffff', color: '#0f172a', minHeight: '100vh' }}>
      <h2 style={{ color: '#1e3a8a', marginBottom: '4px' }}>DNA Racing Advanced Analytics</h2>
      <p style={{ color: '#64748b', marginBottom: '25px', fontWeight: '500' }}>Total Loaded Cores: {cores.length}</p>

      {/* Analytics Control Dashboard Panel */}
      <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #e2e8f0' }}>
        
        {/* RESTORED VEHICLE TYPE FILTER SORT ROW */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Vehicle Type:</span>
          {['All', 'Bike', 'Horse', 'Car'].map(vt => (
            <button key={vt} onClick={() => setSelectedVehicleType(vt)} style={filterButtonStyle(selectedVehicleType === vt)}>{vt}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Gender:</span>
          {['All', 'Male', 'Female'].map(g => (
            <button key={g} onClick={() => setSelectedGender(g)} style={filterButtonStyle(selectedGender === g)}>{g}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Element:</span>
          {['All', 'Metal', 'Fire', 'Earth', 'Water'].map(e => (
            <button key={e} onClick={() => setSelectedElement(e)} style={filterButtonStyle(selectedElement === e)}>{e}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Type Tier:</span>
          {['All', 'Genesis', 'Morph', 'Freak', 'X-Class'].map(c => (
            <button key={c} onClick={() => setSelectedClass(c)} style={filterButtonStyle(selectedClass === c)}>{c}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Distance:</span>
          {distances.map(d => (
            <button key={d} onClick={() => setSelectedDistance(d)} style={filterButtonStyle(selectedDistance === d)}>{d}</button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Gate Box:</span>
          {gates.map(g => (
            <button key={g} onClick={() => setSelectedGate(g)} style={filterButtonStyle(selectedGate === g)}>{g}</button>
          ))}
        </div>

        <div>
          <span style={{ marginRight: '15px', color: '#475569', display: 'inline-block', width: '120px', fontWeight: '600' }}>Race Format:</span>
          {formats.map(f => (
            <button key={f} onClick={() => setSelectedFormat(f)} style={filterButtonStyle(selectedFormat === f)}>{f}</button>
          ))}
        </div>
      </div>

      <input 
        type="text" 
        placeholder="Search core name or custom ID..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', maxWidth: '400px', marginBottom: '25px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
      />

      {loading ? <p style={{ color: '#2563eb', fontWeight: 'bold' }}>Parsing unique vehicle metrics...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0', color: '#1e293b' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Core Name & Details</th>
              <th onClick={() => handleSort('races')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Segment Races</th>
              <th onClick={() => handleSort('winRate')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Win %</th>
              <th onClick={() => handleSort('blueStar')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Blue Star %</th>
              <th onClick={() => handleSort('yellowStar')} style={{ padding: '14px 12px', cursor: 'pointer' }}>Yellow Star %</th>
              <th onClick={() => handleSort('weth')} style={{ padding: '14px 12px', cursor: 'pointer' }}>WETH Profit</th>
              <th onClick={() => handleSort('dez')} style={{ padding: '14px 12px', cursor: 'pointer' }}>DEZ Profit</th>
            </tr>
          </thead>
          <tbody>
            {filteredCores.map((core, i) => (
              <tr key={core.hid || i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ padding: '14px 12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>{core.name}</div>
                  <div style={{ fontSize: '11px', marginTop: '6px' }}>
                    <span style={getElementStyle(core.element)}>{core.element}</span>
                    <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '700' }}>{core.vehicleType}</span>
                    <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '3px 6px', borderRadius: '4px', marginRight: '5px', fontWeight: '600' }}>{core.fNumber}</span>
                    <span style={{ border: '1px solid #cbd5e1', color: '#475569', padding: '2px 6px', borderRadius: '4px', marginRight: '5px' }}>{core.coreClass}</span>
                    <span style={{ color: core.gender === 'male' ? '#0284c7' : '#db2777', fontWeight: '600', textTransform: 'capitalize' }}>{core.gender}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 12px', fontWeight: '500' }}>{core.calculatedStats.races}</td>
                <td style={{ padding: '14px 12px', color: '#16a34a', fontWeight: '600' }}>{core.calculatedStats.winRate}%</td>
                <td style={{ padding: '14px 12px', color: '#0284c7' }}>{core.calculatedStats.blueStar}%</td>
                <td style={{ padding: '14px 12px', color: '#d97706' }}>{core.calculatedStats.yellowStar}%</td>
                <td style={{ padding: '14px 12px' }}>{renderProfit(core.calculatedStats.weth, true)}</td>
                <td style={{ padding: '14px 12px' }}>{renderProfit(core.calculatedStats.dez, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export async function getServerSideProps() { return { props: {} }; }
