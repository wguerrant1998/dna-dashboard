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

  // Sort State
  const [sortKey, setSortKey] = useState(null); // 'r' | 'w' | 'b' | 'y'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  // Race Type State: 'career' (overall) or a payouts_data key like 'wta', '1v1', 'top2', 'dblup', 'spin_n_go'
  const [activeRaceType, setActiveRaceType] = useState('career');

  // Field Size (Gate Number) State: 'all' or a specific rgate value like '3', '4', '5'
  const [activeFieldSize, setActiveFieldSize] = useState('all');

  // Race Distance State: 'all' or a specific distance in meters, e.g. 900, 1000, ... 2300
  const [activeDistance, setActiveDistance] = useState('all');

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

  const ELEMENTS = ['All', 'Metal', 'Fire', 'Earth', 'Water'];
  const CLASSES = ['All', 'Genesis', 'Morph', 'Freak', 'X-Class'];

  // Race type buttons: 'career' shows overall stats, others pull from modes[mode].raceTypes[key]
  const RACE_TYPES = [
    { key: 'career', label: 'All Races' },
    { key: 'wta', label: 'WTA' },
    { key: '1v1', label: '1v1' },
    { key: 'top2', label: 'Top 2' },
    { key: 'top3', label: 'Top 3' },
    { key: 'dblup', label: 'Double Up' },
    { key: 'spin_n_go', label: 'Spin & Go' },
  ];

  // Resolves the right stats block for a core based on the active mode, plus whichever single
  // breakdown is selected (field size, distance, or race type). These are separate breakdowns
  // in the data with no combined intersection available, so only one applies at a time -
  // selecting one resets the others (see the button onClick handlers below).
  // Falls back to zeroed stats if a core has no data for that slice (real absence, not simulated).
  const getStatsFor = (core) => {
    const modeData = core.modes[activeMode];
    const powerRatings = { power: modeData.power, variance: modeData.variance, adjodds: modeData.adjodds };

    if (activeFieldSize !== 'all') {
      const fs = modeData.fieldSize?.[activeFieldSize];
      return fs
        ? { r: fs.r, w: fs.w, b: null, y: null, element: modeData.element, class: modeData.class, ...powerRatings }
        : { r: 0, w: 0, b: null, y: null, element: modeData.element, class: modeData.class, ...powerRatings };
    }

    if (activeDistance !== 'all') {
      const d = modeData.distances?.[activeDistance];
      return d
        ? { ...d, element: modeData.element, class: modeData.class, ...powerRatings }
        : { r: 0, w: 0, b: 0, y: 0, element: modeData.element, class: modeData.class, ...powerRatings };
    }

    if (activeRaceType === 'career') return modeData;

    const rt = modeData.raceTypes?.[activeRaceType];
    return rt
      ? { ...rt, element: modeData.element, class: modeData.class, ...powerRatings }
      : { r: 0, w: 0, b: 0, y: 0, element: modeData.element, class: modeData.class, ...powerRatings };
  };

  // Fixed field-size buckets - always shown regardless of what's in the data,
  // matching the buckets computed server-side in cores.js.
  const FIELD_SIZE_BUCKETS = [
    { key: '2', label: '2 Cores' },
    { key: '3', label: '3 Cores' },
    { key: '4', label: '4 Cores' },
    { key: '5', label: '5 Cores' },
    { key: '6', label: '6 Cores' },
    { key: '7+', label: '7+ Cores' },
  ];

  // Distinct distances (in meters) actually present in the data for the active mode,
  // sorted numerically - only shows distances your cores have actually raced at.
  const availableDistances = Array.from(
    new Set(
      cores.flatMap((core) => Object.keys(core.modes[activeMode]?.distances || {}))
    )
  ).sort((a, b) => Number(a) - Number(b));

  const filterButtonStyle = (isActive) => ({
    padding: '8px 16px',
    borderRadius: '6px',
    border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
    backgroundColor: isActive ? '#2563eb' : '#ffffff',
    color: isActive ? '#ffffff' : '#475569',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  // Process and filter cores based on the active mode attributes
  const filteredCores = cores.filter(core => {
    const modeData = core.modes[activeMode]; // element/class filters always reflect the vehicle mode, not race type
    const activeStats = getStatsFor(core);

    // Text search
    const nameMatch = core.name.toLowerCase().includes(search.toLowerCase()) || String(core.hid).includes(search);
    if (!nameMatch) return false;

    // Element & Class filters tied directly to the active vehicle configuration
    if (selectedElement !== 'All' && modeData.element !== selectedElement) return false;
    if (selectedClass !== 'All' && modeData.class !== selectedClass) return false;

    // Hide setups with no races logged for the current mode + race type combo
    if (hideZeroRaces && activeStats.r === 0) return false;

    return true;
  });

  // Apply sort on top of the filtered set
  const sortedCores = sortKey
    ? [...filteredCores].sort((a, b) => {
        const aVal = getStatsFor(a)[sortKey];
        const bVal = getStatsFor(b)[sortKey];
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      })
    : filteredCores;

  const handleSort = (key) => {
    if (sortKey === key) {
      // Same column clicked again: flip direction
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // New column: default to descending (highest first)
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const sortableHeaderStyle = { padding: '16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' };

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
        <p style={{ color: '#64748b', marginBottom: '30px' }}>
          Total Vault: {cores.length} Cores Loaded Dynamically
          {activeFieldSize !== 'all' && <> — showing <strong>{FIELD_SIZE_BUCKETS.find(b => b.key === activeFieldSize)?.label}</strong> stats</>}
          {activeFieldSize === 'all' && activeDistance !== 'all' && <> — showing <strong>{activeDistance}m</strong> stats</>}
          {activeFieldSize === 'all' && activeDistance === 'all' && activeRaceType !== 'career' && <> — showing <strong>{RACE_TYPES.find(rt => rt.key === activeRaceType)?.label}</strong> stats</>}
        </p>

        {/* TOP LEVEL MODE SELECTOR TABS */}
        <div style={{ display: 'flex', borderBottom: '2px solid #cbd5e1' }}>
          <button style={tabStyle('bike')} onClick={() => { setActiveMode('bike'); setSelectedElement('All'); setSelectedClass('All'); }}>🏍️ BIKE PERFORMANCE MODE</button>
          <button style={tabStyle('horse')} onClick={() => { setActiveMode('horse'); setSelectedElement('All'); setSelectedClass('All'); }}>🐎 HORSE PERFORMANCE MODE</button>
          <button style={tabStyle('car')} onClick={() => { setActiveMode('car'); setSelectedElement('All'); setSelectedClass('All'); }}>🚗 CAR PERFORMANCE MODE</button>
        </div>

        {/* DYNAMIC FILTER DECK */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '0', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <input type="text" placeholder="Search Core Name / ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '240px' }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideZeroRaces} onChange={(e) => setHideZeroRaces(e.target.checked)} />
            Hide Unraced Cores in this Mode
          </label>
        </div>

        {/* BUTTON-BASED SORT BOARD */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', marginBottom: '25px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Field Size (Cores in Race)</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={filterButtonStyle(activeFieldSize === 'all')} onClick={() => setActiveFieldSize('all')}>
                All Sizes
              </button>
              {FIELD_SIZE_BUCKETS.map(({ key, label }) => (
                <button
                  key={key}
                  style={filterButtonStyle(activeFieldSize === key)}
                  onClick={() => { setActiveFieldSize(key); setActiveDistance('all'); setActiveRaceType('career'); }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Race Distance</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button style={filterButtonStyle(activeDistance === 'all')} onClick={() => setActiveDistance('all')}>
                All Distances
              </button>
              {availableDistances.map((dist) => (
                <button
                  key={dist}
                  style={filterButtonStyle(activeDistance === dist)}
                  onClick={() => { setActiveDistance(dist); setActiveFieldSize('all'); setActiveRaceType('career'); }}
                >
                  {dist}m
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Element</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ELEMENTS.map((el) => (
                <button key={el} style={filterButtonStyle(selectedElement === el)} onClick={() => setSelectedElement(el)}>
                  {el}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Tier Class</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CLASSES.map((cls) => (
                <button key={cls} style={filterButtonStyle(selectedClass === cls)} onClick={() => setSelectedClass(cls)}>
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Race Type</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {RACE_TYPES.map((rt) => (
                <button
                  key={rt.key}
                  style={filterButtonStyle(activeRaceType === rt.key)}
                  onClick={() => { setActiveRaceType(rt.key); setActiveFieldSize('all'); setActiveDistance('all'); }}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TRACK DATA METRIC GRID */}
        {loading ? <p>Recompiling multi-mode log arrays...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px', textAlign: 'left' }}>Core Configuration</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Mode Element</th>
                <th style={{ padding: '16px', textAlign: 'left' }}>Mode Tier Class</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('r')}>Mode Total Races{sortArrow('r')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('w')}>Win Pct{sortArrow('w')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('b')}>Blue Star Info{sortArrow('b')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('y')}>Yellow Star Info{sortArrow('y')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('power')}>PWR{sortArrow('power')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('variance')}>VAR{sortArrow('variance')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('adjodds')}>ADJ{sortArrow('adjodds')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedCores.map((core) => {
                const currentStats = getStatsFor(core);
                return (
                  <tr key={core.hid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>
                      <a
                        href={`https://fbike.dnaracing.run/core/${core.hid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1e293b', textDecoration: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {core.name} <span style={{ color: '#94a3b8', fontWeight: '400' }}>#{core.hid}</span>
                      </a>
                    </td>
                    <td style={{ padding: '16px' }}><span style={getElementStyle(currentStats.element)}>{currentStats.element}</span></td>
                    <td style={{ padding: '16px' }}><span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>{currentStats.class}</span></td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{currentStats.r}</td>
                    <td style={{ padding: '16px', color: currentStats.r > 0 ? '#16a34a' : '#94a3b8', fontWeight: '700' }}>{currentStats.w}%</td>
                    <td style={{ padding: '16px', color: '#2563eb' }}>{currentStats.b != null ? `${currentStats.b}%` : '—'}</td>
                    <td style={{ padding: '16px', color: '#d97706' }}>{currentStats.y != null ? `${currentStats.y}%` : '—'}</td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{currentStats.power != null ? currentStats.power : '—'}</td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{currentStats.variance != null ? currentStats.variance : '—'}</td>
                    <td style={{ padding: '16px', fontWeight: '600' }}>{currentStats.adjodds != null ? currentStats.adjodds : '—'}</td>
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
