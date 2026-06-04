import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { Search } from "lucide-react";
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

// Global design system. Tokens live here in :root so every page picks them up
// through var(); the rest styles the nav shell and page container.
const navStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0c0d0f; --surface: #141517; --surface2: #1b1c1f;
    --border: #26272b; --border-strong: #34353a;
    --text: #e9e9ec; --muted: #8b8c92; --faint: #5a5b61;
    --red: #de3a45; --accent: #de3a45; --dark-red: #8B0A28;
    --green: #58b389; --pos: #58b389; --neg: #e06a63; --gold: #c9a25e;
    --display: 'Space Grotesk', sans-serif;
    --body: 'Inter', sans-serif;
  }
  body { background: var(--bg); color: var(--text); font-family: var(--body);
    min-height: 100vh; -webkit-font-smoothing: antialiased; letter-spacing: -0.005em; }
  ::selection { background: var(--accent); color: #fff; }
  .lucide { vertical-align: -0.14em; flex-shrink: 0; }

  .navbar { display: flex; align-items: center; background: rgba(12,13,15,0.85);
    backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
    padding: 0 28px; position: sticky; top: 0; z-index: 100; }
  .nav-brand { font-family: var(--display); font-weight: 600; font-size: 19px;
    letter-spacing: -0.02em; color: var(--text); text-decoration: none;
    margin-right: 36px; padding: 18px 0; white-space: nowrap; flex-shrink: 0; }
  .nav-brand span { color: var(--accent); }
  .nav-links { display: flex; align-items: center; gap: 2px; flex: 1; overflow-x: auto; }
  .nav-link { font-family: var(--body); font-size: 13px; font-weight: 500; color: var(--muted);
    text-decoration: none; padding: 20px 13px; position: relative; white-space: nowrap;
    transition: color 0.18s; display: inline-flex; align-items: center; gap: 6px; }
  .nav-link:hover { color: var(--text); }
  .nav-link.active { color: var(--text); }
  .nav-link.active::after { content: ''; position: absolute; left: 13px; right: 13px;
    bottom: 0; height: 2px; background: var(--accent); }
  .live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pos);
    display: inline-block; animation: pulse 1.8s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(88,179,137,0.5); }
    70% { box-shadow: 0 0 0 5px rgba(88,179,137,0); } 100% { box-shadow: 0 0 0 0 rgba(88,179,137,0); } }
  .nav-season-wrap { display: flex; align-items: center; gap: 8px; margin-left: auto;
    flex-shrink: 0; padding-right: 16px; }
  .nav-season-label { font-family: var(--body); font-size: 11px; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--faint); white-space: nowrap; }
  .nav-season { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 7px 9px; color: var(--text); font-family: var(--body); font-weight: 500;
    font-size: 13px; outline: none; cursor: pointer; }
  .nav-season:focus { border-color: var(--accent); }
  .nav-search-wrap { position: relative; flex-shrink: 0; display: flex; align-items: center; }
  .nav-search-icon { position: absolute; left: 11px; color: var(--faint); display: flex; pointer-events: none; }
  .nav-search { background: var(--surface2); border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 12px 8px 32px; color: var(--text); font-family: var(--body); font-size: 13px;
    width: 200px; outline: none; transition: border-color 0.18s; }
  .nav-search:focus { border-color: var(--accent); }
  .nav-search::placeholder { color: var(--faint); }
  .search-dropdown { position: absolute; top: calc(100% + 6px); right: 0; width: 250px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    z-index: 200; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.45); }
  .search-item { padding: 11px 14px; cursor: pointer; font-size: 13px; border-bottom: 1px solid var(--border); }
  .search-item:last-child { border-bottom: none; }
  .search-item:hover { background: var(--surface2); color: var(--accent); }
  .page { max-width: 1160px; margin: 0 auto; padding: 56px 28px 100px; }
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
      <NavLink to="/" className="nav-brand">Space<span>Red</span></NavLink>
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
        <span className="nav-search-icon"><Search size={15} strokeWidth={2} /></span>
        <input
          className="nav-search"
          placeholder="Search player"
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
        {/* Direct routes kept so deep links and bookmarks still resolve */}
        <Route path="/lineups" element={<Lineups />} />
        <Route path="/clutch" element={<Clutch />} />
        <Route path="/machine" element={<TradeMachine />} />
        <Route path="/predict" element={<Predictor />} />
        <Route path="/edge" element={<BettingEdge />} />
      </Routes>
    </Router>
  );
}
