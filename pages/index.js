import { useState, useEffect } from 'react';

export default function MultiModeDashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Discipline Mode State: 'bike' | 'horse' | 'car'
  const [activeMode, setActiveMode] = useState('bike');

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedElement, setSelectedElement] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [hideZeroRaces, setHideZeroRaces] = useState(false);

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
      .then(data => {
        setCores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getElementStyle = (element) => {
    let bg = '#475569';
    if (element === 'Water') bg = '#2563eb';
    if (element === 'Fire') bg = '#ea580c';
    if (element === 'Earth') bg = '#78350f';
    return { backgroundColor: bg, color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' };
  };

  // Process and filter cores based on the active mode attributes
  const filteredCores = cores.filter(core => {
    const modeData = core.modes[activeMode];
    
    // Text search
    const nameMatch = core.name.toLowerCase().includes(search.toLowerCase()) || String(core.hid).includes(search);
    if (!nameMatch) return false;

    // Element & Class filters tied directly to the active vehicle configuration
    if (selectedElement !== 'All' && modeData.element !== selectedElement) return false;
    if (selectedClass !== 'All' && modeData.class !== selectedClass) return false;
    
    // Hide unused mode setups
    if (hideZeroRaces && modeData.r === 0) return false;

    return true;
  });

  const tabStyle = (mode) => ({
    padding: '14px 28px', marginRight: '10px', fontSize: '16px', fontWeight: '700',
    borderRadius: '8px 8px 0 0', cursor: 'pointer', border: '1px solid #e2e8f0', borderBottom: 'none',
    backgroundColor: activeMode === mode ? '#ffffff' : '#e2e8f0',
    color: activeMode === mode ? '#2563eb' : '#64748b',
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <h2>DNA Racing Collection Matrix</h2>
        <p style={{ color: '#64748b', marginBottom: '30px' }}>Total Vault: {cores.length} Cores Loaded Dynamically</p>

        {/* TOP LEVEL MODE SELECTOR TABS */}
        <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1' }}>
          <button style={tabStyle('bike')} onClick={() => { setActiveMode('bike'); setSelectedElement('All'); setSelectedClass('All'); }}>🏍️ BIKE PERFORMANCE MODE</button>
          <button style={tabStyle('horse')} onClick={() => { setActiveMode('horse'); setSelectedElement('All'); setSelectedClass('All'); }}>🐎 HORSE PERFORMANCE MODE</button>
          <button style={tabStyle('car')} onClick={() => { setActiveMode('car'); setSelectedElement('All'); setSelectedClass('All'); }}>🚗 CAR PERFORMANCE MODE</button>
        </div>

        {/* DYNAMIC FILTER DECK */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <input type="text" placeholder="Search Core Name / ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '240px' }} />
          
          <select value={selectedElement} onChange={(e) => setSelectedElement(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '600' }}>
            <option value="All">All Elements</option>
            <option value="Metal">Metal</option>
            <option value="Fire">Fire</option>
            <option value="Earth">Earth</option>
            <option value="Water">Water</option>
          </select>

          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '600' }}>
            <option value="All">All Tier Classes</option>
            <option value="Genesis">Genesis</option>
            <option value="Morph">Morph</option>
            <option value="Freak">Freak</option>
            <option value="X-Class">X-Class</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideZeroRaces} onChange={(e) => setHideZeroRaces(e.target.checked)} />
            Hide Unraced Cores in this Mode
          </label>
        </div>

        {/* TRACK DATA METRIC GRID */}
        {loading ? <p>Recompiling multi-mode log arrays...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px', textAlign: 'left' }}>Core Configuration</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Mode Element</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Mode Tier Class</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Mode Total Races</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Win Pct</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Blue Star Info</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Yellow Star Info</th>
              </tr>
            </thead>
            <tbody>
              {filteredCores.map((core) => {
                const currentStats = core.modes[activeMode];
                return (
                  <tr key={core.hid} style={{ borderBottom: '1px solid #f1f5f9', hover: { backgroundColor: '#f8fafc' } }}>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>{core.name} <span style={{ color: '#94a3b8', fontWeight: '400' }}>#{core.hid}</span></td>
                    <td style={{ padding: '16px' }}><span style={getElementStyle(currentStats.element)}>{currentStats.element}</span></td>
                    <td style={{ padding: '16px' }}><span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>{currentStats.class}</span></td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{currentStats.r}</td>
                    <td style={{ padding: '16px', color: currentStats.r > 0 ? '#16a34a' : '#94a3b8', fontWeight: '700' }}>{currentStats.w}%</td>
                    <td style={{ padding: '16px', color: '#2563eb' }}>{currentStats.b}%</td>
                    <td style={{ padding: '16px', color: '#d97706' }}>{currentStats.y}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
