import { useState, useEffect, Fragment } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .ct-head { margin-bottom: 22px; }
  .ct-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .ct-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .ct-lines { display:flex; flex-wrap:wrap; gap:10px; margin:18px 0 26px; }
  .ct-line { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:10px 16px; min-width:120px; }
  .ct-line .lab { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .ct-line .val { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:800; margin-top:2px; }
  .ct-row { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:12px 16px; margin-bottom:8px;
    display:grid; grid-template-columns:48px 1fr 150px 96px 22px; gap:14px; align-items:center; cursor:default; }
  .ct-row.clickable { cursor:pointer; transition:border-color .15s; }
  .ct-row.clickable:hover { border-color:var(--muted); }
  .ct-abbr { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:800; letter-spacing:1px; }
  .ct-bar-wrap { position:relative; height:10px; background:var(--surface2); border-radius:5px; overflow:visible; }
  .ct-bar { position:absolute; top:0; bottom:0; left:0; border-radius:5px; }
  .ct-tick { position:absolute; top:-3px; bottom:-3px; width:1px; background:var(--border); }
  .ct-tick.tax { background:var(--gold); }
  .ct-tick.ap2 { background:var(--red); }
  .ct-pay { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:800; text-align:right; }
  .ct-pay small { font-size:11px; color:var(--muted); font-weight:600; }
  .ct-pill { font-size:9px; letter-spacing:1px; text-transform:uppercase; font-weight:800; padding:4px 8px; border-radius:3px; white-space:nowrap; text-align:center; }
  .ct-caret { color:var(--muted); font-size:12px; text-align:center; }
  .ct-relief { background:var(--surface2); border:1px solid var(--border); border-top:none; border-radius:0 0 4px 4px;
    margin:-8px 0 8px; padding:14px 18px; }
  .ct-relief h4 { font-family:'Barlow Condensed',sans-serif; font-size:14px; letter-spacing:1px; text-transform:uppercase; margin:0 0 4px; }
  .ct-relief .ov { font-size:12px; color:var(--muted); margin-bottom:10px; }
  .ct-relief .ov b { color:var(--red); }
  .ct-move { display:grid; grid-template-columns:1fr 130px 80px; gap:12px; align-items:center; padding:7px 0; border-top:1px solid var(--border); font-size:13px; }
  .ct-move .nm { font-weight:600; }
  .ct-move .act { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); }
  .ct-move .sv { text-align:right; font-family:'Barlow Condensed',sans-serif; font-weight:800; color:var(--green); }
  .ct-clabel { font-size:9px; letter-spacing:1px; text-transform:uppercase; font-weight:800; padding:2px 6px; border-radius:3px; }
  .ct-cuts-head { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-top:12px; }
  .ct-cuts-head span { text-transform:none; letter-spacing:0; }
  .ct-cuts { display:flex; flex-wrap:wrap; gap:6px; margin-top:7px; }
  .ct-cut { font-size:12px; background:var(--surface); border:1px solid var(--border); border-radius:3px; padding:4px 9px; color:var(--muted); }
  .ct-cut b { color:var(--text); font-family:'Barlow Condensed',sans-serif; }
  .ct-note { font-size:11px; color:var(--muted); line-height:1.6; margin-top:12px; }
  .ct-note b { color:var(--text); }
  .ct-roster { margin-top:14px; display:grid; grid-template-columns:1fr auto 88px; gap:5px 14px; font-size:12px; align-items:baseline; }
  .ct-roster .rn { color:var(--text); }
  .ct-roster .rt { color:var(--muted); font-size:10px; letter-spacing:0.5px; text-align:right; white-space:nowrap; }
  .ct-roster .rs { text-align:right; color:var(--gold); font-family:'Barlow Condensed',sans-serif; font-weight:700; }
  .ct-roster-head { grid-column:1/-1; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:8px; border-top:1px solid var(--border); padding-top:8px; }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .legend { font-size:11px; color:var(--muted); letter-spacing:0.5px; line-height:1.7; margin-top:18px; }
  .legend b { color:var(--text); }
`;

const STATUS = {
  room:         { bg:"rgba(74,158,255,0.15)", c:"#4a9eff", label:"Cap Room" },
  over_cap:     { bg:"rgba(150,150,150,0.15)", c:"var(--muted)", label:"Over Cap" },
  taxpayer:     { bg:"rgba(196,162,101,0.18)", c:"var(--gold)", label:"Taxpayer" },
  first_apron:  { bg:"rgba(255,140,60,0.18)", c:"#ff8c3c", label:"First Apron" },
  second_apron: { bg:"rgba(206,17,65,0.20)", c:"var(--red)", label:"Second Apron" },
};
const CLABEL = {
  "Bargain":      { bg:"rgba(46,204,113,0.16)", c:"var(--green)" },
  "Value":        { bg:"rgba(46,204,113,0.12)", c:"var(--green)" },
  "Fair":         { bg:"rgba(150,150,150,0.14)", c:"var(--muted)" },
  "Overpaid":     { bg:"rgba(255,140,60,0.16)", c:"#ff8c3c" },
  "Bad contract": { bg:"rgba(206,17,65,0.18)", c:"var(--red)" },
  "Fringe":        { bg:"rgba(150,150,150,0.16)", c:"var(--muted)" },
  "Rotation piece":{ bg:"rgba(74,158,255,0.13)", c:"#4a9eff" },
};

const MAX_SCALE = 235; // $M, right edge of the payroll bar

export default function Contracts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);          // team abbr expanded
  const [details, setDetails] = useState({});      // abbr -> /contracts/team payload

  useEffect(() => {
    axios.get(`${API}/contracts/cap`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (abbr) => {
    if (open === abbr) { setOpen(null); return; }
    setOpen(abbr);
    if (!details[abbr]) {
      axios.get(`${API}/contracts/team/${abbr}`)
        .then(r => setDetails(d => ({ ...d, [abbr]: r.data })))
        .catch(() => {});
    }
  };

  if (loading) return <div className="page"><style>{css}</style><div className="loading">Loading cap sheets…</div></div>;
  if (!data) return <div className="page"><style>{css}</style><div className="loading">Cap data unavailable.</div></div>;

  const L = data.lines;
  const tickPct = (m) => Math.min(m / MAX_SCALE, 1) * 100;

  return (
    <div className="page">
      <style>{css}</style>
      <div className="ct-head">
        <div className="ct-title">Salary <span style={{ color:"var(--red)" }}>Caps</span></div>
        <div className="ct-sub">Team payrolls vs the cap, tax & aprons · {seasonLabel()}</div>
      </div>

      <div className="ct-lines">
        {[["Salary Cap","cap"],["Luxury Tax","tax"],["First Apron","apron1"],["Second Apron","apron2"]].map(([lab,k]) => (
          <div className="ct-line" key={k}>
            <div className="lab">{lab}</div>
            <div className="val">${L[k]}M</div>
          </div>
        ))}
      </div>

      {data.teams.map(t => {
        const st = STATUS[t.status] || STATUS.over_cap;
        const d = details[t.team];
        return (
          <div key={t.team}>
            <div className="ct-row clickable" onClick={() => toggle(t.team)}>
              <div className="ct-abbr">{t.team}</div>
              <div className="ct-bar-wrap">
                <div className="ct-bar" style={{ width:`${tickPct(t.committed_m)}%`, background: st.c }} />
                <div className="ct-tick tax" style={{ left:`${tickPct(L.tax)}%` }} title="Luxury tax" />
                <div className="ct-tick" style={{ left:`${tickPct(L.apron1)}%` }} title="First apron" />
                <div className="ct-tick ap2" style={{ left:`${tickPct(L.apron2)}%` }} title="Second apron" />
              </div>
              <div className="ct-pill" style={{ background: st.bg, color: st.c }}>{st.label}</div>
              <div className="ct-pay">${t.committed_m}M<br/><small>{t.tax_m > 0 ? `+$${t.tax_m}M tax` : `$${Math.abs(t.room_m)}M ${t.room_m >= 0 ? "room" : "over"}`}</small></div>
              <div className="ct-caret">{open === t.team ? "▲" : "▼"}</div>
            </div>

            {open === t.team && (
              <div className="ct-relief">
                {!d ? <div style={{ color:"var(--muted)", fontSize:12 }}>Loading…</div> : (
                  <>
                    {d.relief_plan ? (
                      <>
                        <h4>Getting under the {d.relief_plan.target_line}</h4>
                        <div className="ov">
                          ${d.relief_plan.committed_m}M committed - <b>${d.relief_plan.overage_m}M over</b> the {d.relief_plan.target_line}.
                          {d.relief_plan.moves.length > 0 ? " Most likely trades:" : ""}
                        </div>
                        {d.relief_plan.moves.map((m, i) => {
                          const cl = CLABEL[m.label] || CLABEL["Fair"];
                          return (
                            <div className="ct-move" key={i}>
                              <div>
                                <span className="nm">{m.name}</span>{" "}
                                <span className="ct-clabel" style={{ background: cl.bg, color: cl.c }}>{m.label}</span>
                                <div className="act">{m.action} · ${m.salary_m}M</div>
                              </div>
                              <div className="act" style={{ textAlign:"right" }}>frees up</div>
                              <div className="sv">${m.saves_m}M</div>
                            </div>
                          );
                        })}
                        {d.relief_plan.potential_cuts && d.relief_plan.potential_cuts.length > 0 && (
                          <>
                            <div className="ct-cuts-head">Potential cuts <span>- small deals, waivable for minor relief</span></div>
                            <div className="ct-cuts">
                              {d.relief_plan.potential_cuts.map((c, i) => (
                                <span className="ct-cut" key={i}>{c.name} <b>${c.salary_m}M</b></span>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="ct-note">{d.relief_plan.note}</div>
                      </>
                    ) : (
                      <div className="ct-note">This team is within the apron lines - no relief moves needed.</div>
                    )}

                    {d.contracts && d.contracts.length > 0 && (
                      <div className="ct-roster">
                        <div className="ct-roster-head">Contracts - current cap hit · term · total remaining</div>
                        {d.contracts.map((c, i) => (
                          <Fragment key={i}>
                            <div className="rn">
                              {c.name}
                              {d.relief_plan && d.relief_plan.best_player === c.name && (
                                <span style={{ color:"var(--gold)", fontSize:10, marginLeft:6 }}>★ keep</span>
                              )}
                            </div>
                            <div className="rt">
                              {c.years_left ? `${c.years_left}yr${c.option ? " " + c.option : ""}` : ""}
                              {c.expires ? ` · FA ${c.expires}` : ""}
                              {c.total_remaining_m ? ` · $${c.total_remaining_m}M total` : ""}
                            </div>
                            <div className="rs">${c.salary_m}M</div>
                          </Fragment>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div className="legend">
        <b>Tap any taxpayer/apron team</b> to see the most likely moves it would make to get back under the line -
        teams shed <b>bad contracts</b> first, then overpaid vets, and never move their best player or stars for cap
        relief (marked <span style={{ color:"var(--gold)" }}>★ keep</span>). The two <b>aprons</b> are
        hard spending limits that restrict how a team can build (trades, exceptions, draft picks), so front offices work
        hard to duck under them. Salaries are curated approximations - edit <b>backend/contracts.py</b> to refine them.
      </div>
    </div>
  );
}
