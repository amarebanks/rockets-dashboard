import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

const css = `
  .dash-head { margin-bottom: 44px; }
  .dash-eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--faint); margin-bottom: 10px; }
  .dash-title { font-family: var(--display); font-size: 40px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.05; }
  .dash-title span { color: var(--accent); }

  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px;
    background: var(--border); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 56px; }
  .stat-card { background: var(--surface); padding: 22px 20px; }
  .stat-card-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .stat-card-value { font-family: var(--display); font-size: 38px; font-weight: 500; line-height: 1; letter-spacing: -0.02em; }
  .stat-card-value.red { color: var(--accent); }
  .stat-card-value.green { color: var(--pos); }
  .stat-card-value.gold { color: var(--text); }
  .stat-card-sub { font-size: 12px; color: var(--muted); margin-top: 8px; }

  .section-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 20px; }
  .section-title { font-family: var(--display); font-size: 16px; font-weight: 500; letter-spacing: -0.01em; white-space: nowrap; }
  .section-line { flex: 1; height: 1px; background: var(--border); }

  .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 28px; margin-bottom: 56px; }
  .leaders-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 56px; }
  .leader-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px; }
  .leader-card-title { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
  .leader-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .leader-row:last-child { border-bottom: none; }
  .leader-rank { font-family: var(--display); font-size: 15px; font-weight: 500; color: var(--faint); width: 18px; flex-shrink: 0; }
  .leader-rank.top { color: var(--accent); }
  .leader-name { font-size: 13px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .leader-name:hover { color: var(--accent); }
  .leader-avg { font-family: var(--display); font-size: 17px; font-weight: 500; color: var(--text); }

  .table-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 56px; }
  .players-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .players-table th { padding: 13px 16px; text-align: left; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--border); }
  .players-table th.num { text-align: right; }
  .players-table td { padding: 13px 16px; border-bottom: 1px solid var(--border); }
  .players-table td.num { text-align: right; font-family: var(--display); font-size: 15px; font-weight: 500; }
  .players-table tr:last-child td { border-bottom: none; }
  .players-table tbody tr { transition: background 0.12s; }
  .players-table tbody tr:hover td { background: var(--surface2); cursor: pointer; }
  .player-name { font-weight: 500; }
  .player-pos { display: inline-block; font-size: 10px; letter-spacing: 0.05em; color: var(--muted); background: var(--surface2); padding: 2px 7px; border-radius: 10px; margin-left: 8px; }
  .jersey { font-family: var(--display); font-size: 15px; font-weight: 500; color: var(--faint); }
  .highlight { color: var(--accent); }
  .highlight-gold { color: var(--text); }

  .games-list { margin-bottom: 24px; }
  .game-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; font-size: 13px; transition: border-color 0.15s; }
  .game-row:hover { border-color: var(--border-strong); }
  .game-outcome { font-family: var(--display); font-size: 17px; font-weight: 600; width: 22px; flex-shrink: 0; }
  .game-outcome.W { color: var(--pos); }
  .game-outcome.L { color: var(--neg); }
  .game-matchup { flex: 1; font-weight: 500; }
  .game-date { color: var(--muted); font-size: 12px; }
  .game-score { font-family: var(--display); font-size: 16px; font-weight: 500; }
  .game-ha { font-size: 11px; letter-spacing: 0.05em; color: var(--faint); width: 22px; text-align: center; }
  .loading { display: flex; align-items: center; justify-content: center; height: 200px; color: var(--muted); font-size: 13px; letter-spacing: 0.04em; }
`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4 }}>Game {label}</div>
        <div style={{ color: "var(--accent)", fontFamily: "var(--display)", fontSize: 22, fontWeight: 600 }}>{payload[0].value} PTS</div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [leaders, setLeaders] = useState(null);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/season/summary`),
      axios.get(`${API}/players`),
      axios.get(`${API}/games`),
      axios.get(`${API}/stats/leaders`),
    ]).then(([s, p, g, l]) => {
      setSummary(s.data);
      setPlayers(p.data.players);
      setGames(g.data.games);
      setStreak(g.data.streak);
      setLeaders(l.data);
      setLoading(false);
    });
  }, []);

  const chartData = [...games].reverse().slice(-20).map((g, i) => ({ game: i + 1, pts: g.pts, matchup: g.matchup }));
  const winPct = summary ? ((summary.wins / summary.games_played) * 100).toFixed(1) : null;

  return (
    <div className="page">
      <style>{css}</style>

      <div className="dash-head">
        <div className="dash-eyebrow">Houston Rockets · Regular Season</div>
        <div className="dash-title">{seasonLabel()} Season <span>Overview</span></div>
      </div>

      {loading ? <div className="loading">Loading Rockets data...</div> : (
        <>
          {summary && (
            <div className="summary-grid">
              <div className="stat-card">
                <div className="stat-card-label">Wins</div>
                <div className="stat-card-value green">{summary.wins}</div>
                <div className="stat-card-sub">Home: {summary.home_wins} · Away: {summary.away_wins}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Losses</div>
                <div className="stat-card-value red">{summary.losses}</div>
                <div className="stat-card-sub">Home: {summary.home_losses} · Away: {summary.away_losses}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Win %</div>
                <div className="stat-card-value gold">{winPct}%</div>
                <div className="stat-card-sub">{summary.games_played} games played</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">PPG For</div>
                <div className="stat-card-value">{summary.avg_pts_for}</div>
                <div className="stat-card-sub">Points per game</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">PPG Against</div>
                <div className="stat-card-value">{summary.avg_pts_against}</div>
                <div className="stat-card-sub">Opponent avg</div>
              </div>
              {streak && (
                <div className="stat-card">
                  <div className="stat-card-label">Current Streak</div>
                  <div className={`stat-card-value ${streak.type === "W" ? "green" : "red"}`}>{streak.type}{streak.count}</div>
                  <div className="stat-card-sub">{streak.type === "W" ? "Win" : "Loss"} streak</div>
                </div>
              )}
            </div>
          )}

          <div className="section-header">
            <div className="section-title">Points Per Game, Last 20 Games</div>
            <div className="section-line" />
          </div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2024" />
                <XAxis dataKey="game" tick={{ fill: "#8b8c92", fontSize: 11 }} axisLine={{ stroke: "#26272b" }} tickLine={false} />
                <YAxis tick={{ fill: "#8b8c92", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="pts" stroke="#de3a45" strokeWidth={2} dot={{ fill: "#de3a45", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {leaders && (
            <>
              <div className="section-header">
                <div className="section-title">Stat Leaders</div>
                <div className="section-line" />
              </div>
              <div className="leaders-grid">
                {[{key:"points",label:"Points"},{key:"rebounds",label:"Rebounds"},{key:"assists",label:"Assists"},{key:"steals",label:"Steals"},{key:"blocks",label:"Blocks"}].map(({key,label}) => (
                  <div className="leader-card" key={key}>
                    <div className="leader-card-title">{label}</div>
                    {leaders[key].map((p, i) => (
                      <div className="leader-row" key={p.player_id}>
                        <div className={`leader-rank ${i===0?"top":""}`}>{i+1}</div>
                        <div className="leader-name" onClick={() => navigate(`/player/${p.player_id}`)}>{p.full_name}</div>
                        <div className="leader-avg">{p.avg}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="section-header">
            <div className="section-title">Roster & Season Averages</div>
            <div className="section-line" />
          </div>
          <div className="table-card">
            <table className="players-table">
              <thead>
                <tr>
                  <th>#</th><th>Player</th>
                  <th className="num">GP</th><th className="num">PTS</th>
                  <th className="num">REB</th><th className="num">AST</th>
                  <th className="num">STL</th><th className="num">BLK</th>
                  <th className="num">FG%</th><th className="num">+/-</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.player_id} onClick={() => navigate(`/player/${p.player_id}`)}>
                    <td><span className="jersey">{p.jersey_num || "-"}</span></td>
                    <td><span className="player-name">{p.full_name}</span>{p.position && <span className="player-pos">{p.position}</span>}</td>
                    <td className="num">{p.games_played ?? "-"}</td>
                    <td className="num highlight">{p.avg_pts ?? "-"}</td>
                    <td className="num">{p.avg_reb ?? "-"}</td>
                    <td className="num">{p.avg_ast ?? "-"}</td>
                    <td className="num">{p.avg_stl ?? "-"}</td>
                    <td className="num">{p.avg_blk ?? "-"}</td>
                    <td className="num highlight-gold">{p.avg_fg_pct ? (p.avg_fg_pct * 100).toFixed(1) + "%" : "-"}</td>
                    <td className="num" style={{ color: p.avg_plus_minus > 0 ? "var(--pos)" : p.avg_plus_minus < 0 ? "var(--neg)" : "var(--muted)" }}>
                      {p.avg_plus_minus != null ? (p.avg_plus_minus > 0 ? "+" : "") + p.avg_plus_minus : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-header">
            <div className="section-title">Recent Games</div>
            <div className="section-line" />
          </div>
          <div className="games-list">
            {games.slice(0, 10).map(g => (
              <div className="game-row" key={g.game_id} onClick={() => navigate("/games")} style={{ cursor: "pointer" }}>
                <div className={`game-outcome ${g.outcome}`}>{g.outcome}</div>
                <div className="game-ha">{g.home_away === "H" ? "vs" : "@"}</div>
                <div className="game-matchup">{g.matchup}</div>
                <div className="game-date">{new Date(g.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                <div className="game-score">{g.pts}{g.opp_pts ? <span style={{ color: "var(--faint)" }}> - {g.opp_pts}</span> : ""}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
