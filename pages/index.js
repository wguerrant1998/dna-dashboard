import { useState, useEffect } from 'react';

export default function MultiModeDashboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

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

  // Race Type State: which raw `format` values are toggled on (empty set = no filter / all races)
  const [activeRaceTypes, setActiveRaceTypes] = useState(new Set());

  // Field Size State: which fixed buckets are toggled on (empty set = no filter / all sizes)
  const [activeFieldSizes, setActiveFieldSizes] = useState(new Set());

  // Race Distance State: which distances (meters) are toggled on (empty set = no filter / all distances)
  const [activeDistances, setActiveDistances] = useState(new Set());

  const toggleInSet = (setter) => (value) => {
    setter(prev => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };
  const toggleRaceType = toggleInSet(setActiveRaceTypes);
  const toggleFieldSize = toggleInSet(setActiveFieldSizes);
  const toggleDistance = toggleInSet(setActiveDistances);

  useEffect(() => {
    fetch('/api/cores')
      .then(res => res.json())
      .then(data => {
        setCores(Array.isArray(data?.cores) ? data.cores : []);
        setUpdatedAt(data?.updatedAt ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Human-readable "X minutes/hours ago" from the cache's updatedAt timestamp
  const formatUpdatedAt = (iso) => {
    if (!iso) return null;
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const getElementStyle = (element) => {
    let bg = '#475569';
    if (element === 'Water') bg = '#2563eb';
    if (element === 'Fire') bg = '#ea580c';
    if (element === 'Earth') bg = '#78350f';
    return { backgroundColor: bg, color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' };
  };

  const ELEMENTS = ['All', 'Metal', 'Fire', 'Earth', 'Water'];
  const CLASSES = ['All', 'Genesis', 'Morph', 'Freak', 'X-Class'];

  // Distinct raw race-type values (`format` field) actually present in the data for the
  // active mode. Labels are just the raw value title-cased with underscores as spaces,
  // since we don't have a confirmed mapping from raw values to friendly names like "WTA" -
  // better to show the truth than guess wrong. Rename these once the mapping is confirmed.
  const availableRaceTypes = Array.from(
    new Set(
      cores.flatMap((core) => (core.modes[activeMode]?.races || []).map(r => r.format).filter(Boolean))
    )
  ).sort();

  const formatLabel = (raw) => raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Resolves the right stats block for a core based on the active mode plus whichever
  // combination of field size / distance / race type buttons are toggled on. All active
  // selections are combined together (AND across categories, OR within a category) by
  // filtering this core's raw individual race list - so any combination is real, computed
  // stats, never estimated. If nothing is toggled on, falls back to full career stats
  // (which includes blue/yellow star info that isn't tracked per individual race).
  const getStatsFor = (core) => {
    const modeData = core.modes[activeMode];
    const powerRatings = { power: modeData.power, variance: modeData.variance, adjodds: modeData.adjodds };
    const hasFilters = activeFieldSizes.size > 0 || activeDistances.size > 0 || activeRaceTypes.size > 0;

    if (!hasFilters) return { ...modeData, ...powerRatings };

    const races = modeData.races || [];
    const matched = races.filter(r => {
      if (activeFieldSizes.size > 0 && !activeFieldSizes.has(r.fieldSizeBucket)) return false;
      if (activeDistances.size > 0 && !activeDistances.has(r.distance)) return false;
      if (activeRaceTypes.size > 0 && !activeRaceTypes.has(r.format)) return false;
      return true;
    });

    const races_n = matched.length;
    const win_n = matched.filter(r => r.win).length;
    const win_p = races_n > 0 ? Number(((win_n / races_n) * 100).toFixed(2)) : 0;

    return {
      r: races_n,
      w: win_p,
      b: null, // not tracked per individual race
      y: null, // not tracked per individual race
      element: modeData.element,
      class: modeData.class,
      ...powerRatings,
    };
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

  // Distinct distances (in meters) actually present in the raw race data for the active mode,
  // sorted numerically - only shows distances your cores have actually raced at.
  const availableDistances = Array.from(
    new Set(
      cores.flatMap((core) => (core.modes[activeMode]?.races || []).map(r => r.distance).filter(d => d != null))
    )
  ).sort((a, b) => a - b);

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
        <p style={{ color: '#64748b', marginBottom: '4px' }}>
          Total Vault: {cores.length} Cores Loaded Dynamically
          {(activeFieldSizes.size > 0 || activeDistances.size > 0 || activeRaceTypes.size > 0) && (
            <> — filtered by
              {activeFieldSizes.size > 0 && <> <strong>{Array.from(activeFieldSizes).map(k => FIELD_SIZE_BUCKETS.find(b => b.key === k)?.label).join(', ')}</strong></>}
              {activeDistances.size > 0 && <> <strong>{Array.from(activeDistances).map(d => `${d}m`).join(', ')}</strong></>}
              {activeRaceTypes.size > 0 && <> <strong>{Array.from(activeRaceTypes).map(formatLabel).join(', ')}</strong></>}
            </>
          )}
        </p>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '30px' }}>
          {updatedAt
            ? `Data last refreshed ${formatUpdatedAt(updatedAt)} (background job updates this automatically)`
            : (!loading && cores.length === 0)
              ? 'No cached data yet — the background refresh job may not have run for the first time yet.'
              : ''}
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
              {FIELD_SIZE_BUCKETS.map(({ key, label }) => (
                <button key={key} style={filterButtonStyle(activeFieldSizes.has(key))} onClick={() => toggleFieldSize(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Race Distance</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableDistances.map((dist) => (
                <button key={dist} style={filterButtonStyle(activeDistances.has(dist))} onClick={() => toggleDistance(dist)}>
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
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Race Type <span style={{ textTransform: 'none', fontWeight: '400', color: '#cbd5e1' }}>(raw values - unconfirmed labels)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableRaceTypes.map((rt) => (
                <button key={rt} style={filterButtonStyle(activeRaceTypes.has(rt))} onClick={() => toggleRaceType(rt)}>
                  {formatLabel(rt)}
                </button>
              ))}
            </div>
          </div>

          {(activeFieldSizes.size > 0 || activeDistances.size > 0 || activeRaceTypes.size > 0) && (
            <div style={{ marginTop: '14px' }}>
              <button
                style={{ ...filterButtonStyle(false), borderColor: '#f87171', color: '#dc2626' }}
                onClick={() => { setActiveFieldSizes(new Set()); setActiveDistances(new Set()); setActiveRaceTypes(new Set()); }}
              >
                Clear All Filters
              </button>
            </div>
          )}
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
