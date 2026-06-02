import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

const API = "http://127.0.0.1:8000";

const css = `
  .ts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:36px; }
  .ts-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:18px; position:relative; overflow:hidden; }
  .ts-card::before { content:''; position:absolute; top:0;left:0;right:0; height:3px; background:var(--red); }
  .ts-card.gold::before { background:var(--gold); }
  .ts-card.green::before { background:var(--green); }
  .ts-label { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
  .ts-value { font-family:'Barlow Condensed',sans-serif; font-size:38px; font-weight:700; line-height:1; }
  .ts-value.red { color:var(--red); }
  .ts-value.gold { color:var(--gold); }
  .ts-value.green { color:var(--green); }
  .ts-sub { font-size:11px; color:var(--muted); margin-top:3px; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:24px; margin-bottom:24px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:36px; }
  .zone-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
  .zone-row:last-child { border-bottom:none; }
  .zone-name { font-size:12px; flex:1; }
  .zone-bar-wrap { width:100px; height:6px; background:var(--surface2); border-radius:3px; overflow:hidden; }
  .zone-bar { height:100%; border-radius:3px; }
  .zone-pct { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; width:44px; text-align:right; }
  .zone-att { font-size:11px; color:var(--muted); width:40px; text-align:right; }
  .toggle-wrap { display:flex; gap:8px; margin-bottom:28px; }
  .toggle-btn { font-family:'Barlow Condensed',sans-serif; font-size:11px; letter-spacing:2px; text-transform:uppercase;
    padding:7px 18px; border-radius:2px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; }
  .toggle-btn.active { background:var(--red); border-color:var(--red); color:#fff; }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .page-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
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

export default function TeamStats() {
  const [data, setData]             = useState(null);
  const [rankings, setRankings]     = useState({});
  const [loading, setLoading]       = useState(true);
  const [seasonType, setSeasonType] = useState("Regular Season");

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
      <div className="page-sub">Houston Rockets · 2024–25</div>

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
                {data.game_stats.gp > 0 ? ((data.game_stats.wins / data.game_stats.gp) * 100).toFixed(1) : "—"}%
              </div>
              <div className="ts-sub">{data.game_stats.gp} games</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Avg PTS For</div>
              <div className="ts-value red">{data.game_stats.avg_pts}</div>
              {rankings.pts && <div style={{marginTop:4,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,color:rankColor(rankings.pts)}}>#{rankings.pts} <span style={{fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",fontFamily:"'Barlow',sans-serif",fontWeight:400}}>in NBA</span></div>}
            </div>
            <div className="ts-card">
              <div className="ts-label">Avg PTS Against</div>
              <div className="ts-value">{data.game_stats.avg_opp_pts}</div>
              <div className="ts-sub">Per game</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Home PPG</div>
              <div className="ts-value">{data.game_stats.home_ppg ?? "—"}</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Away PPG</div>
              <div className="ts-value">{data.game_stats.away_ppg ?? "—"}</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Highest Score</div>
              <div className="ts-value gold">{data.game_stats.max_pts}</div>
            </div>
            <div className="ts-card">
              <div className="ts-label">Lowest Score</div>
              <div className="ts-value red">{data.game_stats.min_pts}</div>
            </div>
          </div>

          {/* Shooting splits */}
          <div className="section-header"><div className="section-title">Shooting Splits</div><div className="section-line" />
            <span style={{fontSize:10,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",flexShrink:0}}>League Rank / 30</span>
          </div>
          <div className="ts-grid" style={{ marginBottom: 36 }}>
            {[
              { label: "FG%",  value: data.shooting.team_fg_pct  ? (data.shooting.team_fg_pct * 100).toFixed(1) + "%" : "—", cls: "red",   rk: rankings.fg_pct },
              { label: "3P%",  value: data.shooting.team_fg3_pct ? (data.shooting.team_fg3_pct * 100).toFixed(1) + "%" : "—", cls: "",      rk: rankings.fg3_pct },
              { label: "FT%",  value: data.shooting.team_ft_pct  ? (data.shooting.team_ft_pct * 100).toFixed(1) + "%" : "—", cls: "gold",  rk: rankings.ft_pct },
              { label: "APG",  value: data.shooting.avg_ast,  cls: "",      rk: rankings.ast },
              { label: "RPG",  value: data.shooting.avg_reb,  cls: "",      rk: rankings.reb },
              { label: "SPG",  value: data.shooting.avg_stl,  cls: "green", rk: rankings.stl },
              { label: "BPG",  value: data.shooting.avg_blk,  cls: "",      rk: rankings.blk },
              { label: "+/-",  value: data.shooting.avg_plus_minus > 0 ? "+" + data.shooting.avg_plus_minus : data.shooting.avg_plus_minus,
                cls: data.shooting.avg_plus_minus > 0 ? "green" : "red", rk: rankings.plus_minus },
            ].map(({ label, value, cls, rk }) => (
              <div className="ts-card" key={label}>
                <div className="ts-label">{label}</div>
                <div className={`ts-value ${cls}`}>{value ?? "—"}</div>
                {rk && (
                  <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:rankColor(rk)}}>#{rk}</span>
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
              <div className="section-header">
                <div className="section-title">Shot Zones</div>
                <div className="section-line" />
                <button onClick={exportCSV} style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, letterSpacing:2, textTransform:"uppercase", background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", padding:"4px 10px", borderRadius:2, cursor:"pointer", whiteSpace:"nowrap" }}>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
