import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API = "http://127.0.0.1:8000";

const css = `
  .dc-head { margin-bottom: 28px; }
  .dc-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .dc-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .section-header { display:flex; align-items:center; gap:12px; margin:8px 0 16px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .dc-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:28px; }
  .dc-stat { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:18px; position:relative; overflow:hidden; }
  .dc-stat::before { content:''; position:absolute; top:0;left:0;right:0; height:3px; background:var(--red); }
  .dc-stat.gold::before { background:var(--gold); }
  .dc-stat-val { font-family:'Barlow Condensed',sans-serif; font-size:40px; font-weight:700; line-height:1; }
  .dc-stat-lbl { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:6px; }
  .chart-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:24px; margin-bottom:28px; }
  .year-block { margin-bottom:14px; }
  .year-head { display:flex; align-items:baseline; gap:10px; margin-bottom:8px; }
  .year-num { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:900; }
  .year-val { font-size:11px; letter-spacing:1px; color:var(--gold); text-transform:uppercase; }
  .pick-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:14px 16px; margin-bottom:8px;
    display:grid; grid-template-columns:1fr auto 120px 58px; gap:14px; align-items:center; }
  .pick-label { font-weight:600; font-size:14px; }
  .pick-via { font-size:11px; color:var(--muted); margin-top:2px; }
  .pick-tier { font-size:9px; letter-spacing:1px; text-transform:uppercase; padding:3px 8px; border-radius:2px; white-space:nowrap; }
  .pick-bar-wrap { height:7px; background:var(--surface2); border-radius:4px; overflow:hidden; }
  .pick-bar { height:100%; border-radius:4px; }
  .pick-val { font-family:'Barlow Condensed',sans-serif; font-size:24px; font-weight:700; text-align:right; }
  .badge { display:inline-block; font-size:8px; letter-spacing:1px; text-transform:uppercase; padding:2px 6px; border-radius:2px; margin-left:6px; vertical-align:middle; }
  .badge.swap { background:rgba(96,165,250,0.15); color:#60a5fa; border:1px solid rgba(96,165,250,0.35); }
  .badge.prot { background:rgba(196,162,101,0.15); color:var(--gold); border:1px solid rgba(196,162,101,0.35); }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .note { font-size:11px; color:var(--muted); letter-spacing:0.5px; line-height:1.6; }
  .disclaimer { background:var(--surface); border:1px dashed var(--border); border-radius:4px; padding:14px 18px; margin-bottom:24px; font-size:12px; color:var(--muted); line-height:1.5; }
  .disclaimer b { color:var(--gold); }
`;

const tierStyle = (tier) => {
  const map = {
    "Top 5":        ["rgba(249,115,22,0.15)", "#f97316"],
    "Lottery":      ["rgba(196,162,101,0.18)", "var(--gold)"],
    "Mid First":    ["rgba(74,222,128,0.15)", "#4ade80"],
    "Late First":   ["rgba(96,165,250,0.15)", "#60a5fa"],
    "Second Round": ["rgba(102,102,102,0.15)", "var(--muted)"],
  };
  const [bg, color] = map[tier] || map["Second Round"];
  return { background: bg, color, border: `1px solid ${color}33` };
};
const tierColor = (tier) => tierStyle(tier).color;

export default function DraftCapital() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/draft/assets`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxVal = data ? Math.max(...data.picks.map(p => p.value), 1) : 1;
  const chartData = data ? data.by_year.map(y => ({ year: `'${String(y.year).slice(2)}`, value: y.value })) : [];

  return (
    <div className="page">
      <style>{css}</style>
      <div className="dc-head">
        <div className="dc-title">Draft <span style={{ color:"var(--red)" }}>Capital</span></div>
        <div className="dc-sub">Rockets pick inventory & valuation</div>
      </div>

      {loading ? <div className="loading">Loading draft capital…</div> : !data ? (
        <div className="loading">Could not load draft assets.</div>
      ) : (
        <>
          <div className="disclaimer">
            ⓘ Pick inventory is <b>curated</b> from publicly reported draft capital and is approximate — the NBA's data feeds don't
            expose future pick ownership. Values are model-based on a 0–100 scale, consistent with the Trade Analyzer.
          </div>

          <div className="dc-summary">
            <div className="dc-stat gold">
              <div className="dc-stat-val" style={{ color:"var(--gold)" }}>{data.summary.total_value}</div>
              <div className="dc-stat-lbl">Total Capital Value</div>
            </div>
            <div className="dc-stat">
              <div className="dc-stat-val">{data.summary.first_round}</div>
              <div className="dc-stat-lbl">First-Rounders</div>
            </div>
            <div className="dc-stat">
              <div className="dc-stat-val">{data.summary.swaps}</div>
              <div className="dc-stat-lbl">Pick Swaps</div>
            </div>
            <div className="dc-stat">
              <div className="dc-stat-val">{data.summary.second_round}</div>
              <div className="dc-stat-lbl">Second-Rounders</div>
            </div>
          </div>

          <div className="section-header"><div className="section-title">Value by Draft Year</div><div className="section-line" /></div>
          <div className="chart-card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="year" tick={{ fill:"#555", fontSize:12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"#555", fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background:"#1a1a1a", border:"1px solid #222", borderRadius:4, fontSize:13 }} cursor={{ fill:"rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" fill="#C4A265" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="section-header"><div className="section-title">Pick-by-Pick</div><div className="section-line" /></div>
          {data.by_year.map(y => (
            <div className="year-block" key={y.year}>
              <div className="year-head">
                <span className="year-num">{y.year}</span>
                <span className="year-val">capital value {y.value}</span>
              </div>
              {y.picks.map((p, i) => (
                <div className="pick-card" key={i}>
                  <div>
                    <div className="pick-label">
                      {p.label}
                      {p.kind === "swap" && <span className="badge swap">Swap</span>}
                      {p.protection && <span className="badge prot">{p.protection} prot</span>}
                    </div>
                    <div className="pick-via">via {p.via} · proj. slot {p.proj_range}</div>
                  </div>
                  <span className="pick-tier" style={tierStyle(p.tier)}>{p.tier}</span>
                  <div className="pick-bar-wrap">
                    <div className="pick-bar" style={{ width:`${(p.value/maxVal)*100}%`, background: tierColor(p.tier) }} />
                  </div>
                  <div className="pick-val" style={{ color: tierColor(p.tier) }}>{p.value}</div>
                </div>
              ))}
            </div>
          ))}

          <div className="section-header"><div className="section-title">How Picks Are Valued</div><div className="section-line" /></div>
          <div className="chart-card">
            <div className="note">
              Each pick starts from its <b style={{color:"var(--text)"}}>projected draft slot</b> on a surplus-value curve
              (Top 5 ≈ 60, lottery ≈ 40–46, mid-first ≈ 30, late-first ≈ 16–22, second ≈ 5–9). Then:
              <br/>• <b style={{color:"var(--text)"}}>Swaps</b> are worth ~35% of an outright pick (you only gain if you finish below the other team).
              <br/>• <b style={{color:"var(--text)"}}>Protected</b> picks are discounted ~22% (they may not convey).
              <br/>• <b style={{color:"var(--text)"}}>Time discount</b> of ~7%/yr — distant picks are less certain and less usable now.
              <br/>Because Houston projects as a strong team, its own first-rounders land late (lower value), while incoming picks from
              rebuilding teams project into the lottery and carry far more weight.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
