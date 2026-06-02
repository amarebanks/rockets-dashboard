import { useState, useRef } from "react";
import axios from "axios";

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
  "Top 5 Pick": 72,
  "Lottery Pick (6-14)": 55,
  "Late First (15-20)": 40,
  "Late First (21-30)": 28,
  "Future First (Top 10 Protected)": 35,
  "Future First (Unprotected)": 42,
  "Future First (Protected)": 22,
  "Second Round Pick": 10,
  "Future Second Round": 7,
};

const HISTORICAL_TRADES = [
  {
    year: "Feb 2023",
    headline: "Kevin Durant → Phoenix Suns",
    sideA: ["Kevin Durant (age 35)"],
    sideB: ["Mikal Bridges", "Cameron Johnson", "Jae Crowder", "4 First-Round Picks"],
    takeaway: "BKN in full rebuild — rare case where a team accepted massive asset haul for a still-elite 35-year-old.",
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
    takeaway: "DAL won significantly — expiring contract (1.5 years left) heavily deflated Kyrie's return.",
  },
  {
    year: "Jul 2019",
    headline: "Anthony Davis → Los Angeles Lakers",
    sideA: ["Anthony Davis (age 26)"],
    sideB: ["Lonzo Ball", "Brandon Ingram", "Josh Hart", "Kyle Kuzma", "3 First-Round Picks"],
    takeaway: "Prime AD (score ~90) commanded a franchise-altering return — the gold standard for star trades.",
  },
  {
    year: "Jul 2024",
    headline: "Paul George → Philadelphia 76ers",
    sideA: ["Paul George (age 34)"],
    sideB: ["5 Draft Picks", "Caleb Martin", "Eric Gordon rights"],
    takeaway: "PHI overpaid for an aging max-contract player — a reminder that salary and contract years matter.",
  },
];

const css = `
  .ta-layout { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
  .ta-side { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:20px; }
  .ta-side.A { border-top:3px solid var(--red); }
  .ta-side.B { border-top:3px solid #4a9eff; }
  .ta-side-title { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:16px; }
  .ta-side-title.A { color:var(--red); }
  .ta-side-title.B { color:#4a9eff; }
  .search-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:2px; padding:9px 12px; color:var(--text); font-family:'Barlow',sans-serif; font-size:13px; outline:none; margin-bottom:6px; }
  .search-input:focus { border-color:var(--red); }
  .search-results { background:var(--surface2); border:1px solid var(--border); border-radius:2px; overflow:hidden; margin-bottom:10px; }
  .search-item { padding:9px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border); }
  .search-item:last-child { border-bottom:none; }
  .search-item:hover { background:var(--surface); color:var(--red); }
  .pick-select { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:2px; padding:8px 12px; color:var(--text); font-family:'Barlow',sans-serif; font-size:12px; outline:none; margin-bottom:8px; cursor:pointer; }
  .add-pick-btn { font-family:'Barlow Condensed',sans-serif; font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:6px 14px; border-radius:2px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; width:100%; margin-bottom:16px; }
  .add-pick-btn:hover { border-color:var(--text); color:var(--text); }
  .player-card { background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:14px; margin-bottom:8px; position:relative; }
  .player-card-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:10px; }
  .player-card-name { font-weight:600; font-size:14px; }
  .player-card-team { font-size:11px; color:var(--muted); margin-top:2px; }
  .player-score { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; line-height:1; }
  .player-tier { font-size:10px; letter-spacing:2px; text-transform:uppercase; margin-top:2px; }
  .remove-btn { background:none; border:1px solid var(--border); color:var(--muted); width:24px; height:24px; border-radius:2px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .remove-btn:hover { border-color:var(--red); color:var(--red); }
  .breakdown-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; margin-top:10px; }
  .breakdown-item { text-align:center; background:var(--surface); border-radius:2px; padding:5px 3px; }
  .breakdown-val { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; }
  .breakdown-lbl { font-size:8px; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-top:1px; }
  .score-bar-wrap { height:5px; background:var(--surface); border-radius:3px; overflow:hidden; margin-top:8px; }
  .score-bar { height:100%; border-radius:3px; transition:width 0.3s; }
  .pick-card { background:var(--surface2); border:1px solid var(--border); border-radius:4px; padding:12px 14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; }
  .pick-name { font-size:13px; font-weight:500; }
  .pick-score { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:700; color:var(--gold); }
  .total-row { display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-top:1px solid var(--border); margin-top:8px; }
  .total-label { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .total-value { font-family:'Barlow Condensed',sans-serif; font-size:32px; font-weight:900; }
  .fairness-wrap { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:20px 24px; margin-bottom:24px; }
  .fairness-bar-wrap { height:14px; background:var(--surface2); border-radius:7px; overflow:hidden; margin:12px 0 8px; display:flex; }
  .fairness-bar-a { height:100%; background:var(--red); transition:width 0.4s; }
  .fairness-bar-b { height:100%; background:#4a9eff; transition:width 0.4s; }
  .fairness-labels { display:flex; justify-content:space-between; font-size:12px; }
  .allstar-badge { display:inline-block; font-size:9px; letter-spacing:1px; text-transform:uppercase; background:var(--gold); color:#000; padding:2px 6px; border-radius:2px; margin-left:6px; vertical-align:middle; }
  .cornerstone-badge { display:inline-block; font-size:9px; letter-spacing:1px; text-transform:uppercase; background:linear-gradient(135deg,#f97316,#fbbf24); color:#000; padding:2px 6px; border-radius:2px; margin-left:6px; vertical-align:middle; font-weight:700; }
  .section-header { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .loading-inline { font-size:12px; color:var(--muted); letter-spacing:1px; padding:8px 0; }
  .empty-side { text-align:center; padding:28px; color:var(--muted); font-size:12px; letter-spacing:1px; border:1px dashed var(--border); border-radius:4px; margin-bottom:8px; }
  .page-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
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
          <div className="pick-name">🏀 {item.name}</div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2, letterSpacing:1 }}>DRAFT PICK</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div className="pick-score">{item.value}</div>
          <button className="remove-btn" onClick={onRemove}>✕</button>
        </div>
      </div>
    );
  }

  const { playerData, tradeValue } = item;
  if (!playerData || !tradeValue) return null;
  const bd = tradeValue.breakdown;

  return (
    <div className="player-card">
      <div className="player-card-header">
        <div style={{ flex:1 }}>
          <div className="player-card-name">
            {playerData.full_name}
            {tradeValue.is_cornerstone && <span className="cornerstone-badge">★ Elite Cornerstone</span>}
            {!tradeValue.is_cornerstone && tradeValue.is_allstar && <span className="allstar-badge">★ All-Star</span>}
          </div>
          <div className="player-card-team">{playerData.team} · {playerData.position}</div>
          <div style={{ display:"flex", gap:10, marginTop:6, fontSize:12 }}>
            <span style={{ color:"var(--red)", fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700 }}>{playerData.averages?.avg_pts} PTS</span>
            <span style={{ color:"var(--muted)" }}>{playerData.averages?.avg_reb} REB</span>
            <span style={{ color:"var(--muted)" }}>{playerData.averages?.avg_ast} AST</span>
            <span style={{ color:"var(--muted)" }}>{playerData.averages?.avg_fg_pct ? (playerData.averages.avg_fg_pct*100).toFixed(1)+"% FG" : ""}</span>
          </div>
        </div>
        <div style={{ textAlign:"right", marginLeft:12 }}>
          <div className="player-score" style={{ color:getScoreColor(tradeValue.score) }}>{tradeValue.score}</div>
          <div className="player-tier" style={{ color:getScoreColor(tradeValue.score) }}>{tradeValue.tier}</div>
          <button className="remove-btn" style={{ marginTop:6, marginLeft:"auto" }} onClick={onRemove}>✕</button>
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

  const totalA = sideA.reduce((s, i) => s + (i.type==="pick" ? i.value : (i.tradeValue?.score||0)), 0);
  const totalB = sideB.reduce((s, i) => s + (i.type==="pick" ? i.value : (i.tradeValue?.score||0)), 0);
  const totalSum = totalA + totalB;
  const barA = totalSum > 0 ? (totalA/totalSum)*100 : 50;
  const barB = totalSum > 0 ? (totalB/totalSum)*100 : 50;

  const getVerdict = () => {
    if (sideA.length===0 && sideB.length===0) return null;
    if (totalSum===0) return null;
    const diff = Math.abs(totalA-totalB);
    const pct  = (diff/((totalSum)/2))*100;
    if (pct < 8)  return { text:"✓ Fair Trade", color:"var(--green)", pct };
    if (pct < 20) return { text:`Slight Advantage — ${totalA>totalB?"Team A":"Team B"}`, color:"var(--gold)", pct };
    return { text:`Lopsided — ${totalA>totalB?"Team A":"Team B"} wins big`, color:"var(--red)", pct };
  };

  const verdict = getVerdict();

  return (
    <div className="page">
      <style>{css}</style>
      <div className="page-title">Trade <span>Analyzer</span></div>
      <div className="page-sub">Custom Algorithm · Any NBA Player · Scored 0–100 · Calibrated Against Real Trades</div>

      {(sideA.length > 0 || sideB.length > 0) && (
        <div className="fairness-wrap">
          <div className="fairness-labels">
            <span style={{ color:"var(--red)", fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:700 }}>Team A — {totalA.toFixed(1)}</span>
            {verdict && <span style={{ color:verdict.color, fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700 }}>{verdict.text}</span>}
            <span style={{ color:"#4a9eff", fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:700 }}>Team B — {totalB.toFixed(1)}</span>
          </div>
          <div className="fairness-bar-wrap">
            <div className="fairness-bar-a" style={{ width:`${barA}%` }} />
            <div className="fairness-bar-b" style={{ width:`${barB}%` }} />
          </div>
          {verdict && (
            <div style={{ textAlign:"center", fontSize:11, color:"var(--muted)", letterSpacing:1 }}>
              Difference: {Math.abs(totalA-totalB).toFixed(1)} points ({verdict.pct.toFixed(1)}%)
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
          {sideA.length>0 && <div className="total-row"><span className="total-label">Total Value</span><span className="total-value" style={{color:"var(--red)"}}>{totalA.toFixed(1)}</span></div>}
        </div>

        <div className="ta-side B">
          <div className="ta-side-title B">Team B Gives</div>
          <PlayerSearch onAdd={(item) => fetchAndAdd(item, setSideB, setLoadingB)} loading={loadingB} />
          {sideB.length===0 && <div className="empty-side">Add players or picks above</div>}
          {sideB.map((item,i) => <PlayerCard key={i} item={item} onRemove={() => setSideB(prev => prev.filter((_,j)=>j!==i))} />)}
          {sideB.length>0 && <div className="total-row"><span className="total-label">Total Value</span><span className="total-value" style={{color:"#4a9eff"}}>{totalB.toFixed(1)}</span></div>}
        </div>
      </div>

      <div className="section-header"><div className="section-title">Trade Value Scale</div><div className="section-line" /></div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:8, marginBottom:36 }}>
        {[["96-100","Elite Cornerstone","#f97316"],["85-95","Franchise Star","#fbbf24"],["70-84","All-Star Caliber","var(--red)"],["55-69","Starter","#4ade80"],["40-54","Rotation Player","#60a5fa"],["25-39","Bench Player","var(--muted)"],["0-24","Fringe Roster","#444"]].map(([range,label,color])=>(
          <div key={range} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:700, color, minWidth:48 }}>{range}</div>
            <div style={{ fontSize:10, color:"var(--muted)", letterSpacing:1, textTransform:"uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="section-header"><div className="section-title">Draft Pick Values</div><div className="section-line" /></div>
      <div style={{ marginBottom:8, fontSize:11, color:"var(--muted)", letterSpacing:1 }}>
        Calibrated against real NBA trades — picks are potential, not guaranteed production.
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:8, marginBottom:40 }}>
        {DRAFT_PICKS.map(p=>(
          <div key={p} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{fontSize:12}}>{p}</span>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:700,color:"var(--gold)"}}>{PICK_VALUES[p]}</span>
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
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, color:"var(--text)" }}>{t.headline}</span>
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
