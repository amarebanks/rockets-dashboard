import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://127.0.0.1:8000";
const headshot = (id) => `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${id}.png`;

const css = `
  .rp-header { margin-bottom: 32px; }
  .rp-title { font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
  .rp-sub { color: var(--muted); font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
  .rp-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
  .rp-search { background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
    padding: 8px 14px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 13px;
    width: 200px; outline: none; }
  .rp-search:focus { border-color: var(--red); }
  .rp-search::placeholder { color: var(--muted); }
  .rp-pos-filters { display: flex; gap: 4px; flex-wrap: wrap; }
  .rp-pos-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; letter-spacing: 1.5px;
    text-transform: uppercase; padding: 6px 12px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer; border-radius: 2px; transition: all 0.15s; }
  .rp-pos-btn:hover { border-color: var(--text); color: var(--text); }
  .rp-pos-btn.active { background: var(--red); border-color: var(--red); color: #fff; }
  .rp-sort { background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
    padding: 6px 12px; color: var(--text); font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; letter-spacing: 1px; outline: none; cursor: pointer; margin-left: auto; }
  .rp-count { font-size: 11px; color: var(--muted); letter-spacing: 1px;
    font-family: 'Barlow Condensed', sans-serif; border: 1px solid var(--border);
    padding: 4px 10px; border-radius: 2px; }
  .rp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .pc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 4px;
    overflow: hidden; cursor: pointer; transition: border-color 0.2s, transform 0.15s; position: relative; }
  .pc-card:hover { border-color: var(--red); transform: translateY(-3px); }
  .pc-img-wrap { background: linear-gradient(180deg, #1a1a1a 0%, #111 100%);
    height: 120px; display: flex; align-items: flex-end; justify-content: center;
    overflow: hidden; position: relative; }
  .pc-headshot { width: 100%; height: 120px; object-fit: cover; object-position: top center; }
  .pc-no-img { font-family: 'Barlow Condensed', sans-serif; font-size: 56px; font-weight: 900;
    color: var(--border); padding-bottom: 4px; line-height: 1; }
  .pc-jersey-badge { position: absolute; top: 8px; left: 8px; font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px; font-weight: 900; background: var(--red); color: #fff;
    padding: 1px 7px; border-radius: 2px; letter-spacing: 1px; }
  .pc-body { padding: 12px 14px 14px; }
  .pc-name { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
  .pc-pos { display: inline-block; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); border: 1px solid var(--border); padding: 2px 7px;
    border-radius: 2px; margin: 5px 0 10px; }
  .pc-stats { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--border); padding-top: 10px; }
  .pc-stat { text-align: center; }
  .pc-stat-val { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; line-height: 1; }
  .pc-stat-val.red { color: var(--red); }
  .pc-stat-val.gold { color: var(--gold); }
  .pc-stat-val.green { color: var(--green); }
  .pc-stat-lbl { font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-top: 3px; }
  .pc-footer { font-size: 10px; color: var(--muted); margin-top: 8px; display: flex;
    justify-content: space-between; letter-spacing: 0.5px; }
  .rp-empty { display: flex; align-items: center; justify-content: center; height: 200px;
    color: var(--muted); font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
`;

const getOvrColor = (ovr) => {
  if (ovr >= 95) return "#f97316";
  if (ovr >= 88) return "#fbbf24";
  if (ovr >= 80) return "#4ade80";
  if (ovr >= 72) return "#60a5fa";
  return "var(--gold)";
};

const POSITIONS = ["ALL", "G", "PG", "SG", "F", "SF", "PF", "C"];
const SORT_OPTIONS = [
  { value: "avg_pts",         label: "Points" },
  { value: "avg_reb",         label: "Rebounds" },
  { value: "avg_ast",         label: "Assists" },
  { value: "avg_stl",         label: "Steals" },
  { value: "avg_blk",         label: "Blocks" },
  { value: "avg_plus_minus",  label: "+/-" },
  { value: "avg_fg_pct",      label: "FG%" },
  { value: "games_played",    label: "Games Played" },
];

function PlayerCard({ player: p, ovr, onClick }) {
  const [imgError, setImgError] = useState(false);
  const pmColor = p.avg_plus_minus > 0 ? "green" : p.avg_plus_minus < 0 ? "red" : "";
  const pmDisplay = p.avg_plus_minus != null
    ? (p.avg_plus_minus > 0 ? "+" : "") + p.avg_plus_minus
    : "—";

  return (
    <div className="pc-card" onClick={onClick}>
      <div className="pc-img-wrap">
        {!imgError ? (
          <img
            className="pc-headshot"
            src={headshot(p.player_id)}
            alt={p.full_name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="pc-no-img">#{p.jersey_num || "?"}</div>
        )}
        {p.jersey_num && <div className="pc-jersey-badge">#{p.jersey_num}</div>}
        {ovr && (
          <div style={{
            position:"absolute", top:8, right:8,
            background:"rgba(0,0,0,0.75)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:3, padding:"2px 7px", textAlign:"center", lineHeight:1,
          }}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:getOvrColor(ovr)}}>{ovr}</div>
            <div style={{fontSize:7,letterSpacing:1.5,textTransform:"uppercase",color:"var(--muted)",marginTop:1}}>OVR</div>
          </div>
        )}
      </div>
      <div className="pc-body">
        <div className="pc-name">{p.full_name}</div>
        <div className="pc-pos">{p.position || "—"}</div>
        <div className="pc-stats">
          <div className="pc-stat">
            <div className="pc-stat-val red">{p.avg_pts ?? "—"}</div>
            <div className="pc-stat-lbl">PTS</div>
          </div>
          <div className="pc-stat">
            <div className="pc-stat-val">{p.avg_reb ?? "—"}</div>
            <div className="pc-stat-lbl">REB</div>
          </div>
          <div className="pc-stat">
            <div className="pc-stat-val gold">{p.avg_ast ?? "—"}</div>
            <div className="pc-stat-lbl">AST</div>
          </div>
          <div className="pc-stat">
            <div className={`pc-stat-val ${pmColor}`}>{pmDisplay}</div>
            <div className="pc-stat-lbl">+/-</div>
          </div>
        </div>
        <div className="pc-footer">
          <span>{p.games_played ?? 0} GP</span>
          <span>{p.avg_fg_pct ? (p.avg_fg_pct * 100).toFixed(1) + "% FG" : ""}</span>
        </div>
      </div>
    </div>
  );
}

export default function Players() {
  const [players, setPlayers]   = useState([]);
  const [overalls, setOveralls] = useState({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy]     = useState("avg_pts");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/players`),
      axios.get(`${API}/players/overalls`),
    ]).then(([rPlayers, rOveralls]) => {
      setPlayers(rPlayers.data.players);
      setOveralls(rOveralls.data.overalls || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = players
    .filter(p => {
      if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (posFilter !== "ALL") {
        const pos = (p.position || "").toUpperCase();
        if (!pos.includes(posFilter)) return false;
      }
      return true;
    })
    .sort((a, b) => ((b[sortBy] ?? -999) - (a[sortBy] ?? -999)));

  return (
    <div className="page">
      <style>{css}</style>

      <div className="rp-header">
        <div className="rp-title">
          2024–25 <span style={{ color: "var(--red)" }}>Roster</span>
        </div>
        <div className="rp-sub">Houston Rockets · Player Directory</div>
      </div>

      <div className="rp-controls">
        <input
          className="rp-search"
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="rp-pos-filters">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              className={`rp-pos-btn ${posFilter === pos ? "active" : ""}`}
              onClick={() => setPosFilter(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
        <select
          className="rp-sort"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>Sort: {o.label}</option>
          ))}
        </select>
        <div className="rp-count">{filtered.length} players</div>
      </div>

      {loading ? (
        <div className="rp-empty">Loading roster...</div>
      ) : filtered.length === 0 ? (
        <div className="rp-empty">No players found</div>
      ) : (
        <div className="rp-grid">
          {filtered.map(p => (
            <PlayerCard
              key={p.player_id}
              player={p}
              ovr={overalls[String(p.player_id)]}
              onClick={() => navigate(`/player/${p.player_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
