import { useState, useEffect } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";
const headshot = (id) => `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${id}.png`;

const css = `
  .ti-head { margin-bottom: 28px; }
  .ti-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .ti-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .needs-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:20px 24px; margin-bottom:32px; }
  .need-row { display:grid; grid-template-columns:150px 1fr 70px; align-items:center; gap:14px; padding:9px 0; border-bottom:1px solid var(--border); }
  .need-row:last-child { border-bottom:none; }
  .need-name { font-size:13px; font-weight:500; }
  .need-track { height:9px; background:var(--surface2); border-radius:5px; overflow:hidden; }
  .need-bar { height:100%; border-radius:5px; transition:width 0.4s; }
  .need-rank { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; text-align:right; color:var(--muted); }
  .idea-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:20px; margin-bottom:16px; }
  .idea-top { display:grid; grid-template-columns:1fr auto 1fr; gap:18px; align-items:center; }
  .idea-target { display:flex; gap:14px; align-items:center; }
  .idea-headshot { width:78px; height:57px; object-fit:cover; object-position:top center; border-radius:4px; background:var(--surface2); border:1px solid var(--border); flex-shrink:0; }
  .idea-name { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:800; text-transform:uppercase; line-height:1; }
  .idea-team { font-size:11px; letter-spacing:1px; color:var(--muted); margin-top:3px; }
  .idea-meta { display:flex; gap:8px; align-items:center; margin-top:5px; flex-wrap:wrap; }
  .avail-pill { font-size:9px; letter-spacing:1px; text-transform:uppercase; padding:2px 8px; border-radius:2px; font-weight:700; white-space:nowrap; }
  .rec-pill { font-size:10px; letter-spacing:0.5px; color:var(--muted); }
  .idea-statline { font-size:12px; color:var(--muted); margin-top:6px; }
  .idea-statline b { color:var(--text); }
  .addr-badges { margin-top:7px; display:flex; gap:5px; flex-wrap:wrap; }
  .addr-badge { font-size:9px; letter-spacing:1px; text-transform:uppercase; background:rgba(74,222,128,0.12); color:var(--green); border:1px solid rgba(74,222,128,0.3); padding:2px 7px; border-radius:2px; }
  .idea-arrow { font-size:26px; color:var(--border); text-align:center; }
  .idea-gives-label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:7px; }
  .give-row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 10px; background:var(--surface2); border-radius:3px; margin-bottom:5px; font-size:13px; }
  .give-val { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:700; color:var(--gold); }
  .give-pick { color:var(--muted); }
  .idea-foot { display:flex; align-items:center; gap:14px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
  .verdict-chip { font-family:'Barlow Condensed',sans-serif; font-size:13px; letter-spacing:1px; text-transform:uppercase; padding:4px 12px; border-radius:2px; font-weight:700; white-space:nowrap; }
  .ti-allstar { display:inline-block; font-size:9px; letter-spacing:1px; text-transform:uppercase; background:var(--gold); color:#000; padding:2px 6px; border-radius:2px; margin-left:8px; vertical-align:middle; font-weight:700; }
  .rationale { font-size:13px; color:var(--muted); line-height:1.5; flex:1; }
  .fit-pill { font-family:'Barlow Condensed',sans-serif; font-size:13px; color:var(--muted); }
  .fit-pill b { color:var(--green); font-size:16px; }
  .loading { display:flex; align-items:center; justify-content:center; height:240px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .core-line { font-size:12px; color:var(--muted); margin-top:10px; letter-spacing:0.5px; }
  .core-line b { color:var(--text); }
  @media (max-width:760px){ .idea-top { grid-template-columns:1fr; } .idea-arrow { transform:rotate(90deg); } }
`;

const needColor = (w) => w >= 0.66 ? "var(--red)" : w >= 0.4 ? "var(--gold)" : "#4ade80";
const availStyle = (label) => {
  if (label === "Likely available") return { background:"rgba(74,222,128,0.14)", color:"var(--green)", border:"1px solid rgba(74,222,128,0.35)" };
  if (label === "Possible")         return { background:"rgba(196,162,101,0.14)", color:"var(--gold)", border:"1px solid rgba(196,162,101,0.35)" };
  return { background:"rgba(206,17,65,0.12)", color:"var(--red)", border:"1px solid rgba(206,17,65,0.3)" };
};
const verdictStyle = (v) => {
  if (v === "Fair value")   return { background: "rgba(74,222,128,0.15)", color: "var(--green)", border: "1px solid rgba(74,222,128,0.4)" };
  if (v === "Rockets overpay") return { background: "rgba(196,162,101,0.15)", color: "var(--gold)", border: "1px solid rgba(196,162,101,0.4)" };
  return { background: "rgba(206,17,65,0.15)", color: "var(--red)", border: "1px solid rgba(206,17,65,0.4)" };
};

export default function TradeIdeas() {
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    axios.get(`${API}/trade/ideas`)
      .then(r => { setData(r.data); setLoad(false); })
      .catch(() => { setError(true); setLoad(false); });
  }, []);

  return (
    <div className="page">
      <style>{css}</style>
      <div className="ti-head">
        <div className="ti-title">Championship <span style={{ color:"var(--red)" }}>Builder</span></div>
        <div className="ti-sub">Trade ideas to fix Houston's weaknesses · {seasonLabel()}</div>
      </div>

      {loading ? (
        <div className="loading">Analyzing roster & scanning the league…</div>
      ) : error || !data ? (
        <div className="loading">Could not load trade ideas — is the backend running?</div>
      ) : (
        <>
          {/* Team needs */}
          <div className="section-header">
            <div className="section-title">Roster Needs</div>
            <div className="section-line" />
          </div>
          <div className="needs-card">
            {data.needs.map(n => (
              <div className="need-row" key={n.category}>
                <div className="need-name">{n.category}</div>
                <div className="need-track">
                  <div className="need-bar" style={{ width:`${Math.round(n.weight*100)}%`, background:needColor(n.weight) }} />
                </div>
                <div className="need-rank" style={{ color: needColor(n.weight) }}>{n.rank}/30</div>
              </div>
            ))}
            {(data.protected_core?.length > 0 || data.rockets_core.length > 0) && (
              <div className="core-line">
                Untouchable core: <b>{(data.protected_core?.length ? data.protected_core : [data.rockets_core[0]?.name]).join(", ")}</b>
                {" "}· trade chips drawn from the rest of the roster + draft picks.
              </div>
            )}
          </div>

          {/* Ideas */}
          <div className="section-header">
            <div className="section-title">Suggested Trades</div>
            <div className="section-line" />
          </div>
          {data.ideas.length === 0 && <div className="loading">No fitting trades found.</div>}
          {data.ideas.map((idea, idx) => {
            const t = idea.target;
            return (
              <div className="idea-card" key={idx}>
                <div className="idea-top">
                  {/* Target */}
                  <div className="idea-target">
                    <img className="idea-headshot" src={headshot(t.player_id)} alt={t.name}
                         onError={e => { e.target.style.opacity = 0.12; }} />
                    <div>
                      <div className="idea-name">
                        {t.name}
                        {t.is_allstar && <span className="ti-allstar">★ All-Star</span>}
                      </div>
                      <div className="idea-team">{t.team}</div>
                      <div className="idea-meta">
                        {t.available_label && (
                          <span className="avail-pill" style={availStyle(t.available_label)}>
                            {t.available_label}{t.availability != null ? ` · ${t.availability}%` : ""}
                          </span>
                        )}
                        {t.team_record && <span className="rec-pill">{t.team} {t.team_record}</span>}
                      </div>
                      <div className="idea-statline">
                        <b>{t.stats.pts}</b> PTS · <b>{t.stats.ast}</b> AST · <b>{t.stats.reb}</b> REB · <b>{t.stats.fg3_pct}%</b> 3P · <b>{t.stats.usg_pct}%</b> USG
                      </div>
                      <div className="addr-badges">
                        {t.addresses.map(a => <span className="addr-badge" key={a}>{a}</span>)}
                      </div>
                    </div>
                  </div>

                  <div className="idea-arrow">⇄</div>

                  {/* Package */}
                  <div>
                    <div className="idea-gives-label">Houston sends</div>
                    {idea.gives.map((g, i) => (
                      <div className="give-row" key={i}>
                        <span className={g.type === "pick" ? "give-pick" : ""}>
                          {g.type === "pick" ? "🏀 " : ""}{g.name}
                        </span>
                        <span className="give-val">{g.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="idea-foot">
                  <span className="verdict-chip" style={verdictStyle(idea.fairness.verdict)}>
                    {idea.fairness.verdict} ({idea.fairness.diff_pct > 0 ? "+" : ""}{idea.fairness.diff_pct}%)
                  </span>
                  <span className="fit-pill">Fit <b>{t.fit}</b></span>
                  <span className="rationale">{idea.rationale}</span>
                </div>
              </div>
            );
          })}

          <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, marginTop:8, lineHeight:1.6 }}>
            Targets are filtered by trade availability — a player's team record (seller vs. contender), his role on that team, age,
            and star tier decide whether he'd realistically be moved, so untouchable stars are screened out. Remaining targets are ranked
            by need-fit, value, and gettability. Packages follow real-deal structure: an up-and-coming player (or two) plus pick compensation
            — not one-for-one swaps — value-matched with the star-premium + diminishing-returns model and tailored to the seller (youth and
            picks for rebuilders, win-now help for contenders). Only Houston's two cornerstones are off-limits. Fit-based, not salary-cap matched.
          </div>
        </>
      )}
    </div>
  );
}
