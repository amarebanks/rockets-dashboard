import { useState, useRef } from "react";
import axios from "axios";
import { CircleDot, X, Star } from "lucide-react";

const API = "http://127.0.0.1:8000";

const DRAFT_PICKS = [
  "Top 5 Pick",
  "Lottery Pick (6-14)",
  "Late First (15-20)",
  "Late First (21-30)",
  "Future First (Top 10 Protected)",
  "Future First (Unprotected)",
  "Future First (Protected)",
  "Second Round Pick",
  "Future Second Round",
];

const PICK_VALUES = {
  "Top 5 Pick": 60,
  "Lottery Pick (6-14)": 46,
  "Late First (15-20)": 32,
  "Late First (21-30)": 22,
  "Future First (Top 10 Protected)": 27,
  "Future First (Unprotected)": 36,
  "Future First (Protected)": 16,
  "Second Round Pick": 8,
  "Future Second Round": 5,
};

const HISTORICAL_TRADES = [
  {
    year: "Feb 2023",
    headline: "Kevin Durant → Phoenix Suns",
    sideA: ["Kevin Durant (age 35)"],
    sideB: ["Mikal Bridges", "Cameron Johnson", "Jae Crowder", "4 First-Round Picks"],
    takeaway: "BKN in full rebuild - rare case where a team accepted massive asset haul for a still-elite 35-year-old.",
  },
  {
    year: "Sep 2022",
    headline: "Donovan Mitchell → Cleveland Cavaliers",
    sideA: ["Donovan Mitchell (age 26)"],
    sideB: ["Collin Sexton", "Lauri Markkanen", "Ochai Agbaji", "3 Firsts + 2 Pick Swaps"],
    takeaway: "Utah set the market: prime star (score ~82) demands 3+ first-round picks as baseline.",
  },
  {
    year: "Feb 2023",
    headline: "Kyrie Irving → Dallas Mavericks",
    sideA: ["Kyrie Irving (age 31)"],
    sideB: ["Dorian Finney-Smith", "Spencer Dinwiddie"],
    takeaway: "DAL won significantly - expiring contract (1.5 years left) heavily deflated Kyrie's return.",
  },
  {
    year: "Jul 2019",
    headline: "Anthony Davis → Los Angeles Lakers",
    sideA: ["Anthony Davis (age 26)"],
    sideB: ["Lonzo Ball", "Brandon Ingram", "Josh Hart", "Kyle Kuzma", "3 First-Round Picks"],
    takeaway: "Prime AD (score ~90) commanded a franchise-altering return - the gold standard for star trades.",
  },
  {
    year: "Jul 2024",
    headline: "Paul George → Philadelphia 76ers",
    sideA: ["Paul George (age 34)"],
    sideB: ["5 Draft Picks", "Caleb Martin", "Eric Gordon rights"],
    takeaway: "PHI overpaid for an aging max-contract player - a reminder that salary and contract years matter.",
  },
];

const css = `
  .ta-layout { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
  .ta-side { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px; }
  .ta-side.A { border-top:3px solid var(--red); }
  .ta-side.B { border-top:3px solid #4a9eff; }
  .ta-side-title { font-family:var(--display); font-size:18px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:16px; }
  .ta-side-title.A { color:var(--red); }
  .ta-side-title.B { color:#4a9eff; }
  .search-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; color:var(--text); font-family:var(--body); font-size:13px; outline:none; margin-bottom:6px; }
  .search-input:focus { border-color:var(--red); }
  .search-results { background:var(--surface2); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:10px; }
  .search-item { padding:9px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border); }
  .search-item:last-child { border-bottom:none; }
  .search-item:hover { background:var(--surface); color:var(--red); }
  .pick-select { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:8px 12px; color:var(--text); font-family:var(--body); font-size:12px; outline:none; margin-bottom:8px; cursor:pointer; }
  .add-pick-btn { font-family:var(--display); font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:6px 14px; border-radius:8px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; width:100%; margin-bottom:16px; }
  .add-pick-btn:hover { border-color:var(--text); color:var(--text); }
  .player-card { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:8px; position:relative; }
  .player-card-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:10px; }
  .player-card-name { font-weight:600; font-size:14px; }
  .player-card-team { font-size:11px; color:var(--muted); margin-top:2px; }
  .player-score { font-family:var(--display); font-size:36px; font-weight:600; line-height:1; }
  .player-tier { font-size:10px; letter-spacing:2px; text-transform:uppercase; margin-top:2px; }
  .remove-btn { background:none; border:1px solid var(--border); color:var(--muted); width:24px; height:24px; border-radius:8px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .remove-btn:hover { border-color:var(--red); color:var(--red); }
  .breakdown-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-top:10px; }
  .breakdown-item { text-align:center; background:var(--surface); border-radius:8px; padding:5px 3px; }
  .breakdown-val { font-family:var(--display); font-size:15px; font-weight:700; }
  .breakdown-lbl { font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-top:1px; }
  .score-bar-wrap { height:5px; background:var(--surface); border-radius:3px; overflow:hidden; margin-top:8px; }
  .score-bar { height:100%; border-radius:3px; transition:width 0.3s; }
  .pick-card { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; }
  .pick-name { font-size:13px; font-weight:500; }
  .pick-score { font-family:var(--display); font-size:26px; font-weight:700; color:var(--gold); }
  .total-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-top:1px solid var(--border); margin-top:8px; }
  .total-label { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .total-value { font-family:var(--display); font-size:32px; font-weight:600; }
  .fairness-wrap { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-bottom:24px; }
  .fairness-bar-wrap { height:14px; background:var(--surface2); border-radius:7px; overflow:hidden; margin:12px 0 8px; display:flex; }
  .fairness-bar-a { height:100%; background:var(--red); transition:width 0.4s; }
  .fairness-bar-b { height:100%; background:#4a9eff; transition:width 0.4s; }
  .fairness-labels { display:flex; justify-content:space-between; font-size:12px; }
  .allstar-badge { display:inline-block; font-size:9px; letter-spacing:1px; text-transform:uppercase; background:var(--gold); color:#000; padding:2px 6px; border-radius:8px; margin-left:6px; vertical-align:middle; }
  .cornerstone-badge { display:inline-block; font-size:9px; letter-spacing:1px; text-transform:uppercase; background:linear-gradient(135deg,#f97316,#fbbf24); color:#000; padding:2px 6px; border-radius:8px; margin-left:6px; vertical-align:middle; font-weight:700; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:var(--display); font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .loading-inline { font-size:12px; color:var(--muted); letter-spacing:1px; padding:8px 0; }
  .empty-side { text-align:center; padding:28px; color:var(--muted); font-size:12px; letter-spacing:1px; border:1px dashed var(--border); border-radius:10px; margin-bottom:8px; }
  .page-title { font-family:var(--display); font-size:36px; font-weight:600; letter-spacing: -0.01em; margin-bottom:4px; }
  .page-title span { color:var(--red); }
  .page-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-bottom:32px; }
  @media (max-width:700px) { .ta-layout { grid-template-columns:1fr; } .breakdown-grid { grid-template-columns:repeat(3,1fr); } }
`;

const getScoreColor = (score) => {
  if (score >= 96) return "#f97316";
  if (score >= 85) return "#fbbf24";
  if (score >= 70) return "var(--red)";
  if (score >= 55) return "#4ade80";
  if (score >= 40) return "#60a5fa";
  return "var(--muted)";
};

const getOvrColor = (ovr) => {
  if (ovr >= 95) return "#f97316";
  if (ovr >= 88) return "#fbbf24";
  if (ovr >= 80) return "#4ade80";
  if (ovr >= 72) return "#60a5fa";
  if (ovr >= 62) return "var(--gold)";
  return "var(--muted)";
};

// ── Trade fairness model ────────────────────────────────────────────────────
// Two real-world dynamics that a plain sum of values misses:
//  1. Star scarcity premium - elite players cost far more than their sticker
//     value to acquire. You don't get a top-5 player without a big overpay.
//  2. Diminishing returns - roster spots are finite, so a pile of role players
//     and picks is worth less than the same raw total in one star.
const DECAY = 0.85; // each asset past the centerpiece is taxed by this factor

const assetValue = (item) =>
  item.type === "pick" ? item.value : (item.tradeValue?.score || 0);

// How much MORE than sticker value it costs to acquire this player.
const premiumMult = (item) => {
  if (item.type === "pick") return 1.0;
  const s = item.tradeValue?.score || 0;
  if (item.tradeValue?.is_cornerstone || s >= 96) return 1.60; // Elite Cornerstone
  if (s >= 90) return 1.45;                                    // Top Franchise Star
  if (s >= 85) return 1.30;                                    // Franchise Star
  if (s >= 78) return 1.18;                                    // High-end All-Star
  if (s >= 70) return 1.10;                                    // All-Star
  return 1.0;
};

// Effective package value: premium-adjust each asset, then apply diminishing
// returns to everything past the best piece (sorted high→low).
const computeEffective = (side) => {
  const raw = side.reduce((s, i) => s + assetValue(i), 0);
  const adjusted = side
    .map(i => assetValue(i) * premiumMult(i))
    .sort((a, b) => b - a);
  const effective = adjusted.reduce((sum, v, idx) => sum + v * Math.pow(DECAY, idx), 0);
  return { raw, effective };
};

function PlayerSearch({ onAdd, loading }) {
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [selectedPick, setSelectedPick] = useState(DRAFT_PICKS[0]);
  const timerRef = useRef(null);

  const handleSearch = (val) => {
    setQuery(val);
    clearTimeout(timerRef.current);
    if (val.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(() => {
      axios.get(`${API}/nba/search`, { params: { q: val } }).then(r => setResults(r.data.players));
    }, 300);
  };

  const pick = (p) => {
    setResults([]);
    setQuery("");
    onAdd({ type: "player", nbaId: p.id, name: p.full_name });
  };

  return (
    <div>
      <input
        className="search-input"
        placeholder="Search any NBA player..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
        onBlur={() => setTimeout(() => setResults([]), 200)}
      />
      {results.length > 0 && (
        <div className="search-results">
          {results.map(p => (
            <div key={p.id} className="search-item" onClick={() => pick(p)}>{p.full_name}</div>
          ))}
        </div>
      )}
      {loading && <div className="loading-inline">⏳ Fetching player data...</div>}
      <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid var(--border)" }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Add Draft Pick</div>
        <select className="pick-select" value={selectedPick} onChange={e => setSelectedPick(e.target.value)}>
          {DRAFT_PICKS.map(p => <option key={p} value={p}>{p} ({PICK_VALUES[p]})</option>)}
        </select>
        <button className="add-pick-btn" onClick={() => onAdd({ type:"pick", name:selectedPick, value:PICK_VALUES[selectedPick] })}>
          + Add Pick to Trade
        </button>
      </div>
    </div>
  );
}

function PlayerCard({ item, onRemove }) {
  if (item.type === "pick") {
    return (
      <div className="pick-card">
        <div>
          <div className="pick-name"><CircleDot size={14}/> {item.name}</div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2, letterSpacing:1 }}>DRAFT PICK</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div className="pick-score">{item.value}</div>
          <button className="remove-btn" onClick={onRemove}><X size={14}/></button>
        </div>
      </div>
    );
  }

  const { playerData, tradeValue } = item;
  if (!playerData || !tradeValue) return null;
  const bd = tradeValue.breakdown;
  const ovr = tradeValue.overall;

  return (
    <div className="player-card">
      <div className="player-card-header">
        <div style={{ flex:1 }}>
          <div className="player-card-name">
            {playerData.full_name}
            {tradeValue.is_cornerstone && <span className="cornerstone-badge"><Star size={11} fill="currentColor"/> Elite Cornerstone</span>}
            {!tradeValue.is_cornerstone && tradeValue.is_allstar && <span className="allstar-badge"><Star size={11} fill="currentColor"/> All-Star</span>}
          </div>
          <div className="player-card-team">{playerData.team} · {playerData.position}</div>
          <div style={{ display:"flex", gap:10, marginTop:6, fontSize:12 }}>
            <span style={{ color:"var(--red)", fontFamily:"var(--display)", fontSize:15, fontWeight:700 }}>{playerData.averages?.avg_pts} PTS</span>
            <span style={{ color:"var(--muted)" }}>{playerData.averages?.avg_reb} REB</span>
            <span style={{ color:"var(--muted)" }}>{playerData.averages?.avg_ast} AST</span>
            <span style={{ color:"var(--muted)" }}>{playerData.averages?.avg_fg_pct ? (playerData.averages.avg_fg_pct*100).toFixed(1)+"% FG" : ""}</span>
          </div>
        </div>
        <div style={{ textAlign:"right", marginLeft:16, display:"flex", flexDirection:"column", alignItems:"flex-end" }}>
          {/* 2K-style OVR */}
          <div style={{ lineHeight:1, marginBottom:2 }}>
            <span style={{ fontFamily:"var(--display)", fontSize:52, fontWeight:600, color:getOvrColor(ovr) }}>{ovr}</span>
          </div>
          <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>OVR</div>
          {/* Trade value underneath */}
          <div style={{ fontSize:11, color:getScoreColor(tradeValue.score), letterSpacing:1, fontFamily:"var(--display)", fontWeight:700 }}>
            TV {tradeValue.score} · {tradeValue.tier}
          </div>
          <button className="remove-btn" style={{ marginTop:8 }} onClick={onRemove}><X size={14}/></button>
        </div>
      </div>
      <div className="score-bar-wrap">
        <div className="score-bar" style={{ width:`${tradeValue.score}%`, background:getScoreColor(tradeValue.score) }} />
      </div>
      <div className="breakdown-grid">
        {[
          ["Scoring",    bd.scoring],
          ["Defense",    bd.defense],
          ["Playmaking", bd.playmaking],
          ["TS%",        bd.efficiency],
          ["+/−",        bd.impact],
          ["Durability", bd.durability],
          ["Age",        bd.age_value],
          ["Pedigree",   bd.pedigree],
        ].map(([label, val]) => (
          <div className="breakdown-item" key={label}>
            <div className="breakdown-val" style={{ color: typeof val==="number" && val>=70?"#4ade80":typeof val==="number" && val>=40?"var(--gold)":"var(--muted)" }}>
              {typeof val==="number" ? Math.round(val) : val}
            </div>
            <div className="breakdown-lbl">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TradeAnalyzer() {
  const [sideA, setSideA]       = useState([]);
  const [sideB, setSideB]       = useState([]);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const fetchAndAdd = async (item, setSide, setLoading) => {
    if (item.type === "pick") { setSide(prev => [...prev, item]); return; }
    setLoading(true);
    try {
      const [statsRes, valueRes] = await Promise.all([
        axios.get(`${API}/nba/player/${item.nbaId}/stats`),
        axios.get(`${API}/trade/value/${item.nbaId}`),
      ]);
      setSide(prev => [...prev, {
        type: "player", nbaId: item.nbaId,
        playerData: { ...statsRes.data.player, averages: statsRes.data.averages },
        tradeValue: valueRes.data,
      }]);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const { raw: totalA, effective: effA } = computeEffective(sideA);
  const { raw: totalB, effective: effB } = computeEffective(sideB);
  const effSum = effA + effB;
  const barA = effSum > 0 ? (effA/effSum)*100 : 50;
  const barB = effSum > 0 ? (effB/effSum)*100 : 50;

  const getVerdict = () => {
    if (sideA.length===0 && sideB.length===0) return null;
    if (effSum===0) return null;
    const diff = Math.abs(effA-effB);
    const pct  = (diff/Math.max(effA, effB))*100;
    const winner = effA > effB ? "Team A" : "Team B";
    if (pct < 8)  return { text:"✓ Fair Trade", color:"var(--green)", pct };
    if (pct < 18) return { text:`Slight Advantage - ${winner}`, color:"var(--gold)", pct };
    return { text:`Lopsided - ${winner} wins`, color:"var(--red)", pct };
  };

  const verdict = getVerdict();

  // If a real star is involved and the trade is lopsided, explain what the
  // package realistically needs - the model's whole point.
  const bigStar = [...sideA, ...sideB]
    .filter(i => i.type === "player" && premiumMult(i) >= 1.30)
    .sort((a, b) => (b.tradeValue?.score||0) - (a.tradeValue?.score||0))[0];
  const starNote = (verdict && verdict.pct >= 18 && bigStar)
    ? `Prying loose a ${bigStar.tradeValue.tier} like ${bigStar.playerData?.full_name} usually takes a young star plus multiple first-round picks - not role players and late picks.`
    : null;

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Trade <span>Analyzer</span></div>
      <div className="page-sub">Custom Algorithm · Any NBA Player · OVR 40–99 · Trade Value 0–100</div>

      {(sideA.length > 0 || sideB.length > 0) && (
        <div className="fairness-wrap">
          <div className="fairness-labels">
            <span style={{ color:"var(--red)", fontFamily:"var(--display)", fontSize:18, fontWeight:700 }}>Team A - {effA.toFixed(1)}</span>
            {verdict && <span style={{ color:verdict.color, fontFamily:"var(--display)", fontSize:20, fontWeight:700 }}>{verdict.text}</span>}
            <span style={{ color:"#4a9eff", fontFamily:"var(--display)", fontSize:18, fontWeight:700 }}>Team B - {effB.toFixed(1)}</span>
          </div>
          <div className="fairness-bar-wrap">
            <div className="fairness-bar-a" style={{ width:`${barA}%` }} />
            <div className="fairness-bar-b" style={{ width:`${barB}%` }} />
          </div>
          {verdict && (
            <div style={{ textAlign:"center", fontSize:11, color:"var(--muted)", letterSpacing:1 }}>
              Adjusted value - incl. star premium &amp; roster-depth discount · Δ {Math.abs(effA-effB).toFixed(1)} ({verdict.pct.toFixed(1)}%)
              <span style={{ marginLeft:8, color:"#444" }}>sticker: {totalA.toFixed(0)} vs {totalB.toFixed(0)}</span>
            </div>
          )}
          {starNote && (
            <div style={{ textAlign:"center", fontSize:11, color:"var(--gold)", letterSpacing:0.5, marginTop:8, borderTop:"1px solid var(--border)", paddingTop:8 }}>
              ⚠ {starNote}
            </div>
          )}
        </div>
      )}

      <div className="ta-layout">
        <div className="ta-side A">
          <div className="ta-side-title A">Team A Gives</div>
          <PlayerSearch onAdd={(item) => fetchAndAdd(item, setSideA, setLoadingA)} loading={loadingA} />
          {sideA.length===0 && <div className="empty-side">Add players or picks above</div>}
          {sideA.map((item,i) => <PlayerCard key={i} item={item} onRemove={() => setSideA(prev => prev.filter((_,j)=>j!==i))} />)}
          {sideA.length>0 && <div className="total-row"><span className="total-label">Sticker Value</span><span className="total-value" style={{color:"var(--red)"}}>{totalA.toFixed(1)}</span></div>}
        </div>

        <div className="ta-side B">
          <div className="ta-side-title B">Team B Gives</div>
          <PlayerSearch onAdd={(item) => fetchAndAdd(item, setSideB, setLoadingB)} loading={loadingB} />
          {sideB.length===0 && <div className="empty-side">Add players or picks above</div>}
          {sideB.map((item,i) => <PlayerCard key={i} item={item} onRemove={() => setSideB(prev => prev.filter((_,j)=>j!==i))} />)}
          {sideB.length>0 && <div className="total-row"><span className="total-label">Sticker Value</span><span className="total-value" style={{color:"#4a9eff"}}>{totalB.toFixed(1)}</span></div>}
        </div>
      </div>

      <div className="section-header"><div className="section-title">Player Rating Scale</div><div className="section-line" /></div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:8, marginBottom:36 }}>
        {[
          ["96-100","97-99","Elite Cornerstone","#f97316"],
          ["85-95","90-96","Franchise Star","#fbbf24"],
          ["70-84","81-89","All-Star Caliber","#4ade80"],
          ["55-69","72-80","Starter","#60a5fa"],
          ["40-54","64-71","Rotation Player","var(--gold)"],
          ["25-39","55-63","Bench Player","var(--muted)"],
          ["0-24","40-54","Fringe Roster","#444"],
        ].map(([tv,ovr,label,color])=>(
          <div key={tv} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
              <span style={{ fontFamily:"var(--display)", fontSize:22, fontWeight:600, color }}>OVR {ovr}</span>
            </div>
            <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:10, color:"#333", letterSpacing:1 }}>TV {tv}</div>
          </div>
        ))}
      </div>

      <div className="section-header"><div className="section-title">Draft Pick Values</div><div className="section-line" /></div>
      <div style={{ marginBottom:8, fontSize:11, color:"var(--muted)", letterSpacing:1 }}>
        Picks represent upside potential, not guaranteed production - uncertainty is priced in.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:8, marginBottom:40 }}>
        {DRAFT_PICKS.map(p=>(
          <div key={p} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{fontSize:12}}>{p}</span>
            <span style={{fontFamily:"var(--display)",fontSize:22,fontWeight:700,color:"var(--gold)"}}>{PICK_VALUES[p]}</span>
          </div>
        ))}
      </div>

      <div className="section-header"><div className="section-title">Historical Trade Reference</div><div className="section-line" /></div>
      <div style={{ marginBottom:16, fontSize:11, color:"var(--muted)", letterSpacing:1 }}>
        Real trades that anchor what scores mean in practice. Use these to gut-check your analysis.
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {HISTORICAL_TRADES.map((t, i) => (
          <div key={i} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, padding:"16px 20px" }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:10 }}>
              <span style={{ fontFamily:"var(--display)", fontSize:16, fontWeight:700, color:"var(--text)" }}>{t.headline}</span>
              <span style={{ fontSize:11, color:"var(--muted)", letterSpacing:1 }}>{t.year}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"var(--muted)", marginBottom:4 }}>Side A gives</div>
                {t.sideA.map((item, j) => (
                  <div key={j} style={{ fontSize:12, color:"var(--red)", marginBottom:2 }}>• {item}</div>
                ))}
              </div>
              <div style={{ fontSize:20, color:"var(--muted)", alignSelf:"center" }}>⇄</div>
              <div>
                <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"var(--muted)", marginBottom:4 }}>Side B gives</div>
                {t.sideB.map((item, j) => (
                  <div key={j} style={{ fontSize:12, color:"#4a9eff", marginBottom:2 }}>• {item}</div>
                ))}
              </div>
            </div>
            <div style={{ fontSize:11, color:"var(--gold)", borderTop:"1px solid var(--border)", paddingTop:8 }}>
              ↳ {t.takeaway}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
