import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import Dashboard from "./pages/Dashboard";
import GameLog from "./pages/GameLog";
import PlayerProfile from "./pages/PlayerProfile";
import Players from "./pages/Players";
import Compare from "./pages/Compare";
import LiveScores from "./pages/LiveScores";
import Predictor from "./pages/Predictor";
import TradeIdeas from "./pages/TradeIdeas";
import BettingEdge from "./pages/BettingEdge";
import DraftCapital from "./pages/DraftCapital";
import Clutch from "./pages/Clutch";
import Lineups from "./pages/Lineups";
import Contracts from "./pages/Contracts";
import TradeMachine from "./pages/TradeMachine";
import Team from "./pages/Team";
import TradeHub from "./pages/TradeHub";
import Forecast from "./pages/Forecast";
import { SEASONS, getSeason, setSeason, applySeasonParam } from "./season";

// Inject the selected season into every API request before any component mounts.
applySeasonParam();

const API = "http://127.0.0.1:8000";

const navStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --red: #CE1141; --dark-red: #8B0A28; --gold: #C4A265;
    --bg: #0a0a0a; --surface: #111111; --surface2: #1a1a1a;
    --border: #222222; --text: #f0f0f0; --muted: #666;
    --green: #4ade80;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Barlow', sans-serif; min-height: 100vh; }
  .navbar {
    display: flex; align-items: center;
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 0 24px; position: sticky; top: 0; z-index: 100; gap: 0;
  }
  .nav-brand {
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
    font-size: 20px; letter-spacing: 2px; text-transform: uppercase;
    color: var(--text); text-decoration: none; margin-right: 24px;
    padding: 16px 0; white-space: nowrap; flex-shrink: 0;
  }
  .nav-brand span { color: var(--red); }
  .nav-links { display: flex; align-items: center; gap: 0; flex: 1; overflow-x: auto; }
  .nav-link {
    font-family: 'Barlow Condensed', sans-serif; font-size: 12px;
    letter-spacing: 2px; text-transform: uppercase; color: var(--muted);
    text-decoration: none; padding: 17px 14px; border-bottom: 2px solid transparent;
    transition: color 0.2s, border-color 0.2s; white-space: nowrap;
  }
  .nav-link:hover { color: var(--text); }
  .nav-link.active { color: var(--text); border-bottom-color: var(--red); }
  .live-dot { width:6px; height:6px; border-radius:50%; background:var(--green);
    display:inline-block; margin-right:5px; animation:pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
  .nav-search-wrap { margin-left: auto; position: relative; flex-shrink: 0; }
  .nav-search { background: var(--surface2); border: 1px solid var(--border); border-radius: 2px;
    padding: 7px 12px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 12px;
    width: 180px; outline: none; }
  .nav-search:focus { border-color: var(--red); }
  .nav-search::placeholder { color: var(--muted); }
  .nav-season-wrap { display:flex; align-items:center; gap:7px; margin-left:auto; flex-shrink:0; padding-right:14px; }
  .nav-season-label { font-family:'Barlow Condensed',sans-serif; font-size:10px; letter-spacing:2px;
    text-transform:uppercase; color:var(--muted); white-space:nowrap; }
  .nav-season { background: var(--surface2); border: 1px solid var(--border); border-radius: 2px;
    padding: 6px 8px; color: var(--text); font-family:'Barlow Condensed',sans-serif; font-weight:700;
    font-size: 13px; letter-spacing:1px; outline: none; cursor: pointer; }
  .nav-season:focus { border-color: var(--gold); }
  .nav-season-wrap + .nav-search-wrap { margin-left: 0; }
  .search-dropdown { position: absolute; top: calc(100% + 4px); right: 0; width: 240px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
    z-index: 200; overflow: hidden; }
  .search-item { padding: 10px 14px; cursor: pointer; font-size: 13px; border-bottom: 1px solid var(--border); }
  .search-item:last-child { border-bottom: none; }
  .search-item:hover { background: var(--surface2); color: var(--red); }
  .page { max-width: 1200px; margin: 0 auto; padding: 36px 24px 80px; }
`;

function Navbar() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const navigate              = useNavigate();
  let timer;

  const handleSearch = (val) => {
    setQuery(val);
    clearTimeout(timer);
    if (val.length < 2) { setResults([]); return; }
    timer = setTimeout(() => {
      axios.get(`${API}/players`).then(r => {
        const q = val.toLowerCase();
        const matches = r.data.players.filter(p => p.full_name.toLowerCase().includes(q)).slice(0, 6);
        setResults(matches);
      });
    }, 200);
  };

  const pick = (p) => {
    setQuery(""); setResults([]);
    navigate(`/player/${p.player_id}`);
  };

  const changeSeason = (e) => {
    setSeason(e.target.value);
    window.location.reload();   // re-fetch every page's data for the new season
  };

  return (
    <nav className="navbar">
      <NavLink to="/" className="nav-brand">HOU <span>Rockets</span></NavLink>
      <div className="nav-links">
        <NavLink to="/" end className="nav-link">Dashboard</NavLink>
        <NavLink to="/live" className="nav-link"><span className="live-dot"/>Live</NavLink>
        <NavLink to="/players" className="nav-link">Players</NavLink>
        <NavLink to="/compare" className="nav-link">Compare</NavLink>
        <NavLink to="/games" className="nav-link">Game Log</NavLink>
        <NavLink to="/team" className="nav-link">Team</NavLink>
        <NavLink to="/trade" className="nav-link">Trade</NavLink>
        <NavLink to="/build" className="nav-link">Build</NavLink>
        <NavLink to="/caps" className="nav-link">Caps</NavLink>
        <NavLink to="/draft" className="nav-link">Draft</NavLink>
        <NavLink to="/forecast" className="nav-link">Forecast</NavLink>
      </div>
      <div className="nav-season-wrap">
        <span className="nav-season-label">Season</span>
        <select className="nav-season" value={getSeason()} onChange={changeSeason}>
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="nav-search-wrap">
        <input
          className="nav-search"
          placeholder="🔍 Search player..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setResults([]), 200)}
        />
        {results.length > 0 && (
          <div className="search-dropdown">
            {results.map(p => (
              <div key={p.player_id} className="search-item" onClick={() => pick(p)}>
                {p.full_name}
                {p.position && <span style={{ fontSize:10, color:"var(--muted)", marginLeft:6 }}>{p.position}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <style>{navStyles}</style>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/players" element={<Players />} />
        <Route path="/games" element={<GameLog />} />
        <Route path="/player/:id" element={<PlayerProfile />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/live" element={<LiveScores />} />
        {/* Grouped hubs */}
        <Route path="/team" element={<Team />} />
        <Route path="/trade" element={<TradeHub />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="/build" element={<TradeIdeas />} />
        <Route path="/draft" element={<DraftCapital />} />
        <Route path="/caps" element={<Contracts />} />
        {/* Direct routes kept so deep links / bookmarks still resolve */}
        <Route path="/lineups" element={<Lineups />} />
        <Route path="/clutch" element={<Clutch />} />
        <Route path="/machine" element={<TradeMachine />} />
        <Route path="/predict" element={<Predictor />} />
        <Route path="/edge" element={<BettingEdge />} />
      </Routes>
    </Router>
  );
}
