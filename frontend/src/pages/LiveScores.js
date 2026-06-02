import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

const css = `
  .live-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; margin-bottom:36px; }
  .live-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:20px; position:relative; overflow:hidden; }
  .live-card.rockets { border-color:var(--red); }
  .live-card.rockets::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--red); }
  .live-status { font-size:10px; letter-spacing:2px; text-transform:uppercase; margin-bottom:14px; display:flex; align-items:center; gap:6px; }
  .live-dot { width:6px; height:6px; border-radius:50%; background:var(--green); animation:pulse 1.5s infinite; flex-shrink:0; }
  .live-dot.final { background:var(--muted); animation:none; }
  .live-teams { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .live-team { flex:1; }
  .live-team.away { text-align:left; }
  .live-team.home { text-align:right; }
  .team-code { font-family:'Barlow Condensed',sans-serif; font-size:32px; font-weight:900; letter-spacing:1px; }
  .team-code.rockets-team { color:var(--red); }
  .team-score { font-family:'Barlow Condensed',sans-serif; font-size:48px; font-weight:900; line-height:1; }
  .team-score.winning { color:var(--green); }
  .vs-divider { color:var(--muted); font-size:12px; letter-spacing:1px; text-align:center; }
  .score-group { display:flex; gap:16px; align-items:center; justify-content:center; }
  .no-games { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:60px; text-align:center; color:var(--muted); }
  .no-games-title { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
  .no-games-sub { font-size:13px; }
  .refresh-btn { font-family:'Barlow Condensed',sans-serif; font-size:12px; letter-spacing:2px; text-transform:uppercase;
    padding:8px 20px; background:transparent; border:1px solid var(--border); border-radius:2px; color:var(--muted); cursor:pointer; margin-bottom:24px; }
  .refresh-btn:hover { border-color:var(--text); color:var(--text); }
  .last-refresh { font-size:11px; color:var(--muted); margin-left:12px; letter-spacing:1px; }
  .page-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
  .page-title span { color:var(--red); }
  .page-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-bottom:32px; }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
`;

const ROCKETS = "HOU";

export default function LiveScores() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchScores = () => {
    setLoading(true);
    axios.get(`${API}/live/scores`).then(r => {
      setGames(r.data.games);
      setLastRefresh(new Date().toLocaleTimeString());
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const isRocketsGame = (g) => g.home_team === ROCKETS || g.away_team === ROCKETS;

  const rocketsGames = games.filter(isRocketsGame);
  const otherGames = games.filter(g => !isRocketsGame(g));

  const isWinning = (g, team) => {
    if (team === g.home_team) return g.home_score > g.away_score;
    return g.away_score > g.home_score;
  };

  const GameCard = ({ game, isRockets }) => {
    const homecode = game.home_team === ROCKETS ? "rockets-team" : "";
    const awaycode = game.away_team === ROCKETS ? "rockets-team" : "";
    const homeWin = game.home_score > game.away_score;
    const awayWin = game.away_score > game.home_score;
    const isFinal = game.status?.toLowerCase().includes("final") || game.status?.toLowerCase().includes("end");

    return (
      <div className={`live-card ${isRockets ? "rockets" : ""}`}>
        <div className="live-status">
          <div className={`live-dot ${isFinal ? "final" : ""}`} />
          <span style={{ color: isFinal ? "var(--muted)" : "var(--green)" }}>{game.status}</span>
          {game.period > 0 && !isFinal && <span style={{ color: "var(--muted)" }}>· Q{game.period}</span>}
          {game.clock && !isFinal && <span style={{ color: "var(--muted)" }}>· {game.clock}</span>}
        </div>
        <div className="live-teams">
          <div className="live-team away">
            <div className={`team-code ${awaycode}`}>{game.away_team}</div>
          </div>
          <div className="score-group">
            <div className={`team-score ${awayWin ? "winning" : ""}`}>{game.away_score}</div>
            <div className="vs-divider">–</div>
            <div className={`team-score ${homeWin ? "winning" : ""}`}>{game.home_score}</div>
          </div>
          <div className="live-team home">
            <div className={`team-code ${homecode}`}>{game.home_team}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Live <span>Scores</span></div>
      <div className="page-sub">Today's NBA Games · Auto-refreshes every 30 seconds</div>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        <button className="refresh-btn" onClick={fetchScores}>↻ Refresh Now</button>
        {lastRefresh && <span className="last-refresh">Last updated: {lastRefresh}</span>}
      </div>

      {loading ? <div className="loading">Loading scores...</div> : (
        <>
          {rocketsGames.length > 0 && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
                  <span style={{ color:"var(--red)" }}>Rockets</span> Game
                </div>
                <div style={{ flex:1, height:1, background:"var(--border)" }} />
              </div>
              <div className="live-grid" style={{ marginBottom: 32 }}>
                {rocketsGames.map(g => <GameCard key={g.game_id} game={g} isRockets={true} />)}
              </div>
            </>
          )}

          {otherGames.length > 0 && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, letterSpacing:2, textTransform:"uppercase" }}>
                  Around the League
                </div>
                <div style={{ flex:1, height:1, background:"var(--border)" }} />
              </div>
              <div className="live-grid">
                {otherGames.map(g => <GameCard key={g.game_id} game={g} isRockets={false} />)}
              </div>
            </>
          )}

          {games.length === 0 && (
            <div className="no-games">
              <div className="no-games-title">No Games Today</div>
              <div className="no-games-sub">Check back on a game day — scores update automatically when games are live.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
