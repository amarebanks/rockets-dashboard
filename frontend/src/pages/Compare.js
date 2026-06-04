import { useState, useRef } from "react";
import axios from "axios";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import ShotChart from "../components/ShotChart";
import { seasonLabel } from "../season";
import { accTier } from "../accoladeStyle";

const API = "http://127.0.0.1:8000";

// Headshots are proxied through the backend (NBA's CDN blocks cross-origin browser loads)
const headshot = (id) => `${API}/headshot/${id}`;

const css = `
  .compare-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
  .player-search-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px; }
  .search-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
  .search-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px;
    padding:10px 14px; color:var(--text); font-family:var(--body); font-size:14px; outline:none; }
  .search-input:focus { border-color:var(--red); }
  .search-results { margin-top:6px; background:var(--surface2); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .search-result-item { padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border); }
  .search-result-item:last-child { border-bottom:none; }
  .search-result-item:hover { background:var(--surface); color:var(--red); }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:var(--display); font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:24px; margin-bottom:24px; }

  /* Hero comparison band */
  .vs-band { display:grid; grid-template-columns:1fr auto 1fr; gap:16px; align-items:center;
    background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:24px; margin-bottom:28px; }
  .vs-side { display:flex; flex-direction:column; align-items:center; text-align:center; }
  .vs-side.left { border-top:3px solid var(--red); }
  .vs-headshot { width:140px; height:102px; object-fit:cover; object-position:top center; border-radius:10px;
    background:var(--surface2); border:1px solid var(--border); }
  .vs-name { font-family:var(--display); font-size:26px; font-weight:600; line-height:1; margin-top:12px; }
  .vs-team { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:4px; }
  .vs-badge { display:inline-block; font-size:9px; letter-spacing:1px; text-transform:uppercase; padding:3px 8px;
    border-radius:8px; margin-top:8px; font-weight:700; }
  .vs-badge.allstar { background:var(--gold); color:#000; }
  .vs-badge.cornerstone { background:linear-gradient(135deg,#f97316,#fbbf24); color:#000; }
  .vs-accolades { display:flex; flex-wrap:wrap; gap:5px; justify-content:center; margin-top:9px; max-width:230px; }
  .acc-badge { font-size:9px; letter-spacing:0.5px; text-transform:uppercase; padding:3px 8px; border-radius:8px; font-weight:700; white-space:nowrap; }
  .acc-badge.tier-award  { background:linear-gradient(135deg,#f97316,#fbbf24); color:#000; }
  .acc-badge.tier-first  { background:var(--gold); color:#000; }
  .acc-badge.tier-second { background:#c0c5ce; color:#000; }
  .acc-badge.tier-third  { background:#b08d57; color:#000; }
  .acc-badge.tier-allstar{ background:rgba(74,158,255,0.18); color:#4a9eff; border:1px solid rgba(74,158,255,0.4); }
  .acc-badge.tier-hm     { background:var(--surface2); color:var(--muted); border:1px solid var(--border); }
  .vs-mini { display:flex; gap:14px; margin-top:12px; }
  .vs-mini-item { text-align:center; }
  .vs-mini-val { font-family:var(--display); font-size:22px; font-weight:700; }
  .vs-mini-lbl { font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }
  .vs-divider { font-family:var(--display); font-size:28px; font-weight:600; color:var(--border); }

  /* Stat comparison bars */
  .compare-bar-grid { display:grid; gap:10px; }
  .stat-bar-row { display:grid; grid-template-columns:64px 1fr 64px; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); }
  .stat-bar-row:last-child { border-bottom:none; }
  .stat-bar-val { font-family:var(--display); font-size:22px; font-weight:700; color:var(--muted); }
  .stat-bar-val.left { text-align:right; }
  .stat-bar-val.right { text-align:left; }
  .stat-bar-val.win-left { color:var(--red); }
  .stat-bar-val.win-right { color:#4a9eff; }
  .stat-bar-track { position:relative; height:8px; background:var(--surface2); border-radius:10px; overflow:hidden; display:flex; }
  .stat-bar-fill-left { height:100%; background:var(--red); border-radius:10px 0 0 4px; margin-left:auto; opacity:0.85; }
  .stat-bar-fill-right { height:100%; background:#4a9eff; border-radius:0 4px 4px 0; opacity:0.85; }
  .stat-bar-label { text-align:center; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }

  .compare-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
  .compare-name { font-family:var(--display); font-size:18px; font-weight:700; text-transform:uppercase; }
  .compare-name.left { color:var(--red); }
  .compare-name.right { color:#4a9eff; }
  .shotchart-compare { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .loading { display:flex; align-items:center; justify-content:center; height:100px; color:var(--muted); font-size:12px; letter-spacing:2px; text-transform:uppercase; }
  .hint { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:48px; text-align:center; color:var(--muted); font-size:13px; letter-spacing:1px; margin-bottom:24px; }
  .page-title { font-family:var(--display); font-size:36px; font-weight:600; letter-spacing: -0.01em; margin-bottom:4px; }
  .page-title span { color:var(--red); }
  .page-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-bottom:32px; }
  @media (max-width:700px) { .compare-grid, .shotchart-compare { grid-template-columns:1fr; } }
`;

const STATS = [
  { key: "avg_pts", label: "PTS", max: 35 },
  { key: "avg_reb", label: "REB", max: 15 },
  { key: "avg_ast", label: "AST", max: 12 },
  { key: "avg_stl", label: "STL", max: 3 },
  { key: "avg_blk", label: "BLK", max: 3 },
  { key: "avg_min", label: "MPG", max: 40 },
  { key: "avg_fg_pct", label: "FG%", max: 0.65, pct: true },
  { key: "avg_fg3_pct", label: "3P%", max: 0.5, pct: true },
];

// Per-36-minute stats (from /nba/player/{id}/stats → per36). TOV: lower is better.
const PER36 = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV", lowerBetter: true },
];

// Advanced stats from /players/{id}/advanced. Values arrive on a 0–100 scale
// for rate stats and 100+ scale for ratings. lowerBetter flips the winner test.
const ADV_STATS = [
  { key: "usg_pct", label: "USG%", suffix: "%" },
  { key: "ts_pct",  label: "TS%",  suffix: "%" },
  { key: "efg_pct", label: "eFG%", suffix: "%" },
  { key: "off_rtg", label: "ORtg" },
  { key: "def_rtg", label: "DRtg", lowerBetter: true },
  { key: "net_rtg", label: "NET" },
  { key: "pie",     label: "PIE",  suffix: "%" },
  { key: "ast_pct", label: "AST%", suffix: "%" },
  { key: "reb_pct", label: "REB%", suffix: "%" },
];

function Badge({ player }) {
  const list = player && player.accolades && player.accolades.length ? player.accolades : null;
  if (list) {
    return (
      <div className="vs-accolades">
        {list.map((a, i) => <span key={i} className={"acc-badge " + accTier(a)}>{a}</span>)}
      </div>
    );
  }
  if (player.is_cornerstone) return <span className="vs-badge cornerstone">★ {player.accolade}</span>;
  if (player.is_allstar)     return <span className="vs-badge allstar">★ {player.accolade}</span>;
  return null;
}

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
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)", display:"flex", gap:12, alignItems:"center" }}>
          <img
            src={headshot(selected.nbaId)}
            alt={selected.player.full_name}
            style={{ width:70, height:51, objectFit:"cover", objectPosition:"top center", borderRadius:3, background:"var(--surface2)", border:"1px solid var(--border)" }}
            onError={e => { e.target.style.opacity = 0.12; }}
          />
          <div>
            <div style={{ fontFamily:"var(--display)", fontSize:22, fontWeight:700, textTransform:"uppercase", lineHeight:1 }}>{selected.player.full_name}</div>
            <div style={{ fontSize:11, letterSpacing:1, color:"var(--muted)", marginTop:3 }}>{selected.player.team} · {selected.player.position}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tooltip for the normalized bar chart - shows real per-game values, not the
// 0–100 scaled bar heights.
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const suffix = d.pct ? "%" : "";
  return (
    <div style={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:4, padding:"10px 14px", fontSize:13 }}>
      <div style={{ color:"#666", fontSize:11, marginBottom:6 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color }}>
          {entry.name}: <b>{i === 0 ? d.raw1 : d.raw2}{suffix}</b>
        </div>
      ))}
    </div>
  );
};

const fmtAdv = (v, suffix) => (v === null || v === undefined) ? "-" : `${v}${suffix || ""}`;
const advWinner = (v1, v2, lowerBetter) => {
  if (v1 == null || v2 == null || v1 === v2) return 0;
  const oneBetter = lowerBetter ? v1 < v2 : v1 > v2;
  return oneBetter ? 1 : 2;
};

export default function Compare() {
  const [p1, setP1] = useState(null);
  const [p2, setP2] = useState(null);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  const fetchPlayer = (nbaPlayer, setData, setLoading) => {
    setLoading(true);
    // Basic stats + advanced stats in parallel. Advanced is best-effort.
    Promise.all([
      axios.get(`${API}/nba/player/${nbaPlayer.id}/stats`),
      axios.get(`${API}/players/${nbaPlayer.id}/advanced`).catch(() => ({ data: null })),
    ]).then(([statsRes, advRes]) => {
      setData({ ...statsRes.data, nbaId: nbaPlayer.id, adv: advRes.data });
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const bothLoaded = p1 && p2;
  const name1 = p1 ? p1.player.full_name.split(" ").pop() : "";
  const name2 = p2 ? p2.player.full_name.split(" ").pop() : "";

  // Bars are scaled to each stat's benchmark (s.max) so low-volume stats like
  // STL/BLK are just as visible as PTS or FG%. Real values live in the tooltip.
  const barData = bothLoaded ? STATS.map(s => {
    const raw1 = p1.averages[s.key] ?? 0;
    const raw2 = p2.averages[s.key] ?? 0;
    return {
      stat: s.label,
      pct: !!s.pct,
      [name1]: +Math.min((raw1 / s.max) * 100, 100).toFixed(1),
      [name2]: +Math.min((raw2 / s.max) * 100, 100).toFixed(1),
      raw1: s.pct ? +(raw1 * 100).toFixed(1) : raw1,
      raw2: s.pct ? +(raw2 * 100).toFixed(1) : raw2,
    };
  }) : [];

  const radarData = bothLoaded ? STATS.map(s => ({
    stat: s.label,
    [name1]: +((p1.averages[s.key] / s.max) * 100).toFixed(1),
    [name2]: +((p2.averages[s.key] / s.max) * 100).toFixed(1),
  })) : [];

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Player <span>Comparison</span></div>
      <div className="page-sub">Search any NBA player from any team · {seasonLabel()} Season</div>

      <div className="compare-grid">
        <PlayerSearchCard color="var(--red)" label="Player 1" onSelect={p => fetchPlayer(p, setP1, setLoading1)} selected={p1} loading={loading1} />
        <PlayerSearchCard color="#4a9eff" label="Player 2" onSelect={p => fetchPlayer(p, setP2, setLoading2)} selected={p2} loading={loading2} />
      </div>

      {!bothLoaded && (
        <div className="hint">Search and select two players above to see a head-to-head comparison</div>
      )}

      {bothLoaded && (
        <>
          {/* Hero band: headshots + accolades */}
          <div className="vs-band">
            {[{ p: p1, color: "var(--red)" }, null, { p: p2, color: "#4a9eff" }].map((col, i) =>
              col === null ? (
                <div className="vs-divider" key="div">VS</div>
              ) : (
                <div className="vs-side" key={i} style={{ borderTop: `3px solid ${col.color}`, paddingTop: 16 }}>
                  <img
                    className="vs-headshot"
                    src={headshot(col.p.nbaId)}
                    alt={col.p.player.full_name}
                    onError={e => { e.target.style.opacity = 0.12; }}
                  />
                  <div className="vs-name" style={{ color: col.color }}>{col.p.player.full_name}</div>
                  <div className="vs-team">{col.p.player.team} · {col.p.player.position}</div>
                  <Badge player={col.p.player} />
                  <div className="vs-mini">
                    {[["avg_pts","PTS"],["avg_reb","REB"],["avg_ast","AST"]].map(([k,l]) => (
                      <div className="vs-mini-item" key={k}>
                        <div className="vs-mini-val" style={{ color: col.color }}>{col.p.averages[k]}</div>
                        <div className="vs-mini-lbl">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Basic stat bars */}
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
                const v1 = p1.averages[s.key];
                const v2 = p2.averages[s.key];
                const total = (v1 || 0) + (v2 || 0);
                const pct1 = total > 0 ? ((v1 || 0) / total) * 100 : 50;
                const win = advWinner(v1, v2, false);
                return (
                  <div className="stat-bar-row" key={s.key}>
                    <div className={`stat-bar-val left ${win===1?"win-left":""}`}>{s.pct ? ((v1||0)*100).toFixed(1)+"%" : v1 ?? "-"}</div>
                    <div>
                      <div className="stat-bar-label" style={{ marginBottom: 4 }}>{s.label}</div>
                      <div className="stat-bar-track">
                        <div className="stat-bar-fill-left" style={{ width: `${pct1}%` }} />
                        <div className="stat-bar-fill-right" style={{ width: `${100-pct1}%` }} />
                      </div>
                    </div>
                    <div className={`stat-bar-val right ${win===2?"win-right":""}`}>{s.pct ? ((v2||0)*100).toFixed(1)+"%" : v2 ?? "-"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per 36 minutes */}
          <div className="section-header">
            <div className="section-title">Per 36 Minutes</div>
            <div className="section-line" />
          </div>
          <div className="chart-card">
            <div className="compare-header">
              <div className="compare-name left">{p1.player.full_name}</div>
              <div className="compare-name right">{p2.player.full_name}</div>
            </div>
            {(p1.per36 && p2.per36) ? (
              <div className="compare-bar-grid">
                {PER36.map(s => {
                  const v1 = p1.per36[s.key];
                  const v2 = p2.per36[s.key];
                  const total = (v1 || 0) + (v2 || 0);
                  const raw = total > 0 ? ((v1 || 0) / total) * 100 : 50;
                  const pct1 = s.lowerBetter ? 100 - raw : raw; // better side shows larger
                  const win = advWinner(v1, v2, s.lowerBetter);
                  return (
                    <div className="stat-bar-row" key={s.key}>
                      <div className={`stat-bar-val left ${win===1?"win-left":""}`}>{v1 ?? "-"}</div>
                      <div>
                        <div className="stat-bar-label" style={{ marginBottom: 4 }}>
                          {s.label}{s.lowerBetter ? " ▼" : ""}
                        </div>
                        <div className="stat-bar-track">
                          <div className="stat-bar-fill-left" style={{ width: `${pct1}%` }} />
                          <div className="stat-bar-fill-right" style={{ width: `${100-pct1}%` }} />
                        </div>
                      </div>
                      <div className={`stat-bar-val right ${win===2?"win-right":""}`}>{v2 ?? "-"}</div>
                    </div>
                  );
                })}
                <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, marginTop:6 }}>
                  Production normalized to 36 minutes - levels the field for players with different roles ·  ▼ lower is better
                </div>
              </div>
            ) : (
              <div className="loading">Per-36 stats unavailable</div>
            )}
          </div>

          {/* Advanced stats */}
          <div className="section-header">
            <div className="section-title">Advanced Stats</div>
            <div className="section-line" />
          </div>
          <div className="chart-card">
            <div className="compare-header">
              <div className="compare-name left">{p1.player.full_name}</div>
              <div className="compare-name right">{p2.player.full_name}</div>
            </div>
            {(p1.adv && p2.adv) ? (
              <div className="compare-bar-grid">
                {ADV_STATS.map(s => {
                  const v1 = p1.adv[s.key];
                  const v2 = p2.adv[s.key];
                  const win = advWinner(v1, v2, s.lowerBetter);
                  // Proportional bar only when both values are positive (ratings/rates).
                  const safe = typeof v1 === "number" && typeof v2 === "number" && v1 > 0 && v2 > 0;
                  let pct1 = 50;
                  if (safe) {
                    const raw = (v1 / (v1 + v2)) * 100;
                    pct1 = s.lowerBetter ? 100 - raw : raw; // flip so the better side shows larger
                  }
                  return (
                    <div className="stat-bar-row" key={s.key}>
                      <div className={`stat-bar-val left ${win===1?"win-left":""}`}>{fmtAdv(v1, s.suffix)}</div>
                      <div>
                        <div className="stat-bar-label" style={{ marginBottom: 4 }}>
                          {s.label}{s.lowerBetter ? " ▼" : ""}
                        </div>
                        <div className="stat-bar-track">
                          <div className="stat-bar-fill-left" style={{ width: `${pct1}%` }} />
                          <div className="stat-bar-fill-right" style={{ width: `${100-pct1}%` }} />
                        </div>
                      </div>
                      <div className={`stat-bar-val right ${win===2?"win-right":""}`}>{fmtAdv(v2, s.suffix)}</div>
                    </div>
                  );
                })}
                <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, marginTop:6 }}>
                  ▼ lower is better · bar width reflects the stronger side
                </div>
              </div>
            ) : (
              <div className="loading">Advanced stats unavailable for one or both players</div>
            )}
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
                <Radar name={name1} dataKey={name1} stroke="#CE1141" fill="#CE1141" fillOpacity={0.15} strokeWidth={2} />
                <Radar name={name2} dataKey={name2} stroke="#4a9eff" fill="#4a9eff" fillOpacity={0.15} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
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
                <YAxis domain={[0, 100]} tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<BarTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, letterSpacing: 1 }} />
                <Bar dataKey={name1} fill="#CE1141" radius={[2,2,0,0]} />
                <Bar dataKey={name2} fill="#4a9eff" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, marginTop:8, textAlign:"center" }}>
              Each stat scaled to an elite benchmark so all categories are comparable · hover for actual values
            </div>
          </div>

          {/* Shot charts side by side */}
          <div className="section-header">
            <div className="section-title">Shot Charts</div>
            <div className="section-line" />
          </div>
          <div className="shotchart-compare">
            <ShotChart playerId={p1.nbaId} playerName={p1.player.full_name} live />
            <ShotChart playerId={p2.nbaId} playerName={p2.player.full_name} live />
          </div>
        </>
      )}
    </div>
  );
}
