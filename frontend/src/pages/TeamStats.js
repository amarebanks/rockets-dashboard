import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .ts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:36px; }
  .ts-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:18px; position:relative; overflow:hidden; }
  .ts-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
  .ts-value { font-family:var(--display); font-size:38px; font-weight:700; line-height:1; }
  .ts-value.red { color:var(--red); }
  .ts-value.gold { color:var(--gold); }
  .ts-value.green { color:var(--green); }
  .ts-sub { font-size:11px; color:var(--muted); margin-top:3px; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:var(--display); font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:24px; margin-bottom:24px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:36px; }
  .zone-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
  .zone-row:last-child { border-bottom:none; }
  .zone-name { font-size:12px; flex:1; }
  .zone-bar-wrap { width:100px; height:6px; background:var(--surface2); border-radius:3px; overflow:hidden; }
  .zone-bar { height:100%; border-radius:3px; }
  .zone-pct { font-family:var(--display); font-size:18px; font-weight:700; width:44px; text-align:right; }
  .zone-att { font-size:11px; color:var(--muted); width:40px; text-align:right; }
  .splits-rings { display:flex; justify-content:space-around; align-items:center; flex-wrap:wrap; gap:12px; padding:8px 0 4px; }
  .ring-wrap { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .ring-svg { transform:rotate(-90deg); }
  .ring-center { font-family:var(--display); font-weight:700; }
  .ring-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .splits-foot { display:flex; justify-content:space-around; border-top:1px solid var(--border); margin-top:14px; padding-top:14px; }
  .splits-foot-item { text-align:center; }
  .splits-foot-val { font-family:var(--display); font-size:26px; font-weight:700; line-height:1; }
  .splits-foot-lbl { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:4px; }
  .sc-table { width:100%; border-collapse:collapse; font-size:13px; }
  .sc-table th { padding:9px 12px; text-align:left; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); font-weight:500; border-bottom:1px solid var(--border); }
  .sc-table th.num, .sc-table td.num { text-align:right; }
  .sc-table td { padding:11px 12px; border-bottom:1px solid var(--border); }
  .sc-table tr:last-child td { border-bottom:none; }
  .sc-cat { font-weight:600; }
  .sc-num { font-family:var(--display); font-size:18px; font-weight:700; }
  .sc-freq { font-size:11px; color:var(--muted); }
  .sc-delta { font-family:var(--display); font-size:16px; font-weight:700; }
  .sc-legend { display:flex; gap:16px; justify-content:flex-end; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
  .sc-legend-dot { display:inline-block; width:9px; height:9px; border-radius:8px; margin-right:5px; vertical-align:middle; }
  .toggle-wrap { display:flex; gap:8px; margin-bottom:28px; }
  .toggle-btn { font-family:var(--display); font-size:11px; letter-spacing:2px; text-transform:uppercase;
    padding:7px 18px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; }
  .toggle-btn.active { background:var(--red); border-color:var(--red); color:#fff; }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .page-title { font-family:var(--display); font-size:36px; font-weight:600; letter-spacing: -0.01em; margin-bottom:4px; }
  .page-title span { color:var(--red); }
  .page-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-bottom:24px; }
`;

const getZoneColor = (pct) => {
  if (pct >= 55) return "#4ade80";
  if (pct >= 45) return "#C4A265";
  if (pct >= 35) return "#f97316";
  return "#CE1141";
};

const rankColor = (rank) => {
  if (!rank) return "var(--muted)";
  if (rank <= 5)  return "var(--gold)";
  if (rank <= 10) return "#4ade80";
  if (rank >= 26) return "var(--red)";
  return "var(--muted)";
};

// Radial progress ring for a shooting percentage (0–100).
function RadialStat({ pct, label, size = 96, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(pct ?? 0, 100));
  const color = getZoneColor(value);
  return (
    <div className="ring-wrap">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg className="ring-svg" width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ}
            strokeDashoffset={circ * (1 - value / 100)} style={{ transition: "stroke-dashoffset 0.5s" }} />
        </svg>
        <div className="ring-center" style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color }}>
          {pct == null ? "-" : `${value.toFixed(1)}%`}
        </div>
      </div>
      <div className="ring-label">{label}</div>
    </div>
  );
}

// Shooting-splits panel - shown when shot-zone data is unavailable (e.g. playoffs,
// where the shots table has no rows but box-score shooting still exists).
function ShootingSplits({ shooting, game_stats }) {
  const toPct = (v) => (v == null ? null : v * 100);
  return (
    <div className="chart-card">
      <div className="splits-rings">
        <RadialStat pct={toPct(shooting.team_fg_pct)}  label="FG%" />
        <RadialStat pct={toPct(shooting.team_fg3_pct)} label="3P%" />
        <RadialStat pct={toPct(shooting.team_ft_pct)}  label="FT%" />
      </div>
      <div className="splits-foot">
        <div className="splits-foot-item">
          <div className="splits-foot-val" style={{ color:"var(--green)" }}>{game_stats.avg_pts ?? "-"}</div>
          <div className="splits-foot-lbl">PPG For</div>
        </div>
        <div className="splits-foot-item">
          <div className="splits-foot-val" style={{ color:"var(--red)" }}>{game_stats.avg_opp_pts ?? "-"}</div>
          <div className="splits-foot-lbl">PPG Against</div>
        </div>
        <div className="splits-foot-item">
          <div className="splits-foot-val" style={{ color:"var(--gold)" }}>{shooting.avg_ast ?? "-"}</div>
          <div className="splits-foot-lbl">APG</div>
        </div>
        <div className="splits-foot-item">
          <div className="splits-foot-val">{shooting.avg_reb ?? "-"}</div>
          <div className="splits-foot-lbl">RPG</div>
        </div>
      </div>
    </div>
  );
}

// Regular Season vs Playoffs shot-type comparison: FG% chart + made/miss table.
function ShotTypeComparison({ data }) {
  const chartData = data.categories.map(c => ({
    category: c.label,
    "Reg Season": c.rs.pct,
    "Playoffs": c.po.pct,
    rs: c.rs, po: c.po,
  }));
  const Tip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:4, padding:"10px 14px", fontSize:12 }}>
        <div style={{ color:"#666", marginBottom:6 }}>{label}</div>
        <div style={{ color:"var(--red)" }}>Reg Season: {d.rs.makes}/{d.rs.att} · {d.rs.pct}% · {d.rs.per_game}/g</div>
        <div style={{ color:"var(--gold)" }}>Playoffs: {d.po.makes}/{d.po.att} · {d.po.pct}% · {d.po.per_game}/g</div>
      </div>
    );
  };
  return (
    <>
      <div className="section-header">
        <div className="section-title">Shot Selection - Regular Season vs Playoffs</div>
        <div className="section-line" />
      </div>
      <div className="chart-card">
        <div className="sc-legend">
          <span><span className="sc-legend-dot" style={{ background:"var(--red)" }} />Reg Season ({data.rs_games} G)</span>
          <span><span className="sc-legend-dot" style={{ background:"var(--gold)" }} />Playoffs ({data.po_games} G)</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
            <XAxis dataKey="category" tick={{ fill:"#555", fontSize:11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0,100]} unit="%" tick={{ fill:"#555", fontSize:11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill:"rgba(255,255,255,0.03)" }} content={<Tip />} />
            <Legend wrapperStyle={{ fontSize:11, letterSpacing:1 }} />
            <Bar dataKey="Reg Season" fill="#CE1141" radius={[2,2,0,0]} />
            <Bar dataKey="Playoffs" fill="#C4A265" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, textAlign:"center", margin:"4px 0 16px" }}>
          Bars show FG% by shot type · hover for makes / attempts and per-game volume
        </div>
        <table className="sc-table">
          <thead>
            <tr>
              <th>Shot Type</th>
              <th className="num">Reg FG%</th>
              <th className="num">Reg Mix</th>
              <th className="num">PO FG%</th>
              <th className="num">PO Mix</th>
              <th className="num">Δ FG%</th>
              <th className="num">Δ Mix</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map(c => {
              const dPct  = +(c.po.pct  - c.rs.pct).toFixed(1);
              const dFreq = +(c.po.freq - c.rs.freq).toFixed(1);
              const dColor = (v) => v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--muted)";
              return (
                <tr key={c.label}>
                  <td className="sc-cat">{c.label}</td>
                  <td className="num">
                    <span className="sc-num" style={{ color:"var(--red)" }}>{c.rs.pct}%</span>
                    <div className="sc-freq">{c.rs.makes}–{c.rs.misses}</div>
                  </td>
                  <td className="num">
                    <span className="sc-num">{c.rs.freq}%</span>
                    <div className="sc-freq">{c.rs.per_game}/g</div>
                  </td>
                  <td className="num">
                    <span className="sc-num" style={{ color:"var(--gold)" }}>{c.po.pct}%</span>
                    <div className="sc-freq">{c.po.makes}–{c.po.misses}</div>
                  </td>
                  <td className="num">
                    <span className="sc-num">{c.po.freq}%</span>
                    <div className="sc-freq">{c.po.per_game}/g</div>
                  </td>
                  <td className="num sc-delta" style={{ color:dColor(dPct) }}>{dPct > 0 ? "+" : ""}{dPct}</td>
                  <td className="num sc-delta" style={{ color:dColor(dFreq) }}>{dFreq > 0 ? "+" : ""}{dFreq}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, marginTop:10 }}>
          Mix = share of all field-goal attempts (shot selection) · /g = attempts per game · Δ = playoffs minus regular season
        </div>
      </div>
    </>
  );
}

export default function TeamStats() {
  const [data, setData]             = useState(null);
  const [rankings, setRankings]     = useState({});
  const [loading, setLoading]       = useState(true);
  const [seasonType, setSeasonType] = useState("Regular Season");
  const [shotCompare, setShotCompare] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/team/stats`,    { params: { season_type: seasonType } }),
      axios.get(`${API}/team/rankings`, { params: { season_type: seasonType } }),
    ]).then(([stats, rnk]) => {
      setData(stats.data);
      setRankings(rnk.data.rankings || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [seasonType]);

  // Shot-type comparison spans both season types, so it's fetched once.
  useEffect(() => {
    axios.get(`${API}/team/shot-comparison`)
      .then(r => setShotCompare(r.data))
      .catch(() => setShotCompare(null));
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const rows = data.zones.map(z => `${z.shot_zone},${z.attempts},${z.makes},${z.pct}%`);
    const csv  = ["Zone,Attempts,Makes,FG%", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "rockets_shot_zones.csv"; a.click();
  };

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Team <span>Stats</span></div>
      <div className="page-sub">Houston Rockets · {seasonLabel()}</div>

      <div className="toggle-wrap">
        {["Regular Season", "Playoffs"].map(t => (
          <button key={t} className={`toggle-btn ${seasonType === t ? "active" : ""}`} onClick={() => setSeasonType(t)}>{t}</button>
        ))}
      </div>

      {loading ? <div className="loading">Loading team stats...</div> : !data ? <div className="loading">No data</div> : (
        <>
          {/* Summary cards */}
          <div className="ts-grid">
            <div className="ts-card green">
              <div className="ts-label">Wins</div>
              <div className="ts-value green">{data.game_stats.wins}</div>
              <div className="ts-sub">{data.game_stats.losses} losses</div>
            </div>
            <div className="ts-card gold">
              <div className="ts-label">Win %</div>
              <div className="ts-value gold">
                {data.game_stats.gp > 0 ? ((data.game_stats.wins / data.game_stats.gp) * 100).toFixed(1) : "-"}%
              </div>
              <div className="ts-sub">{data.game_stats.gp} games</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Avg PTS For</div>
              <div className="ts-value red">{data.game_stats.avg_pts}</div>
              {rankings.pts && <div style={{marginTop:4,fontFamily:"var(--display)",fontSize:16,fontWeight:700,color:rankColor(rankings.pts)}}>#{rankings.pts} <span style={{fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",fontFamily:"var(--body)",fontWeight:400}}>in NBA</span></div>}
            </div>
            <div className="ts-card">
              <div className="ts-label">Avg PTS Against</div>
              <div className="ts-value">{data.game_stats.avg_opp_pts}</div>
              <div className="ts-sub">Per game</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Home PPG</div>
              <div className="ts-value">{data.game_stats.home_ppg ?? "-"}</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Away PPG</div>
              <div className="ts-value">{data.game_stats.away_ppg ?? "-"}</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Season High</div>
              <div className="ts-value gold">{data.game_stats.max_pts}</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Season Low</div>
              <div className="ts-value red">{data.game_stats.min_pts}</div>
            </div>
          </div>

          {/* Shooting splits */}
          <div className="section-header"><div className="section-title">Shooting Splits</div><div className="section-line" />
            <span style={{fontSize:10,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",flexShrink:0}}>League Rank / 30</span>
          </div>
          <div className="ts-grid" style={{ marginBottom: 36 }}>
            {[
              { label: "FG%",  value: data.shooting.team_fg_pct  ? (data.shooting.team_fg_pct * 100).toFixed(1) + "%" : "-", cls: "red",   rk: rankings.fg_pct },
              { label: "3P%",  value: data.shooting.team_fg3_pct ? (data.shooting.team_fg3_pct * 100).toFixed(1) + "%" : "-", cls: "",      rk: rankings.fg3_pct },
              { label: "FT%",  value: data.shooting.team_ft_pct  ? (data.shooting.team_ft_pct * 100).toFixed(1) + "%" : "-", cls: "gold",  rk: rankings.ft_pct },
              { label: "APG",  value: data.shooting.avg_ast,  cls: "",      rk: rankings.ast },
              { label: "RPG",  value: data.shooting.avg_reb,  cls: "",      rk: rankings.reb },
              { label: "SPG",  value: data.shooting.avg_stl,  cls: "green", rk: rankings.stl },
              { label: "BPG",  value: data.shooting.avg_blk,  cls: "",      rk: rankings.blk },
              { label: "+/-",  value: data.shooting.avg_plus_minus > 0 ? "+" + data.shooting.avg_plus_minus : data.shooting.avg_plus_minus,
                cls: data.shooting.avg_plus_minus > 0 ? "green" : "red", rk: rankings.plus_minus },
            ].map(({ label, value, cls, rk }) => (
              <div className="ts-card" key={label}>
                <div className="ts-label">{label}</div>
                <div className={`ts-value ${cls}`}>{value ?? "-"}</div>
                {rk && (
                  <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:"var(--display)",fontSize:18,fontWeight:700,color:rankColor(rk)}}>#{rk}</span>
                    <span style={{fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>in NBA</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Monthly W/L + Zone breakdown side by side */}
          <div className="two-col">
            <div>
              <div className="section-header"><div className="section-title">Monthly Record</div><div className="section-line" /></div>
              <div className="chart-card">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.monthly} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #222", borderRadius: 4, fontSize: 12 }} />
                    <Bar dataKey="wins" name="Wins" fill="#4ade80" radius={[2,2,0,0]} />
                    <Bar dataKey="losses" name="Losses" fill="#CE1141" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              {data.zones.length > 0 ? (
                <>
                  <div className="section-header">
                    <div className="section-title">Shot Zones</div>
                    <div className="section-line" />
                    <button onClick={exportCSV} style={{ fontFamily:"var(--display)", fontSize:10, letterSpacing:2, textTransform:"uppercase", background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", padding:"4px 10px", borderRadius:2, cursor:"pointer", whiteSpace:"nowrap" }}>
                      ↓ CSV
                    </button>
                  </div>
                  <div className="chart-card">
                    {data.zones.map((z, i) => (
                      <div className="zone-row" key={i}>
                        <div className="zone-name">{z.shot_zone}</div>
                        <div className="zone-bar-wrap">
                          <div className="zone-bar" style={{ width: `${Math.min(z.pct, 100)}%`, background: getZoneColor(z.pct) }} />
                        </div>
                        <div className="zone-pct" style={{ color: getZoneColor(z.pct) }}>{z.pct}%</div>
                        <div className="zone-att">{z.attempts}x</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="section-header">
                    <div className="section-title">Shooting Splits</div>
                    <div className="section-line" />
                  </div>
                  <ShootingSplits shooting={data.shooting} game_stats={data.game_stats} />
                </>
              )}
            </div>
          </div>

          {/* Shot-type comparison spans both seasons - shown once playoff data exists */}
          {shotCompare && shotCompare.po_games > 0 && <ShotTypeComparison data={shotCompare} />}
        </>
      )}
    </div>
  );
}
