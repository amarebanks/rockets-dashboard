import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";
import ShotChart from "../components/ShotChart";
import { accTier, accoladeCSS } from "../accoladeStyle";

const API = "http://127.0.0.1:8000";

// Headshots are proxied through the backend (NBA's CDN blocks cross-origin browser loads)
const headshot = (id) => `${API}/headshot/${id}`;

const css = `
  .profile-header { display:flex; align-items:flex-start; gap:28px; margin-bottom:36px; padding-bottom:32px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
  .profile-headshot { width:120px; height:90px; object-fit:cover; object-position:top; border-radius:10px; background:var(--surface2); border:1px solid var(--border); flex-shrink:0; }
  .profile-number { font-family:var(--display); font-size:100px; font-weight:600; line-height:1; color:var(--surface2); letter-spacing:-4px; flex-shrink:0; }
  .profile-info { flex:1; }
  .profile-name { font-family:var(--display); font-size:44px; font-weight:600; letter-spacing: -0.01em; line-height:1; }
  .profile-meta { display:flex; gap:10px; margin-top:10px; flex-wrap:wrap; }
  .profile-tag { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); border:1px solid var(--border); padding:4px 10px; border-radius:8px; }
  .profile-tag.red { border-color:var(--red); color:var(--red); }
  .profile-accolades { display:flex; gap:6px; margin-top:12px; flex-wrap:wrap; }
  ${accoladeCSS}
  .toggle-wrap { display:flex; gap:8px; margin-bottom:24px; }
  .toggle-btn { font-family:var(--display); font-size:11px; letter-spacing:2px; text-transform:uppercase;
    padding:7px 18px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; }
  .toggle-btn.active { background:var(--red); border-color:var(--red); color:#fff; }
  .avgs-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; margin-bottom:36px; }
  .avg-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:14px; text-align:center; }
  .avg-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
  .avg-value { font-family:var(--display); font-size:32px; font-weight:700; }
  .avg-value.red { color:var(--red); }
  .avg-value.gold { color:var(--gold); }
  .avg-value.green { color:var(--green); }
  .avg-career { font-size:10px; color:var(--muted); margin-top:2px; }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:24px; margin-bottom:36px; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:var(--display); font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .gl-table-wrap { background:var(--surface); border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-bottom:36px; max-height:400px; overflow-y:auto; }
  .gl-table { width:100%; border-collapse:collapse; font-size:13px; }
  .gl-table th { background:var(--surface2); padding:9px 14px; text-align:right; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:1; }
  .gl-table th:first-child,.gl-table th:nth-child(2) { text-align:left; }
  .gl-table td { padding:9px 14px; border-bottom:1px solid var(--border); text-align:right; font-family:var(--display); font-size:15px; }
  .gl-table td:first-child,.gl-table td:nth-child(2) { text-align:left; font-family:var(--body); font-size:12px; }
  .gl-table tr:last-child td { border-bottom:none; }
  .gl-table tr:hover td { background:var(--surface2); }
  .back-btn { display:inline-flex; align-items:center; gap:8px; font-family:var(--display); font-size:12px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); background:none; border:1px solid var(--border); padding:7px 14px; border-radius:8px; cursor:pointer; margin-bottom:28px; }
  .back-btn:hover { border-color:var(--text); color:var(--text); }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .last5-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:36px; }
  .last5-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center; }
  .last5-outcome { font-family:var(--display); font-size:22px; font-weight:600; }
  .last5-outcome.W { color:var(--green); }
  .last5-outcome.L { color:var(--red); }
  .last5-pts { font-family:var(--display); font-size:28px; font-weight:700; color:var(--red); }
  .last5-sub { font-size:11px; color:var(--muted); margin-top:4px; }
  .export-btn { font-family:var(--display); font-size:10px; letter-spacing:2px; text-transform:uppercase; background:transparent; border:1px solid var(--border); color:var(--muted); padding:4px 10px; border-radius:8px; cursor:pointer; margin-left:auto; }
  .export-btn:hover { border-color:var(--text); color:var(--text); }
  .cmp-table { width:100%; border-collapse:collapse; font-size:13px; }
  .cmp-table th { background:var(--surface2); padding:8px 14px; text-align:center; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--border); font-weight:500; }
  .cmp-table th:first-child { text-align:left; }
  .cmp-table td { padding:9px 14px; border-bottom:1px solid var(--border); text-align:center; font-family:var(--display); font-size:18px; font-weight:600; }
  .cmp-table td:first-child { text-align:left; font-family:var(--body); font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); font-weight:400; }
  .cmp-table tr:last-child td { border-bottom:none; }
  .cmp-table tr:hover td { background:var(--surface2); }
`;

const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background:"#1a1a1a", border:"1px solid #222", padding:"10px 14px", borderRadius:4, fontSize:12 }}>
        <div style={{ color:"#666", marginBottom:4 }}>Game {label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color:p.color, fontFamily:"var(--display)", fontSize:18, fontWeight:700 }}>
            {p.value} {p.name.toUpperCase()}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PlayerProfile() {
  const { id }          = useParams();
  const navigate        = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [seasonType, setSeasonType] = useState("Regular Season");
  const [imgError, setImgError]     = useState(false);
  const [advanced, setAdvanced]     = useState(null);
  const [advLoading, setAdvLoading] = useState(true);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/players/${id}`, { params: { season_type: seasonType } })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, seasonType]);

  useEffect(() => {
    setComparison(null);
    Promise.all([
      axios.get(`${API}/players/${id}`, { params: { season_type: "Regular Season" } }),
      axios.get(`${API}/players/${id}`, { params: { season_type: "Playoffs" } }),
    ]).then(([rs, po]) => {
      setComparison({ rs: rs.data.averages, po: po.data.averages });
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    setAdvLoading(true);
    setAdvanced(null);
    axios.get(`${API}/players/${id}/advanced`, { params: { season_type: seasonType } })
      .then(r => { setAdvanced(r.data); setAdvLoading(false); })
      .catch(() => setAdvLoading(false));
  }, [id, seasonType]);

  const exportCSV = () => {
    if (!data) return;
    const headers = "Date,Matchup,W/L,MIN,PTS,REB,AST,STL,BLK,FG%,3P%,FT%,+/-";
    const rows = data.game_log.map(g =>
      [g.game_date, g.matchup, g.outcome, g.min, g.pts, g.reb, g.ast,
       g.stl, g.blk,
       g.fg_pct ? (g.fg_pct*100).toFixed(1)+"%" : "",
       g.fg3_pct ? (g.fg3_pct*100).toFixed(1)+"%" : "",
       g.ft_pct ? (g.ft_pct*100).toFixed(1)+"%" : "",
       g.plus_minus].join(",")
    );
    const csv  = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${data.player.full_name.replace(" ","_")}_game_log.csv`;
    a.click();
  };

  if (loading) return <div className="page"><style>{css}</style><div className="loading">Loading player...</div></div>;
  if (!data)   return <div className="page"><style>{css}</style><div className="loading">Player not found</div></div>;

  const { player, averages, game_log, last5, accolades } = data;

  const chartData = [...game_log].reverse().slice(-20).map((g, i) => ({
    game: i+1, pts: g.pts, reb: g.reb, ast: g.ast, matchup: g.matchup,
  }));

  const radarData = [
    { stat:"PTS", value: Math.min((averages.avg_pts/35)*100, 100) },
    { stat:"REB", value: Math.min((averages.avg_reb/15)*100, 100) },
    { stat:"AST", value: Math.min((averages.avg_ast/12)*100, 100) },
    { stat:"STL", value: Math.min((averages.avg_stl/3)*100, 100) },
    { stat:"BLK", value: Math.min((averages.avg_blk/3)*100, 100) },
    { stat:"FG%", value: Math.min((averages.avg_fg_pct/0.65)*100, 100) },
  ];

  // Comparison helpers - defined here to avoid IIFE in JSX
  const cmpFmt = (v, pct) => v == null ? "-" : pct ? (v * 100).toFixed(1) + "%" : String(v);
  const cmpDelta = (r, p, pct) => (r == null || p == null) ? null : pct ? (p - r) * 100 : p - r;
  const cmpDeltaColor = (d) => d == null ? "var(--muted)" : d > 0 ? "#4ade80" : d < 0 ? "var(--red)" : "var(--muted)";
  const cmpFmtDelta = (d, pct) => d == null ? "-" : (d > 0 ? "+" : "") + (pct ? d.toFixed(1) + "%" : d.toFixed(1));
  const CMP_STATS = [
    { label:"Points",   rsKey:"avg_pts",        poKey:"avg_pts",        pct:false },
    { label:"Rebounds", rsKey:"avg_reb",        poKey:"avg_reb",        pct:false },
    { label:"Assists",  rsKey:"avg_ast",        poKey:"avg_ast",        pct:false },
    { label:"Steals",   rsKey:"avg_stl",        poKey:"avg_stl",        pct:false },
    { label:"Blocks",   rsKey:"avg_blk",        poKey:"avg_blk",        pct:false },
    { label:"FG%",      rsKey:"avg_fg_pct",     poKey:"avg_fg_pct",     pct:true  },
    { label:"3P%",      rsKey:"avg_fg3_pct",    poKey:"avg_fg3_pct",    pct:true  },
    { label:"FT%",      rsKey:"avg_ft_pct",     poKey:"avg_ft_pct",     pct:true  },
    { label:"+/-",      rsKey:"avg_plus_minus", poKey:"avg_plus_minus", pct:false },
  ];
  const hasPoData = comparison && comparison.po && (comparison.po.games_played ?? 0) > 0;

  return (
    <div className="page">
      <style>{css}</style>
      <button className="back-btn" onClick={() => navigate("/")}><ArrowLeft size={14}/> Back to Roster</button>

      {/* Header */}
      <div className="profile-header">
        {!imgError ? (
          <img
            className="profile-headshot"
            src={headshot(player.player_id)}
            alt={player.full_name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="profile-number">#{player.jersey_num || "0"}</div>
        )}
        <div className="profile-info">
          <div className="profile-name">{player.full_name}</div>
          <div className="profile-meta">
            {player.position && <span className="profile-tag red">{player.position}</span>}
            <span className="profile-tag">#{player.jersey_num}</span>
            <span className="profile-tag">Houston Rockets</span>
            {averages.games_played && <span className="profile-tag">{averages.games_played} GP</span>}
            {player.how_acquired && <span className="profile-tag">{player.how_acquired}</span>}
          </div>
          {accolades && accolades.length > 0 && (
            <div className="profile-accolades">
              {accolades.map((a, i) => <span key={i} className={"acc-badge " + accTier(a)}>{a}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Season toggle */}
      <div className="toggle-wrap">
        {["Regular Season","Playoffs"].map(t => (
          <button key={t} className={`toggle-btn ${seasonType===t?"active":""}`} onClick={() => setSeasonType(t)}>{t}</button>
        ))}
      </div>

      {/* Averages */}
      <div className="section-header"><div className="section-title">Season Averages</div><div className="section-line" /></div>
      <div className="avgs-grid">
        {[
          {label:"PTS", value:averages.avg_pts, cls:"red", sub:`High: ${averages.max_pts}`, rk:"pts"},
          {label:"REB", value:averages.avg_reb, cls:"", sub:`High: ${averages.max_reb}`, rk:"reb"},
          {label:"AST", value:averages.avg_ast, cls:"gold", sub:`High: ${averages.max_ast}`, rk:"ast"},
          {label:"STL", value:averages.avg_stl, cls:"", rk:"stl"},
          {label:"BLK", value:averages.avg_blk, cls:"", rk:"blk"},
          {label:"FG%", value:averages.avg_fg_pct?(averages.avg_fg_pct*100).toFixed(1)+"%":"-", cls:"green", rk:"fg_pct"},
          {label:"3P%", value:averages.avg_fg3_pct?(averages.avg_fg3_pct*100).toFixed(1)+"%":"-", cls:"", rk:"fg3_pct"},
          {label:"FT%", value:averages.avg_ft_pct?(averages.avg_ft_pct*100).toFixed(1)+"%":"-", cls:"", rk:"ft_pct"},
          {label:"+/-", value:averages.avg_plus_minus!=null?(averages.avg_plus_minus>0?"+":"")+averages.avg_plus_minus:"-", cls:averages.avg_plus_minus>0?"green":averages.avg_plus_minus<0?"red":"", rk:"plus_minus"},
        ].map(({label,value,cls,sub,rk}) => {
          const rank = advanced?.rankings?.[rk];
          const rankColor = rank <= 10 ? "var(--gold)" : rank <= 25 ? "#4ade80" : "var(--muted)";
          return (
            <div className="avg-card" key={label}>
              <div className="avg-label">{label}</div>
              <div className={`avg-value ${cls}`}>{value??"|-"}</div>
              {sub && <div className="avg-career">{sub}</div>}
              {rank && (
                <div style={{fontSize:9,letterSpacing:1,textTransform:"uppercase",marginTop:3,fontFamily:"var(--display)",fontWeight:700,color:rankColor}}>
                  #{rank} league
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Advanced Stats */}
      <div className="section-header">
        <div className="section-title">Advanced Stats</div>
        <div className="section-line" />
        {advanced && (
          <span style={{fontSize:10,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",flexShrink:0}}>
            {advanced.games_played} GP · {advanced.team}
          </span>
        )}
      </div>

      {advLoading ? (
        <div style={{color:"var(--muted)",fontSize:11,letterSpacing:2,textTransform:"uppercase",padding:"18px 0 32px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"var(--red)",animation:"pulse 1.2s infinite"}}/>
          Fetching advanced stats...
        </div>
      ) : advanced && advanced.has_data === false ? (
        <div style={{color:"var(--muted)",fontSize:11,letterSpacing:2,textTransform:"uppercase",padding:"18px 0 32px"}}>
          No playoff stats available for this player
        </div>
      ) : advanced ? (
        <>
          <div className="avgs-grid" style={{marginBottom:36}}>
            {(() => {
              const netRtg = advanced.net_rtg ?? (
                advanced.off_rtg != null && advanced.def_rtg != null
                  ? Math.round((advanced.off_rtg - advanced.def_rtg) * 10) / 10
                  : null
              );
              const rtgColor = (val, goodFn) => val != null ? (goodFn(val) ? "var(--green)" : "var(--red)") : "var(--text)";
              const netDisplay = netRtg != null ? (netRtg > 0 ? "+" : "") + netRtg : "-";
              const ratings = [
                { label:"Off Rtg", value:advanced.off_rtg, sub:"Offensive Rating", color: rtgColor(advanced.off_rtg, v => v > 110) },
                { label:"Def Rtg", value:advanced.def_rtg, sub:"Defensive Rating", color: rtgColor(advanced.def_rtg, v => v < 110) },
                { label:"Net Rtg", value:netDisplay,       sub:"Net Rating",       color: rtgColor(netRtg, v => v > 0) },
              ];
              const pcts = [
                {label:"TS%",     value:advanced.ts_pct,   sub:"True Shooting", cls:"green"},
                {label:"eFG%",    value:advanced.efg_pct,  sub:"Eff. FG%",      cls:""},
                {label:"USG%",    value:advanced.usg_pct,  sub:"Usage Rate",    cls:"gold"},
                {label:"PIE",     value:advanced.pie,      sub:"Player Impact", cls:""},
                {label:"AST%",    value:advanced.ast_pct,  sub:"Assist %",      cls:""},
                {label:"REB%",    value:advanced.reb_pct,  sub:"Rebound %",     cls:""},
                {label:"OREB%",   value:advanced.oreb_pct, sub:"Off Reb %",     cls:""},
                {label:"DREB%",   value:advanced.dreb_pct, sub:"Def Reb %",     cls:""},
                {label:"3PA Rate",value:advanced.fg3_rate, sub:"3-Pt Rate",     cls:""},
                {label:"FTA Rate",value:advanced.ft_rate,  sub:"FT Rate",       cls:""},
                {label:"TOV",     value:advanced.tov,      sub:"Turnovers",     cls:"red", noSign:true},
                {label:"AST/TO",  value:advanced.ast_to,   sub:"Ast/Turnover",  cls:"green", noSign:true},
              ];
              return (
                <>
                  {ratings.map(({label, value, sub, color}) => (
                    <div className="avg-card" key={label}>
                      <div className="avg-label">{label}</div>
                      <div className="avg-value" style={{color, fontSize:28}}>{value ?? "-"}</div>
                      <div className="avg-career">{sub}</div>
                    </div>
                  ))}
                  {pcts.filter(s => s.value != null).map(({label, value, sub, cls, noSign}) => (
                    <div className="avg-card" key={label}>
                      <div className="avg-label">{label}</div>
                      <div className={`avg-value ${cls}`} style={{fontSize:24}}>
                        {noSign ? value : value + "%"}
                      </div>
                      <div className="avg-career">{sub}</div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </>
      ) : (
        <div style={{color:"var(--muted)",fontSize:11,letterSpacing:2,textTransform:"uppercase",padding:"18px 0 32px"}}>
          Advanced stats unavailable for this player
        </div>
      )}

      {/* Last 5 */}
      {last5?.length > 0 && (
        <>
          <div className="section-header"><div className="section-title">Last 5 Games</div><div className="section-line" /></div>
          <div className="last5-grid">
            {last5.map((g,i) => (
              <div className="last5-card" key={i}>
                <div className={`last5-outcome ${g.outcome}`}>{g.outcome}</div>
                <div className="last5-pts">{g.pts}</div>
                <div style={{fontSize:10,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>PTS</div>
                <div className="last5-sub">{g.reb}r · {g.ast}a</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trend chart */}
      <div className="section-header"><div className="section-title">Last 20 Games - Pts / Reb / Ast</div><div className="section-line" /></div>
      <div className="chart-card">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
            <XAxis dataKey="game" tick={{fill:"#555",fontSize:10}} axisLine={{stroke:"#222"}} tickLine={false} />
            <YAxis tick={{fill:"#555",fontSize:10}} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="pts" name="pts" stroke="#CE1141" strokeWidth={2} dot={false} activeDot={{r:4}} />
            <Line type="monotone" dataKey="reb" name="reb" stroke="#C4A265" strokeWidth={1.5} dot={false} activeDot={{r:4}} />
            <Line type="monotone" dataKey="ast" name="ast" stroke="#4ade80" strokeWidth={1.5} dot={false} activeDot={{r:4}} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:20,marginTop:12,justifyContent:"center"}}>
          {[["#CE1141","PTS"],["#C4A265","REB"],["#4ade80","AST"]].map(([color,label]) => (
            <div key={label} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--muted)",letterSpacing:1}}>
              <div style={{width:20,height:2,background:color,borderRadius:1}}/>{label}
            </div>
          ))}
        </div>
      </div>

      {/* Shot Chart - only available for Regular Season */}
      {seasonType !== "Playoffs" && (
        <>
          <div className="section-header"><div className="section-title">Shot Chart</div><div className="section-line" /></div>
          <ShotChart playerId={player.player_id} playerName={player.full_name} seasonType={seasonType} />
        </>
      )}

      {/* Regular Season vs Playoffs Comparison */}
      {comparison && (
        <>
          <div className="section-header">
            <div className="section-title">Regular Season vs Playoffs</div>
            <div className="section-line" />
            <span style={{fontSize:10,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",flexShrink:0,fontFamily:"var(--display)"}}>
              {comparison.rs?.games_played ?? 0} RS GP &middot; {hasPoData ? comparison.po.games_played : "0"} PO GP
            </span>
          </div>
          <div className="chart-card" style={{marginBottom:36,padding:0,overflow:"hidden"}}>
            <table className="cmp-table">
              <thead>
                <tr>
                  <th>Stat</th>
                  <th>Regular Season</th>
                  <th>Playoffs</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {CMP_STATS.map(({label, rsKey, poKey, pct}) => {
                  const rsVal = comparison.rs?.[rsKey];
                  const poVal = comparison.po?.[poKey];
                  const d = cmpDelta(rsVal, poVal, pct);
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td style={{color:"var(--text)"}}>{cmpFmt(rsVal, pct)}</td>
                      <td style={{color: hasPoData ? "var(--gold)" : "var(--muted)"}}>
                        {hasPoData ? cmpFmt(poVal, pct) : "-"}
                      </td>
                      <td style={{color: hasPoData ? cmpDeltaColor(d) : "var(--muted)"}}>
                        {hasPoData ? cmpFmtDelta(d, pct) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Radar + Career Highs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:36}}>
        <div>
          <div className="section-header"><div className="section-title">Skill Radar</div><div className="section-line" /></div>
          <div className="chart-card" style={{marginBottom:0}}>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#222" />
                <PolarAngleAxis dataKey="stat" tick={{fill:"#666",fontSize:11}} />
                <Radar dataKey="value" stroke="#CE1141" fill="#CE1141" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="section-header"><div className="section-title">Season Highs</div><div className="section-line" /></div>
          <div className="chart-card" style={{marginBottom:0}}>
            {[{label:"Points",value:averages.max_pts},{label:"Rebounds",value:averages.max_reb},{label:"Assists",value:averages.max_ast}].map(({label,value}) => (
              <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:11,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>{label}</span>
                <span style={{fontFamily:"var(--display)",fontSize:36,fontWeight:700,color:"var(--red)"}}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Log */}
      <div className="section-header">
        <div className="section-title">Full Game Log</div>
        <div className="section-line" />
        <button className="export-btn" onClick={exportCSV}><Download size={14}/> Export CSV</button>
      </div>
      <div className="gl-table-wrap">
        <table className="gl-table">
          <thead>
            <tr>
              <th>Date</th><th>Matchup</th>
              <th>W/L</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th>
              <th>STL</th><th>BLK</th><th>FG%</th><th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {game_log.map((g,i) => (
              <tr key={i}>
                <td>{g.game_date?new Date(g.game_date).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"-"}</td>
                <td>{g.matchup||"-"}</td>
                <td style={{fontFamily:"var(--display)",fontSize:18,fontWeight:600,color:g.outcome==="W"?"var(--green)":"var(--red)",textAlign:"right"}}>{g.outcome}</td>
                <td>{g.min}</td>
                <td style={{color:"var(--red)"}}>{g.pts}</td>
                <td>{g.reb}</td><td>{g.ast}</td><td>{g.stl}</td><td>{g.blk}</td>
                <td>{g.fg_pct!=null?(g.fg_pct*100).toFixed(1)+"%":"-"}</td>
                <td style={{color:g.plus_minus>0?"var(--green)":g.plus_minus<0?"var(--red)":"var(--muted)"}}>
                  {g.plus_minus!=null?(g.plus_minus>0?"+":"")+g.plus_minus:"-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
