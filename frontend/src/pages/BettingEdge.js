import { useState, useEffect } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .be-head { margin-bottom: 28px; }
  .be-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .be-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .be-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:24px; margin-bottom:28px; }
  .be-form { display:grid; grid-template-columns:1fr 1fr auto; gap:14px; align-items:end; }
  .be-field label { display:block; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
  .be-select, .be-odds { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:2px; color:var(--text);
    font-family:'Barlow',sans-serif; font-size:14px; padding:10px 12px; outline:none; }
  .be-select:focus, .be-odds:focus { border-color:var(--red); }
  .be-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .be-btn { font-family:'Barlow Condensed',sans-serif; font-size:13px; letter-spacing:2px; text-transform:uppercase; font-weight:700;
    padding:11px 22px; border-radius:2px; border:none; background:var(--red); color:#fff; cursor:pointer; white-space:nowrap; }
  .be-btn:hover { background:var(--dark-red); }
  .result-grid { display:grid; grid-template-columns:1fr auto 1fr; gap:16px; align-items:stretch; margin-top:8px; }
  .team-panel { background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:18px; text-align:center; position:relative; }
  .team-panel.value { border-color:var(--green); box-shadow:0 0 0 1px var(--green) inset; }
  .tp-abbr { font-family:'Barlow Condensed',sans-serif; font-size:30px; font-weight:900; }
  .tp-elo { font-size:10px; letter-spacing:1px; color:var(--gold); text-transform:uppercase; margin-top:2px; }
  .tp-line { display:flex; justify-content:space-between; font-size:12px; padding:5px 0; border-bottom:1px solid var(--border); }
  .tp-line:last-child { border-bottom:none; }
  .tp-line .k { color:var(--muted); }
  .tp-line .v { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; }
  .edge-big { font-family:'Barlow Condensed',sans-serif; font-size:34px; font-weight:900; line-height:1; margin:10px 0 2px; }
  .value-badge { position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:var(--green); color:#000;
    font-size:9px; letter-spacing:1px; text-transform:uppercase; font-weight:700; padding:3px 10px; border-radius:2px; white-space:nowrap; }
  .vs-mid { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; }
  .vs-mid .vs { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:700; color:var(--border); }
  .vig { font-size:10px; color:var(--muted); letter-spacing:1px; text-align:center; }
  .pos { color:var(--green); } .neg { color:var(--muted); }
  .game-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:16px 18px; margin-bottom:10px; }
  .game-card.value { border-left:3px solid var(--green); }
  .game-top { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
  .game-match { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; }
  .game-time { font-size:11px; color:var(--muted); }
  .edge-tag { font-family:'Barlow Condensed',sans-serif; font-size:13px; letter-spacing:1px; text-transform:uppercase; padding:4px 10px; border-radius:2px; font-weight:700; }
  .setup-card { background:var(--surface); border:1px dashed var(--border); border-radius:4px; padding:24px; }
  .setup-card code { background:var(--surface2); padding:2px 7px; border-radius:3px; color:var(--gold); font-size:12px; }
  .setup-step { font-size:13px; color:var(--muted); margin:8px 0; line-height:1.5; }
  .loading { display:flex; align-items:center; justify-content:center; height:120px; color:var(--muted); font-size:12px; letter-spacing:2px; text-transform:uppercase; }
  .disclaimer { font-size:10px; color:var(--muted); letter-spacing:1px; margin-top:10px; line-height:1.6; }
`;

const fmtOdds = (o) => (o > 0 ? `+${o}` : `${o}`);
const edgeColor = (e) => e >= 3 ? "var(--green)" : e <= -3 ? "var(--red)" : "var(--muted)";

function TeamPanel({ side, abbr, elo, name }) {
  return (
    <div className={`team-panel ${side.value ? "value" : ""}`}>
      {side.value && <div className="value-badge">★ Value Bet</div>}
      <div className="tp-abbr">{abbr}</div>
      <div className="tp-elo">Elo {elo}</div>
      <div className="edge-big" style={{ color: edgeColor(side.edge) }}>
        {side.edge > 0 ? "+" : ""}{side.edge}%
      </div>
      <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"var(--muted)", marginBottom:10 }}>Edge</div>
      <div className="tp-line"><span className="k">Model</span><span className="v">{side.model_prob}%</span></div>
      <div className="tp-line"><span className="k">Fair price</span><span className="v">{side.market_prob}%</span></div>
      <div className="tp-line"><span className="k">Odds</span><span className="v">{fmtOdds(side.odds)}</span></div>
      <div className="tp-line"><span className="k">EV / $100</span><span className="v" style={{ color: side.ev_pct > 0 ? "var(--green)" : "var(--muted)" }}>{side.ev_pct > 0 ? "+" : ""}${side.ev_pct}</span></div>
      <div className="tp-line"><span className="k">Kelly stake</span><span className="v">{side.kelly_pct}%</span></div>
    </div>
  );
}

export default function BettingEdge() {
  const [teams, setTeams]   = useState([]);
  const [home, setHome]     = useState("HOU");
  const [away, setAway]     = useState("");
  const [homeOdds, setHO]   = useState(-150);
  const [awayOdds, setAO]   = useState(130);
  const [result, setResult] = useState(null);
  const [evaluating, setEval] = useState(false);

  const [live, setLive]     = useState(null);
  const [liveLoading, setLL] = useState(true);

  useEffect(() => {
    axios.get(`${API}/predict/teams`).then(r => {
      setTeams(r.data.teams);
      const firstAway = r.data.teams.find(t => t.abbr !== "HOU");
      if (firstAway) setAway(firstAway.abbr);
    });
    axios.get(`${API}/betting/edges`)
      .then(r => { setLive(r.data); setLL(false); })
      .catch(() => { setLive(null); setLL(false); });
  }, []);

  const evaluate = () => {
    if (!home || !away || home === away) return;
    setEval(true);
    axios.get(`${API}/betting/evaluate`, { params: { home, away, home_odds: homeOdds, away_odds: awayOdds } })
      .then(r => { setResult(r.data); setEval(false); })
      .catch(() => setEval(false));
  };

  return (
    <div className="page">
      <style>{css}</style>
      <div className="be-head">
        <div className="be-title">Betting <span style={{ color:"var(--red)" }}>Edge</span></div>
        <div className="be-sub">Elo model vs sportsbook lines · value finder</div>
      </div>

      {/* Manual evaluator */}
      <div className="section-header">
        <div className="section-title">Odds Evaluator</div>
        <div className="section-line" />
      </div>
      <div className="be-card">
        <div className="be-form">
          <div className="be-field">
            <label>Home Team</label>
            <select className="be-select" value={home} onChange={e => setHome(e.target.value)}>
              {teams.map(t => <option key={t.abbr} value={t.abbr}>{t.name} ({t.abbr})</option>)}
            </select>
            <div style={{ marginTop:8 }}>
              <label>Home Moneyline</label>
              <input className="be-odds" type="number" value={homeOdds} onChange={e => setHO(parseInt(e.target.value || 0))} />
            </div>
          </div>
          <div className="be-field">
            <label>Away Team</label>
            <select className="be-select" value={away} onChange={e => setAway(e.target.value)}>
              {teams.map(t => <option key={t.abbr} value={t.abbr}>{t.name} ({t.abbr})</option>)}
            </select>
            <div style={{ marginTop:8 }}>
              <label>Away Moneyline</label>
              <input className="be-odds" type="number" value={awayOdds} onChange={e => setAO(parseInt(e.target.value || 0))} />
            </div>
          </div>
          <button className="be-btn" onClick={evaluate} disabled={evaluating}>
            {evaluating ? "…" : "Find Edge"}
          </button>
        </div>

        {result && (
          <>
            <div className="result-grid" style={{ marginTop:24 }}>
              <TeamPanel side={result.home} abbr={result.home_team.abbr} elo={result.home_team.elo} />
              <div className="vs-mid"><div className="vs">VS</div></div>
              <TeamPanel side={result.away} abbr={result.away_team.abbr} elo={result.away_team.elo} />
            </div>
            <div className="vig" style={{ marginTop:12 }}>
              Book vig: {result.vig_pct}% · {result.value_side
                ? <span className="pos">✓ Value on {result[result.value_side + "_team"].abbr}</span>
                : <span>No edge ≥ 3% - pass</span>}
            </div>
          </>
        )}
        <div className="disclaimer">
          Model uses {seasonLabel()} Elo ratings (incl. home court). "Fair price" removes the book's vig. Edge = model probability − fair probability.
          Positive EV / Kelly &gt; 0 indicate a mathematically favorable bet. For entertainment & research - bet responsibly.
        </div>
      </div>

      {/* Live edges */}
      <div className="section-header">
        <div className="section-title">Live Value Bets</div>
        <div className="section-line" />
      </div>
      {liveLoading ? (
        <div className="loading">Loading odds…</div>
      ) : !live || (live.configured && live.error) ? (
        <div className="setup-card">Couldn't fetch live odds{live && live.error ? `: ${live.error}` : "."}</div>
      ) : !live.configured || live.games.length === 0 ? (
        <div className="setup-card">
          Live value bets appear here when sportsbook odds are available. Use the Odds Evaluator above to check any line.
        </div>
      ) : (
        live.games.map((g, i) => {
          const v = g.value_side ? g[g.value_side] : null;
          return (
            <div className={`game-card ${g.value_side ? "value" : ""}`} key={i}>
              <div className="game-top">
                <div>
                  <div className="game-match">{g.away_team.abbr} @ {g.home_team.abbr}</div>
                  <div className="game-time">
                    {g.commence_time ? new Date(g.commence_time).toLocaleString() : ""} · {g.books} books · vig {g.vig_pct}%
                  </div>
                </div>
                {g.value_side ? (
                  <div className="edge-tag" style={{ background:"rgba(74,222,128,0.15)", color:"var(--green)", border:"1px solid rgba(74,222,128,0.4)" }}>
                    ★ {g[g.value_side + "_team"].abbr} {fmtOdds(v.odds)} · +{v.edge}% edge · {v.kelly_pct}% Kelly
                  </div>
                ) : (
                  <div className="edge-tag" style={{ color:"var(--muted)", border:"1px solid var(--border)" }}>No edge</div>
                )}
              </div>
              <div style={{ display:"flex", gap:18, marginTop:10, fontSize:12, color:"var(--muted)" }}>
                <span>{g.home_team.abbr}: model {g.home.model_prob}% vs fair {g.home.market_prob}% ({fmtOdds(g.home.odds)})</span>
                <span>{g.away_team.abbr}: model {g.away.model_prob}% vs fair {g.away.market_prob}% ({fmtOdds(g.away.odds)})</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
