import { useState, useEffect } from "react";
import axios from "axios";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .pred-head { margin-bottom: 32px; }
  .pred-title { font-family: 'Barlow Condensed',sans-serif; font-size: 36px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
  .pred-sub { color: var(--muted); font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
  .pred-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 28px; }
  .pred-select { background: var(--surface2); border: 1px solid var(--border); border-radius: 2px; color: var(--text);
    font-family: 'Barlow',sans-serif; font-size: 14px; padding: 10px 14px; outline: none; min-width: 220px; }
  .pred-select:focus { border-color: var(--red); }
  .pred-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
  .pred-toggle button { background: var(--surface2); color: var(--muted); border: none; padding: 10px 18px; cursor: pointer;
    font-family: 'Barlow Condensed',sans-serif; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
  .pred-toggle button.active { background: var(--red); color: #fff; }
  .matchup-card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 32px; margin-bottom: 28px; }
  .matchup-grid { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 20px; }
  .team-side { text-align: center; }
  .team-abbr { font-family: 'Barlow Condensed',sans-serif; font-size: 40px; font-weight: 900; letter-spacing: 1px; }
  .team-abbr.hou { color: var(--red); }
  .team-name { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .team-elo { font-size: 11px; letter-spacing: 1px; color: var(--gold); text-transform: uppercase; margin-top: 8px; }
  .team-prob { font-family: 'Barlow Condensed',sans-serif; font-size: 56px; font-weight: 700; line-height: 1; margin-top: 14px; }
  .team-score { font-size: 13px; color: var(--muted); margin-top: 6px; }
  .vs { font-family: 'Barlow Condensed',sans-serif; font-size: 22px; font-weight: 700; color: var(--border); }
  .prob-bar { height: 10px; border-radius: 6px; overflow: hidden; display: flex; margin-top: 26px; background: var(--surface2); }
  .prob-bar .hou-fill { background: var(--red); }
  .prob-bar .opp-fill { background: var(--gold); }
  .verdict { text-align: center; margin-top: 20px; font-size: 14px; color: var(--muted); }
  .verdict b { color: var(--text); }
  .power-card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
  .power-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .power-table th { background: var(--surface2); padding: 10px 14px; text-align: left; font-size: 10px; letter-spacing: 2px;
    text-transform: uppercase; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); }
  .power-table th.num { text-align: right; }
  .power-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
  .power-table td.num { text-align: right; font-family: 'Barlow Condensed',sans-serif; font-size: 16px; font-weight: 600; }
  .power-table tr:last-child td { border-bottom: none; }
  .power-table tr.hou-row td { background: rgba(206,17,65,0.08); }
  .power-rank { font-family: 'Barlow Condensed',sans-serif; font-weight: 700; color: var(--border); }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
`;

export default function Predictor() {
  const [teams, setTeams]       = useState([]);
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("home");
  const [prediction, setPred]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    axios.get(`${API}/predict/teams`).then(r => {
      const list = r.data.teams.filter(t => t.abbr !== "HOU");
      setTeams(r.data.teams);
      if (list.length) setOpponent(list[0].abbr);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!opponent) return;
    axios.get(`${API}/predict`, { params: { opponent, location } })
      .then(r => setPred(r.data))
      .catch(() => setPred(null));
  }, [opponent, location]);

  const opponents = teams.filter(t => t.abbr !== "HOU");

  return (
    <div className="page">
      <style>{css}</style>
      <div className="pred-head">
        <div className="pred-title">Game <span style={{ color: "var(--red)" }}>Predictor</span></div>
        <div className="pred-sub">Elo model · {seasonLabel()} results</div>
      </div>

      {loading ? <div className="loading">Building Elo ratings…</div> : (
        <>
          <div className="pred-controls">
            <select className="pred-select" value={opponent} onChange={e => setOpponent(e.target.value)}>
              {opponents.map(t => (
                <option key={t.abbr} value={t.abbr}>{t.name} ({t.abbr})</option>
              ))}
            </select>
            <div className="pred-toggle">
              <button className={location === "home" ? "active" : ""} onClick={() => setLocation("home")}>vs (Home)</button>
              <button className={location === "away" ? "active" : ""} onClick={() => setLocation("away")}>@ (Away)</button>
            </div>
          </div>

          {prediction && (
            <div className="matchup-card">
              <div className="matchup-grid">
                <div className="team-side">
                  <div className="team-abbr hou">{prediction.rockets.abbr}</div>
                  <div className="team-name">{prediction.rockets.name}</div>
                  <div className="team-elo">Elo {prediction.rockets.elo}</div>
                  <div className="team-prob" style={{ color: "var(--red)" }}>{prediction.rockets.win_prob}%</div>
                  <div className="team-score">Proj. {prediction.rockets.proj_score}</div>
                </div>
                <div className="vs">VS</div>
                <div className="team-side">
                  <div className="team-abbr">{prediction.opponent.abbr}</div>
                  <div className="team-name">{prediction.opponent.name}</div>
                  <div className="team-elo">Elo {prediction.opponent.elo}</div>
                  <div className="team-prob" style={{ color: "var(--gold)" }}>{prediction.opponent.win_prob}%</div>
                  <div className="team-score">Proj. {prediction.opponent.proj_score}</div>
                </div>
              </div>
              <div className="prob-bar">
                <div className="hou-fill" style={{ width: `${prediction.rockets.win_prob}%` }} />
                <div className="opp-fill" style={{ width: `${prediction.opponent.win_prob}%` }} />
              </div>
              <div className="verdict">
                Projected: <b>{prediction.rockets.abbr} {prediction.rockets.proj_score}</b> – <b>{prediction.opponent.proj_score} {prediction.opponent.abbr}</b>
                {"  ·  "}<b>{prediction.favorite}</b> favored
              </div>
            </div>
          )}

          <div className="section-header" style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>League Power Ratings</div>
            <div style={{ flex:1, height:1, background:"var(--border)" }} />
          </div>
          <div className="power-card">
            <table className="power-table">
              <thead>
                <tr><th>#</th><th>Team</th><th className="num">Elo</th><th className="num">W–L</th><th className="num">PPG</th><th className="num">OPP PPG</th></tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.abbr} className={t.abbr === "HOU" ? "hou-row" : ""} style={{ cursor: t.abbr !== "HOU" ? "pointer" : "default" }}
                      onClick={() => t.abbr !== "HOU" && setOpponent(t.abbr)}>
                    <td className="power-rank">{t.rank}</td>
                    <td>{t.name} <span style={{ color:"var(--muted)", fontSize:11 }}>{t.abbr}</span></td>
                    <td className="num" style={{ color:"var(--gold)" }}>{t.elo}</td>
                    <td className="num">{t.wins}–{t.losses}</td>
                    <td className="num">{t.off_ppg}</td>
                    <td className="num">{t.def_ppg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
