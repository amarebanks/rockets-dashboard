import { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

const API = "http://127.0.0.1:8000";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --red: #CE1141;
    --dark-red: #8B0A28;
    --gold: #C4A265;
    --bg: #0a0a0a;
    --surface: #111111;
    --surface2: #1a1a1a;
    --border: #222222;
    --text: #f0f0f0;
    --muted: #666;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    min-height: 100vh;
  }

  .app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 60px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 36px 0 32px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 36px;
  }
  .header-logo {
    width: 56px;
    height: 56px;
    background: var(--red);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    letter-spacing: -1px;
    flex-shrink: 0;
  }
  .header-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 38px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    line-height: 1;
  }
  .header-title span { color: var(--red); }
  .header-sub {
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .header-season {
    margin-left: auto;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--gold);
    border: 1px solid var(--gold);
    padding: 6px 14px;
    border-radius: 2px;
  }

  /* Summary cards */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 36px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 20px;
    position: relative;
    overflow: hidden;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--red);
  }
  .stat-card.gold::before { background: var(--gold); }
  .stat-card-label {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .stat-card-value {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 42px;
    font-weight: 700;
    line-height: 1;
    color: var(--text);
  }
  .stat-card-value.red { color: var(--red); }
  .stat-card-value.gold { color: var(--gold); }
  .stat-card-sub {
    font-size: 11px;
    color: var(--muted);
    margin-top: 4px;
  }

  /* Section headers */
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .section-line {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* Chart */
  .chart-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 24px;
    margin-bottom: 36px;
  }
  .recharts-tooltip-wrapper .custom-tooltip {
    background: var(--surface2);
    border: 1px solid var(--border);
    padding: 10px 14px;
    border-radius: 4px;
    font-size: 13px;
  }

  /* Leaders */
  .leaders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 36px;
  }
  .leader-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 16px;
  }
  .leader-card-title {
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
  }
  .leader-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .leader-row:last-child { border-bottom: none; }
  .leader-rank {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: var(--border);
    width: 20px;
    flex-shrink: 0;
  }
  .leader-rank.top { color: var(--red); }
  .leader-name {
    font-size: 13px;
    font-weight: 500;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .leader-avg {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--gold);
  }

  /* Players table */
  .table-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 36px;
  }
  .players-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .players-table th {
    background: var(--surface2);
    padding: 10px 14px;
    text-align: left;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
    border-bottom: 1px solid var(--border);
  }
  .players-table th.num { text-align: right; }
  .players-table td {
    padding: 11px 14px;
    border-bottom: 1px solid var(--border);
  }
  .players-table td.num {
    text-align: right;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    font-weight: 600;
  }
  .players-table tr:last-child td { border-bottom: none; }
  .players-table tr:hover td { background: var(--surface2); }
  .player-name { font-weight: 500; }
  .player-pos {
    display: inline-block;
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
    background: var(--surface2);
    padding: 2px 6px;
    border-radius: 2px;
    margin-left: 6px;
  }
  .jersey {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: var(--muted);
  }
  .highlight { color: var(--red); }
  .highlight-gold { color: var(--gold); }

  /* Recent games */
  .games-list { margin-bottom: 36px; }
  .game-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    margin-bottom: 6px;
    font-size: 13px;
  }
  .game-outcome {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 900;
    width: 24px;
    flex-shrink: 0;
  }
  .game-outcome.W { color: #4ade80; }
  .game-outcome.L { color: var(--red); }
  .game-matchup { flex: 1; font-weight: 500; }
  .game-date { color: var(--muted); font-size: 12px; }
  .game-score {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 700;
  }
  .game-ha {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
    width: 20px;
    text-align: center;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--muted);
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#1a1a1a", border: "1px solid #222",
        padding: "10px 14px", borderRadius: 4, fontSize: 13
      }}>
        <div style={{ color: "#666", fontSize: 11, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "#CE1141", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>
          {payload[0].value} PTS
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [summary, setSummary] = useState(null);
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [leaders, setLeaders] = useState(null);
  const [loading, setLoading] = useState(true);

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
      setLeaders(l.data);
      setLoading(false);
    });
  }, []);

  // Build chart data from games (oldest → newest, last 20)
  const chartData = [...games]
    .reverse()
    .slice(-20)
    .map((g, i) => ({
      game: i + 1,
      pts: g.pts,
      matchup: g.matchup,
    }));

  const winPct = summary
    ? ((summary.wins / summary.games_played) * 100).toFixed(1)
    : null;

  return (
    <>
      <style>{styles}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <div className="header-logo">HOU</div>
          <div>
            <div className="header-title">
              Houston <span>Rockets</span>
            </div>
            <div className="header-sub">Stats Dashboard</div>
          </div>
          <div className="header-season">2024–25 Season</div>
        </header>

        {loading ? (
          <div className="loading">Loading Rockets data...</div>
        ) : (
          <>
            {/* Season Summary */}
            {summary && (
              <div className="summary-grid">
                <div className="stat-card">
                  <div className="stat-card-label">Wins</div>
                  <div className="stat-card-value red">{summary.wins}</div>
                  <div className="stat-card-sub">Regular season</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Losses</div>
                  <div className="stat-card-value">{summary.losses}</div>
                  <div className="stat-card-sub">Regular season</div>
                </div>
                <div className="stat-card gold">
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
                <div className="stat-card">
                  <div className="stat-card-label">Home W</div>
                  <div className="stat-card-value red">{summary.home_wins}</div>
                  <div className="stat-card-sub">Away W: {summary.away_wins}</div>
                </div>
              </div>
            )}

            {/* Points Chart */}
            <div className="section-header">
              <div className="section-title">Points Per Game — Last 20 Games</div>
              <div className="section-line" />
            </div>
            <div className="chart-card">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis
                    dataKey="game"
                    tick={{ fill: "#555", fontSize: 11 }}
                    axisLine={{ stroke: "#222" }}
                    tickLine={false}
                    label={{ value: "Game", position: "insideBottom", offset: -2, fill: "#555", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#555", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="pts"
                    stroke="#CE1141"
                    strokeWidth={2}
                    dot={{ fill: "#CE1141", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#CE1141" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stat Leaders */}
            {leaders && (
              <>
                <div className="section-header">
                  <div className="section-title">Stat Leaders</div>
                  <div className="section-line" />
                </div>
                <div className="leaders-grid">
                  {[
                    { key: "points", label: "Points" },
                    { key: "rebounds", label: "Rebounds" },
                    { key: "assists", label: "Assists" },
                    { key: "steals", label: "Steals" },
                    { key: "blocks", label: "Blocks" },
                  ].map(({ key, label }) => (
                    <div className="leader-card" key={key}>
                      <div className="leader-card-title">{label}</div>
                      {leaders[key].map((p, i) => (
                        <div className="leader-row" key={p.player_id}>
                          <div className={`leader-rank ${i === 0 ? "top" : ""}`}>{i + 1}</div>
                          <div className="leader-name">{p.full_name.split(" ").pop()}</div>
                          <div className="leader-avg">{p.avg}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Players Table */}
            <div className="section-header">
              <div className="section-title">Roster & Season Averages</div>
              <div className="section-line" />
            </div>
            <div className="table-card">
              <table className="players-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th className="num">GP</th>
                    <th className="num">PTS</th>
                    <th className="num">REB</th>
                    <th className="num">AST</th>
                    <th className="num">FG%</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.player_id}>
                      <td><span className="jersey">{p.jersey_num || "—"}</span></td>
                      <td>
                        <span className="player-name">{p.full_name}</span>
                        {p.position && <span className="player-pos">{p.position}</span>}
                      </td>
                      <td className="num">{p.games_played ?? "—"}</td>
                      <td className="num highlight">{p.avg_pts ?? "—"}</td>
                      <td className="num">{p.avg_reb ?? "—"}</td>
                      <td className="num">{p.avg_ast ?? "—"}</td>
                      <td className="num highlight-gold">
                        {p.avg_fg_pct ? (p.avg_fg_pct * 100).toFixed(1) + "%" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recent Games */}
            <div className="section-header">
              <div className="section-title">Recent Games</div>
              <div className="section-line" />
            </div>
            <div className="games-list">
              {games.slice(0, 10).map((g) => (
                <div className="game-row" key={g.game_id}>
                  <div className={`game-outcome ${g.outcome}`}>{g.outcome}</div>
                  <div className="game-ha">{g.home_away === "H" ? "vs" : "@"}</div>
                  <div className="game-matchup">{g.matchup}</div>
                  <div className="game-date">
                    {new Date(g.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                  <div className="game-score">
                    {g.pts}
                    {g.opp_pts ? <span style={{ color: "#444" }}> – {g.opp_pts}</span> : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}