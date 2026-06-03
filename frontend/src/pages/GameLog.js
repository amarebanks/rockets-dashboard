import { useState, useEffect } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .gamelog-controls { display:flex; align-items:center; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
  .filter-btn { font-family:'Barlow Condensed',sans-serif; font-size:11px; letter-spacing:2px; text-transform:uppercase;
    padding:6px 14px; border-radius:2px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; transition:all 0.15s; }
  .filter-btn:hover { border-color:var(--text); color:var(--text); }
  .filter-btn.active { background:var(--red); border-color:var(--red); color:#fff; }
  .filter-btn.active-gold { background:transparent; border-color:var(--gold); color:var(--gold); }
  .filter-btn.playoffs { border-color:#a78bfa; color:#a78bfa; }
  .filter-btn.playoffs.active { background:#a78bfa; color:#000; }
  .streak-info { margin-left:auto; font-family:'Barlow Condensed',sans-serif; font-size:14px; letter-spacing:1px; }
  .streak-info.W { color:var(--green); }
  .streak-info.L { color:var(--red); }
  .gl-table-wrap { background:var(--surface); border:1px solid var(--border); border-radius:4px; overflow:hidden; margin-bottom:24px; }
  .gl-table { width:100%; border-collapse:collapse; font-size:13px; }
  .gl-table th { background:var(--surface2); padding:10px 16px; text-align:left; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--border); }
  .gl-table th.r { text-align:right; }
  .gl-table td { padding:12px 16px; border-bottom:1px solid var(--border); }
  .gl-table td.r { text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:16px; }
  .gl-table tr:last-child td { border-bottom:none; }
  .gl-table tr { cursor:pointer; }
  .gl-table tr:hover td { background:var(--surface2); }
  .outcome-badge { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; }
  .outcome-badge.W { color:var(--green); }
  .outcome-badge.L { color:var(--red); }
  .ha-tag { font-size:10px; letter-spacing:1px; color:var(--muted); }
  .score-cell { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:200; display:flex; align-items:center; justify-content:center; padding:24px; }
  .modal { background:var(--surface); border:1px solid var(--border); border-radius:6px; width:100%; max-width:760px; max-height:90vh; overflow-y:auto; }
  .modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:24px; border-bottom:1px solid var(--border); }
  .modal-title { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
  .modal-subtitle { font-size:12px; color:var(--muted); margin-top:4px; letter-spacing:1px; }
  .modal-score { font-family:'Barlow Condensed',sans-serif; font-size:42px; font-weight:900; line-height:1; text-align:right; }
  .modal-close { background:none; border:1px solid var(--border); color:var(--muted); width:32px; height:32px; border-radius:2px; cursor:pointer; font-size:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-left:16px; }
  .modal-close:hover { border-color:var(--text); color:var(--text); }
  .box-table { width:100%; border-collapse:collapse; font-size:12px; }
  .box-table th { padding:8px 12px; text-align:right; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--border); background:var(--surface2); }
  .box-table th:first-child { text-align:left; }
  .box-table td { padding:9px 12px; border-bottom:1px solid var(--border); text-align:right; font-family:'Barlow Condensed',sans-serif; font-size:15px; }
  .box-table td:first-child { text-align:left; font-family:'Barlow',sans-serif; font-size:13px; font-weight:500; }
  .box-table tr:last-child td { border-bottom:none; }
  .box-table tr:hover td { background:var(--surface2); }
  .pts-leader { color:var(--red); }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .wl-bar { display:flex; gap:2px; margin-bottom:20px; }
  .wl-segment { height:6px; border-radius:1px; flex:1; }
  .wl-segment.W { background:var(--green); }
  .wl-segment.L { background:var(--red); }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .page-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
  .page-title span { color:var(--red); }
  .page-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-bottom:28px; }
  .export-btn { font-family:'Barlow Condensed',sans-serif; font-size:10px; letter-spacing:2px; text-transform:uppercase; background:transparent; border:1px solid var(--border); color:var(--muted); padding:4px 10px; border-radius:2px; cursor:pointer; }
  .export-btn:hover { border-color:var(--text); color:var(--text); }
  .playoff-badge { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:#a78bfa; border:1px solid #a78bfa; padding:2px 6px; border-radius:2px; margin-left:8px; }
`;

export default function GameLog() {
  const [games, setGames]           = useState([]);
  const [streak, setStreak]         = useState(null);
  const [filter, setFilter]         = useState({ outcome: null, home_away: null });
  const [seasonType, setSeasonType] = useState("Regular Season");
  const [selected, setSelected]     = useState(null);
  const [boxScore, setBoxScore]     = useState(null);
  const [loadingBox, setLoadingBox] = useState(false);
  const [loading, setLoading]       = useState(true);

  const loadGames = (f = filter, st = seasonType) => {
    setLoading(true);
    const params = { season_type: st };
    if (f.outcome)   params.outcome   = f.outcome;
    if (f.home_away) params.home_away = f.home_away;
    axios.get(`${API}/games`, { params }).then(r => {
      setGames(r.data.games);
      setStreak(r.data.streak);
      setLoading(false);
    });
  };

  useEffect(() => { loadGames(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const setF = (key, val) => {
    const next = { ...filter, [key]: filter[key] === val ? null : val };
    setFilter(next);
    loadGames(next, seasonType);
  };

  const switchSeason = (st) => {
    setSeasonType(st);
    setFilter({ outcome: null, home_away: null });
    loadGames({ outcome: null, home_away: null }, st);
  };

  const openGame = (game) => {
    setSelected(game);
    setLoadingBox(true);
    axios.get(`${API}/games/${game.game_id}`).then(r => {
      setBoxScore(r.data.box_score);
      setLoadingBox(false);
    });
  };

  const exportCSV = () => {
    const headers = "Date,Matchup,W/L,Home/Away,PTS,OPP,Diff";
    const rows = games.map(g => {
      const diff = g.opp_pts != null ? g.pts - g.opp_pts : "";
      return `${g.game_date},${g.matchup},${g.outcome},${g.home_away === "H" ? "Home" : "Away"},${g.pts},${g.opp_pts ?? ""},${diff}`;
    });
    const csv  = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `rockets_${seasonType.replace(" ","_")}_games.csv`; a.click();
  };

  const wl   = [...games].reverse();
  const wins = games.filter(g => g.outcome === "W").length;

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Game <span>Log</span></div>
      <div className="page-sub">{seasonLabel()} · Click any game for box score</div>

      {/* Season toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {["Regular Season","Playoffs"].map(t => (
          <button key={t} className={`filter-btn ${t==="Playoffs"?"playoffs":""} ${seasonType===t?"active":""}`} onClick={() => switchSeason(t)}>{t}</button>
        ))}
      </div>

      {!loading && (
        <>
          <div className="wl-bar">
            {wl.map((g,i) => <div key={i} className={`wl-segment ${g.outcome}`} title={`${g.matchup} — ${g.outcome}`} />)}
          </div>
          <div className="gamelog-controls">
            <button className={`filter-btn ${filter.outcome==="W"?"active":""}`} onClick={() => setF("outcome","W")}>Wins</button>
            <button className={`filter-btn ${filter.outcome==="L"?"active":""}`} onClick={() => setF("outcome","L")}>Losses</button>
            <button className={`filter-btn ${filter.home_away==="H"?"active-gold":""}`} onClick={() => setF("home_away","H")}>Home</button>
            <button className={`filter-btn ${filter.home_away==="A"?"active-gold":""}`} onClick={() => setF("home_away","A")}>Away</button>
            <div style={{ color:"var(--muted)", fontSize:12, letterSpacing:1 }}>{games.length} games · {wins}W–{games.length-wins}L</div>
            {streak && <div className={`streak-info ${streak.type}`} style={{ marginLeft:"auto" }}>Streak: {streak.type}{streak.count}</div>}
            <button className="export-btn" onClick={exportCSV}>↓ CSV</button>
          </div>
        </>
      )}

      {loading ? <div className="loading">Loading...</div> : (
        <div className="gl-table-wrap">
          <table className="gl-table">
            <thead>
              <tr>
                <th>#</th><th></th><th>Date</th><th>Matchup</th>
                <th className="r">PTS</th><th className="r">OPP</th><th className="r">Diff</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g,i) => {
                const diff = g.opp_pts != null ? g.pts - g.opp_pts : null;
                return (
                  <tr key={g.game_id} onClick={() => openGame(g)}>
                    <td style={{ color:"var(--muted)", fontSize:12 }}>{games.length - i}</td>
                    <td><span className={`outcome-badge ${g.outcome}`}>{g.outcome}</span></td>
                    <td>{new Date(g.game_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                    <td>
                      <span className="ha-tag">{g.home_away==="H"?"vs ":"@ "}</span>{g.matchup}
                      {g.season_type==="Playoffs" && <span className="playoff-badge">PO</span>}
                    </td>
                    <td className="r"><span className="score-cell" style={{ color:"var(--red)" }}>{g.pts}</span></td>
                    <td className="r"><span className="score-cell">{g.opp_pts??"|—"}</span></td>
                    <td className="r">
                      <span style={{ color:diff>0?"var(--green)":diff<0?"var(--red)":"var(--muted)", fontFamily:"'Barlow Condensed',sans-serif", fontSize:16 }}>
                        {diff!=null?(diff>0?"+":"")+diff:"—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => { setSelected(null); setBoxScore(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selected.matchup}</div>
                <div className="modal-subtitle">
                  {new Date(selected.game_date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                  &nbsp;·&nbsp;{selected.home_away==="H"?"Home":"Away"}
                  {selected.season_type==="Playoffs" && <span className="playoff-badge" style={{marginLeft:8}}>Playoffs</span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <div className="modal-score" style={{ color:selected.outcome==="W"?"var(--green)":"var(--red)" }}>
                  {selected.pts}{selected.opp_pts&&<span style={{color:"var(--border)",fontSize:28}}> – {selected.opp_pts}</span>}
                </div>
                <button className="modal-close" onClick={() => { setSelected(null); setBoxScore(null); }}>✕</button>
              </div>
            </div>
            <div style={{ padding:"0 0 8px" }}>
              {loadingBox ? <div className="loading">Loading box score...</div> : boxScore && (
                <table className="box-table">
                  <thead>
                    <tr><th>Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG%</th><th>3P%</th><th>+/-</th></tr>
                  </thead>
                  <tbody>
                    {boxScore.map((row,i) => (
                      <tr key={i}>
                        <td>
                          <span style={{ color:"var(--muted)", fontSize:11, marginRight:6 }}>#{row.jersey_num}</span>
                          {row.full_name}
                          {row.position && <span style={{ fontSize:10, color:"var(--muted)", marginLeft:6, background:"var(--surface2)", padding:"1px 5px", borderRadius:2 }}>{row.position}</span>}
                        </td>
                        <td>{row.min}</td>
                        <td className={i===0?"pts-leader":""}>{row.pts}</td>
                        <td>{row.reb}</td><td>{row.ast}</td><td>{row.stl}</td><td>{row.blk}</td>
                        <td>{row.fg_pct!=null?(row.fg_pct*100).toFixed(1)+"%":"—"}</td>
                        <td>{row.fg3_pct!=null?(row.fg3_pct*100).toFixed(1)+"%":"—"}</td>
                        <td style={{ color:row.plus_minus>0?"var(--green)":row.plus_minus<0?"var(--red)":"var(--muted)" }}>
                          {row.plus_minus!=null?(row.plus_minus>0?"+":"")+row.plus_minus:"—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
