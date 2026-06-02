import { useState, useRef } from "react";
import axios from "axios";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

const API = "http://127.0.0.1:8000";

const css = `
  .compare-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:36px; }
  .player-search-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:20px; }
  .search-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
  .search-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:2px;
    padding:10px 14px; color:var(--text); font-family:'Barlow',sans-serif; font-size:14px; outline:none; }
  .search-input:focus { border-color:var(--red); }
  .search-results { margin-top:6px; background:var(--surface2); border:1px solid var(--border); border-radius:2px; overflow:hidden; }
  .search-result-item { padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border); }
  .search-result-item:last-child { border-bottom:none; }
  .search-result-item:hover { background:var(--surface); color:var(--red); }
  .selected-player { margin-top:16px; padding-top:16px; border-top:1px solid var(--border); }
  .selected-name { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:700; text-transform:uppercase; }
  .selected-team { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:2px; }
  .selected-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
  .mini-stat { text-align:center; padding:8px; background:var(--surface2); border-radius:2px; }
  .mini-stat-val { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:700; }
  .mini-stat-lbl { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:24px; margin-bottom:24px; }
  .compare-bar-grid { display:grid; gap:10px; margin-bottom:36px; }
  .stat-bar-row { display:grid; grid-template-columns:60px 1fr 60px; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); }
  .stat-bar-row:last-child { border-bottom:none; }
  .stat-bar-val { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; }
  .stat-bar-val.left { text-align:right; color:var(--red); }
  .stat-bar-val.right { text-align:left; color:#4a9eff; }
  .stat-bar-track { position:relative; height:8px; background:var(--surface2); border-radius:4px; overflow:hidden; display:flex; }
  .stat-bar-fill-left { height:100%; background:var(--red); border-radius:4px 0 0 4px; margin-left:auto; }
  .stat-bar-fill-right { height:100%; background:#4a9eff; border-radius:0 4px 4px 0; }
  .stat-bar-label { text-align:center; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .compare-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .compare-name { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; text-transform:uppercase; }
  .compare-name.left { color:var(--red); }
  .compare-name.right { color:#4a9eff; }
  .loading { display:flex; align-items:center; justify-content:center; height:100px; color:var(--muted); font-size:12px; letter-spacing:2px; text-transform:uppercase; }
  .hint { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:48px; text-align:center; color:var(--muted); font-size:13px; letter-spacing:1px; margin-bottom:24px; }
  .page-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
  .page-title span { color:var(--red); }
  .page-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-bottom:32px; }
`;

const STATS = [
  { key: "avg_pts", label: "PTS", max: 35 },
  { key: "avg_reb", label: "REB", max: 15 },
  { key: "avg_ast", label: "AST", max: 12 },
  { key: "avg_stl", label: "STL", max: 3 },
  { key: "avg_blk", label: "BLK", max: 3 },
  { key: "avg_fg_pct", label: "FG%", max: 0.65, pct: true },
  { key: "avg_fg3_pct", label: "3P%", max: 0.5, pct: true },
];

function PlayerSearchCard({ color, label, onSelect, selected, loading }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const timerRef = useRef(null);

  const handleSearch = (val) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    if (val.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(() => {
      axios.get(`${API}/nba/search`, { params: { q: val } }).then(r => setResults(r.data.players));
    }, 300);
  };

  const pick = (p) => {
    setResults([]);
    setQuery(p.full_name);
    onSelect(p);
  };

  return (
    <div className="player-search-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="search-label">{label}</div>
      <input
        className="search-input"
        placeholder="Search any NBA player..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
        style={{ "--focus-color": color }}
      />
      {results.length > 0 && (
        <div className="search-results">
          {results.map(p => (
            <div key={p.id} className="search-result-item" onClick={() => pick(p)}>
              {p.full_name}
            </div>
          ))}
        </div>
      )}
      {loading && <div className="loading">Fetching stats...</div>}
      {selected && !loading && (
        <div className="selected-player">
          <div className="selected-name">{selected.player.full_name}</div>
          <div className="selected-team">{selected.player.team} · {selected.player.position}</div>
          <div className="selected-stats">
            {[["avg_pts","PTS"],["avg_reb","REB"],["avg_ast","AST"]].map(([k,l]) => (
              <div className="mini-stat" key={k}>
                <div className="mini-stat-val" style={{ color }}>{selected.averages[k]}</div>
                <div className="mini-stat-lbl">{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Compare() {
  const [p1, setP1] = useState(null);
  const [p2, setP2] = useState(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  const fetchPlayer = (nbaPlayer, setData, setLoading) => {
    setLoading(true);
    axios.get(`${API}/nba/player/${nbaPlayer.id}/stats`).then(r => {
      setData(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const bothLoaded = p1 && p2;

  const barData = bothLoaded ? STATS.map(s => ({
    stat: s.label,
    [p1.player.full_name.split(" ").pop()]: s.pct ? +(p1.averages[s.key] * 100).toFixed(1) : p1.averages[s.key],
    [p2.player.full_name.split(" ").pop()]: s.pct ? +(p2.averages[s.key] * 100).toFixed(1) : p2.averages[s.key],
  })) : [];

  const radarData = bothLoaded ? STATS.map(s => ({
    stat: s.label,
    [p1.player.full_name.split(" ").pop()]: +((p1.averages[s.key] / s.max) * 100).toFixed(1),
    [p2.player.full_name.split(" ").pop()]: +((p2.averages[s.key] / s.max) * 100).toFixed(1),
  })) : [];

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Player <span>Comparison</span></div>
      <div className="page-sub">Search any NBA player from any team · 2024–25 Season</div>

      <div className="compare-grid">
        <PlayerSearchCard color="var(--red)" label="Player 1" onSelect={p => fetchPlayer(p, setP1, setLoading1)} selected={p1} loading={loading1} />
        <PlayerSearchCard color="#4a9eff" label="Player 2" onSelect={p => fetchPlayer(p, setP2, setLoading2)} selected={p2} loading={loading2} />
      </div>

      {!bothLoaded && (
        <div className="hint">Search and select two players above to see a head-to-head comparison</div>
      )}

      {bothLoaded && (
        <>
          {/* Stat bars */}
          <div className="section-header">
            <div className="section-title">Head-to-Head</div>
            <div className="section-line" />
          </div>
          <div className="chart-card">
            <div className="compare-header">
              <div className="compare-name left">{p1.player.full_name}</div>
              <div className="compare-name right">{p2.player.full_name}</div>
            </div>
            <div className="compare-bar-grid">
              {STATS.map(s => {
                const v1 = s.pct ? p1.averages[s.key] : p1.averages[s.key];
                const v2 = s.pct ? p2.averages[s.key] : p2.averages[s.key];
                const total = (v1 || 0) + (v2 || 0);
                const pct1 = total > 0 ? ((v1 || 0) / total) * 100 : 50;
                const pct2 = 100 - pct1;
                return (
                  <div className="stat-bar-row" key={s.key}>
                    <div className="stat-bar-val left">{s.pct ? ((v1||0)*100).toFixed(1)+"%" : v1 ?? "—"}</div>
                    <div>
                      <div className="stat-bar-label" style={{ marginBottom: 4 }}>{s.label}</div>
                      <div className="stat-bar-track">
                        <div className="stat-bar-fill-left" style={{ width: `${pct1}%` }} />
                        <div className="stat-bar-fill-right" style={{ width: `${pct2}%` }} />
                      </div>
                    </div>
                    <div className="stat-bar-val right">{s.pct ? ((v2||0)*100).toFixed(1)+"%" : v2 ?? "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar chart */}
          <div className="section-header">
            <div className="section-title">Stat Breakdown</div>
            <div className="section-line" />
          </div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="stat" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: 4, fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 11, letterSpacing: 1 }} />
                <Bar dataKey={p1.player.full_name.split(" ").pop()} fill="#CE1141" radius={[2,2,0,0]} />
                <Bar dataKey={p2.player.full_name.split(" ").pop()} fill="#4a9eff" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar */}
          <div className="section-header">
            <div className="section-title">Skill Radar</div>
            <div className="section-line" />
          </div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#222" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: "#666", fontSize: 11 }} />
                <Radar name={p1.player.full_name.split(" ").pop()} dataKey={p1.player.full_name.split(" ").pop()} stroke="#CE1141" fill="#CE1141" fillOpacity={0.15} strokeWidth={2} />
                <Radar name={p2.player.full_name.split(" ").pop()} dataKey={p2.player.full_name.split(" ").pop()} stroke="#4a9eff" fill="#4a9eff" fillOpacity={0.15} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
