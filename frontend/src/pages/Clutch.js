import { useState, useEffect } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";
const headshot = (id) => `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${id}.png`;

const css = `
  .cl-head { margin-bottom: 28px; }
  .cl-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .cl-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .section-header { display:flex; align-items:center; gap:12px; margin:8px 0 16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .cl-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:28px; }
  .cl-stat { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:18px; position:relative; overflow:hidden; }
  .cl-stat::before { content:''; position:absolute; top:0;left:0;right:0; height:3px; background:var(--red); }
  .cl-stat.gold::before { background:var(--gold); }
  .cl-stat.green::before { background:var(--green); }
  .cl-stat-val { font-family:'Barlow Condensed',sans-serif; font-size:38px; font-weight:700; line-height:1; }
  .cl-stat-lbl { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:6px; }
  .cl-table { background:var(--surface); border:1px solid var(--border); border-radius:4px; overflow:hidden; }
  .cl-row { display:grid; grid-template-columns:34px 1.6fr 52px 64px 78px 78px 56px 60px;
    align-items:center; gap:10px; padding:11px 16px; border-bottom:1px solid var(--border); font-size:13px; }
  .cl-row:last-child { border-bottom:none; }
  .cl-row.head { background:var(--surface2); font-family:'Barlow Condensed',sans-serif; font-size:11px;
    letter-spacing:1px; text-transform:uppercase; color:var(--muted); font-weight:700; }
  .cl-row.head > div { text-align:right; }
  .cl-row.head > div:nth-child(2) { text-align:left; }
  .cl-row > div { text-align:right; }
  .cl-headshot { width:30px; height:22px; object-fit:cover; object-position:top center; border-radius:3px; background:var(--surface2); }
  .cl-name { text-align:left; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cl-rank { color:var(--muted); font-family:'Barlow Condensed',sans-serif; }
  .cl-num { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:700; }
  .cl-sub2 { font-size:10px; color:var(--muted); }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .note { font-size:11px; color:var(--muted); letter-spacing:0.5px; line-height:1.6; margin-top:14px; }
  .note b { color:var(--text); }
  @media (max-width:720px){ .cl-row { grid-template-columns:28px 1.4fr 70px 70px 50px 56px; }
    .cl-row > div:nth-child(5), .cl-row > div:nth-child(6) { display:none; } }
`;

const tsColor = (ts) => ts >= 0.58 ? "var(--green)" : ts >= 0.50 ? "var(--gold)" : "var(--red)";
const pmColor = (pm) => pm > 0 ? "var(--green)" : pm < 0 ? "var(--red)" : "var(--muted)";

export default function Clutch() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/team/clutch`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const t = data?.team;

  return (
    <div className="page">
      <style>{css}</style>
      <div className="cl-head">
        <div className="cl-title">Clutch <span style={{ color:"var(--red)" }}>Performance</span></div>
        <div className="cl-sub">Last 5 minutes · score within 5 · {seasonLabel()}</div>
      </div>

      {loading ? <div className="loading">Loading clutch data…</div> : !data ? (
        <div className="loading">Could not load clutch data — is the backend running?</div>
      ) : (
        <>
          {t && (
            <div className="cl-summary">
              <div className="cl-stat gold">
                <div className="cl-stat-val" style={{ color:"var(--gold)" }}>{t.w}–{t.l}</div>
                <div className="cl-stat-lbl">Clutch Record</div>
              </div>
              <div className="cl-stat">
                <div className="cl-stat-val">{Math.round(t.w_pct*100)}%</div>
                <div className="cl-stat-lbl">Clutch Win %</div>
              </div>
              <div className={"cl-stat " + (t.plus_minus >= 0 ? "green" : "")}>
                <div className="cl-stat-val" style={{ color: t.plus_minus>=0?"var(--green)":"var(--red)" }}>
                  {t.plus_minus>0?"+":""}{t.plus_minus}
                </div>
                <div className="cl-stat-lbl">Net Points</div>
              </div>
              <div className="cl-stat">
                <div className="cl-stat-val">{(t.fg_pct*100).toFixed(1)}</div>
                <div className="cl-stat-lbl">Clutch FG %</div>
              </div>
              <div className="cl-stat">
                <div className="cl-stat-val">{(t.fg3_pct*100).toFixed(1)}</div>
                <div className="cl-stat-lbl">Clutch 3P %</div>
              </div>
            </div>
          )}

          <div className="section-header"><div className="section-title">Who Houston Trusts Late</div><div className="section-line" /></div>
          <div className="cl-table">
            <div className="cl-row head">
              <div>#</div><div>Player</div><div>MIN</div><div>PTS</div>
              <div>FG</div><div>3PT</div><div>TS%</div><div>+/−</div>
            </div>
            {data.players.map((p, i) => (
              <div className="cl-row" key={p.player_id}>
                <div className="cl-rank">{i+1}</div>
                <div className="cl-name" style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <img className="cl-headshot" src={headshot(p.player_id)} alt={p.name}
                       onError={e => { e.target.style.opacity = 0.12; }} />
                  {p.name}
                </div>
                <div className="cl-num">{p.min}</div>
                <div><span className="cl-num">{p.pts}</span><div className="cl-sub2">{p.pts_per_g}/g</div></div>
                <div><span className="cl-num">{(p.fg_pct*100).toFixed(0)}%</span><div className="cl-sub2">{p.fgm}-{p.fga}</div></div>
                <div><span className="cl-num">{(p.fg3_pct*100).toFixed(0)}%</span><div className="cl-sub2">{p.fg3m}-{p.fg3a}</div></div>
                <div className="cl-num" style={{ color: tsColor(p.ts_pct) }}>{(p.ts_pct*100).toFixed(0)}</div>
                <div className="cl-num" style={{ color: pmColor(p.plus_minus) }}>{p.plus_minus>0?"+":""}{p.plus_minus}</div>
              </div>
            ))}
          </div>

          <div className="note">
            <b>Clutch</b> = the NBA's official definition: the last 5 minutes of a game with the score within 5 points.
            Shooting percentages are computed from clutch box-score totals, and <b>TS%</b> (true shooting) folds in 3-pointers and free throws.
            <b> +/−</b> is the team's net points with that player on the floor in clutch time — a small sample, so read it alongside minutes.
          </div>
        </>
      )}
    </div>
  );
}
