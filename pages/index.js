import { useState, useEffect } from 'react';

export default function Leaderboard() {
  const [cores, setCores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [sortKey, setSortKey] = useState('winPct');
  const [sortDir, setSortDir] = useState('desc');

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

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key) => (sortKey !== key ? '' : sortDir === 'asc' ? ' ▲' : ' ▼');

  const sortedCores = [...cores].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === 'asc' ? diff : -diff;
  });

  const sortableHeaderStyle = {
    padding: '14px 16px',
    textAlign: 'left',
    cursor: 'pointer',
    userSelect: 'none',
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '4px' }}>Bike Leaderboard — 2-Core Races</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '30px' }}>
          {updatedAt
            ? `Data last refreshed ${formatUpdatedAt(updatedAt)}`
            : (!loading && cores.length === 0)
              ? 'No cached data yet — the background refresh job may not have run yet.'
              : ''}
        </p>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '13px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Rank</th>
                <th style={{ padding: '14px 16px', textAlign: 'left' }}>Core</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('wins')}>Wins{sortArrow('wins')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('losses')}>Losses{sortArrow('losses')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('winPct')}>Win %{sortArrow('winPct')}</th>
                <th style={sortableHeaderStyle} onClick={() => handleSort('blueStarPct')}>Blue Star %{sortArrow('blueStarPct')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedCores.map((core, idx) => (
                <tr key={core.hid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontWeight: '600' }}>{idx + 1}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold' }}>
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
                  <td style={{ padding: '14px 16px', color: '#16a34a', fontWeight: '600' }}>{core.wins}</td>
                  <td style={{ padding: '14px 16px', color: '#dc2626', fontWeight: '600' }}>{core.losses}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '700' }}>{core.winPct}%</td>
                  <td style={{ padding: '14px 16px', color: '#2563eb' }}>{core.blueStarPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
