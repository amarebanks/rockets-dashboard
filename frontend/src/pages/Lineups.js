import { useState, useEffect } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .lu-head { margin-bottom: 28px; }
  .lu-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .lu-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .section-header { display:flex; align-items:center; gap:12px; margin:8px 0 16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .lu-toggle { display:flex; gap:8px; margin-bottom:24px; }
  .lu-tab { font-family:'Barlow Condensed',sans-serif; font-size:13px; letter-spacing:1px; text-transform:uppercase;
    padding:8px 18px; border:1px solid var(--border); border-radius:3px; background:var(--surface); color:var(--muted);
    cursor:pointer; transition:all 0.15s; font-weight:700; }
  .lu-tab:hover { color:var(--text); border-color:var(--muted); }
  .lu-tab.active { background:var(--red); color:#fff; border-color:var(--red); }
  .lu-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:14px 18px; margin-bottom:10px;
    display:grid; grid-template-columns:1fr 110px 64px 70px; gap:16px; align-items:center; }
  .lu-names { font-weight:600; font-size:14px; line-height:1.35; }
  .lu-meta { font-size:11px; color:var(--muted); margin-top:3px; }
  .lu-bar-wrap { position:relative; height:8px; background:var(--surface2); border-radius:4px; overflow:hidden; }
  .lu-bar { position:absolute; top:0; bottom:0; border-radius:4px; }
  .lu-ortg { font-size:11px; color:var(--muted); text-align:right; white-space:nowrap; }
  .lu-ortg b { color:var(--text); font-family:'Barlow Condensed',sans-serif; font-size:14px; }
  .lu-net { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:800; text-align:right; }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .note { font-size:11px; color:var(--muted); letter-spacing:0.5px; line-height:1.6; margin-top:16px; }
  .note b { color:var(--text); }
  @media (max-width:720px){ .lu-card { grid-template-columns:1fr 70px; } .lu-bar-wrap, .lu-ortg { display:none; } }
`;

const netColor = (n) => n > 0 ? "var(--green)" : n < 0 ? "var(--red)" : "var(--muted)";
// Map a net rating (~ -20..+30) onto a centered bar.
const SCALE = 30;
const barProps = (net) => {
  const pct = Math.min(Math.abs(net) / SCALE, 1) * 50;
  return net >= 0
    ? { left: "50%", width: `${pct}%`, background: "var(--green)" }
    : { right: "50%", width: `${pct}%`, background: "var(--red)" };
};

function LineupCard({ r }) {
  return (
    <div className="lu-card">
      <div>
        <div className="lu-names">{r.lineup}</div>
        <div className="lu-meta">{r.min} min · {r.gp} games</div>
      </div>
      <div className="lu-bar-wrap">
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:"var(--border)" }} />
        <div className="lu-bar" style={barProps(r.net_rating)} />
      </div>
      <div className="lu-ortg">
        <b>{r.off_rating}</b> off<br/><b>{r.def_rating}</b> def
      </div>
      <div className="lu-net" style={{ color: netColor(r.net_rating) }}>
        {r.net_rating>0?"+":""}{r.net_rating}
      </div>
    </div>
  );
}

export default function Lineups() {
  const [size, setSize] = useState(5);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/team/lineups`, { params: { size } })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [size]);

  return (
    <div className="page">
      <style>{css}</style>
      <div className="lu-head">
        <div className="lu-title">Lineup <span style={{ color:"var(--red)" }}>Net Ratings</span></div>
        <div className="lu-sub">Which combinations actually work · {seasonLabel()}</div>
      </div>

      <div className="lu-toggle">
        {[2,3,5].map(s => (
          <div key={s} className={"lu-tab " + (size===s ? "active" : "")} onClick={() => setSize(s)}>
            {s}-Man
          </div>
        ))}
      </div>

      {loading ? <div className="loading">Loading lineups…</div> : !data || data.count === 0 ? (
        <div className="loading">No {size}-man lineups with enough minutes together.</div>
      ) : (
        <>
          <div className="section-header"><div className="section-title">Best Combinations</div><div className="section-line" /></div>
          {data.best.map((r, i) => <LineupCard key={i} r={r} />)}

          {data.worst.length > 0 && (
            <>
              <div className="section-header" style={{ marginTop:28 }}><div className="section-title">Struggled Together</div><div className="section-line" /></div>
              {data.worst.map((r, i) => <LineupCard key={i} r={r} />)}
            </>
          )}

          <div className="note">
            <b>Net rating</b> = points scored minus allowed per 100 possessions while that exact group is on the floor
            (<b>off</b> − <b>def</b>). Only combinations with a meaningful sample are shown
            ({size === 2 ? "80+" : size === 3 ? "50+" : "30+"} minutes together). Pair this with the Championship Builder —
            before trading for a need, check which groups already produce.
          </div>
        </>
      )}
    </div>
  );
}
