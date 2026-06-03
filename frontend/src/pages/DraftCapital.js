import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

const TEAMS = ["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"];

const css = `
  .dc-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
  .dc-title { font-family:'Barlow Condensed',sans-serif; font-size:36px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }
  .dc-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .dc-teamsel { background:var(--surface2); border:1px solid var(--border); border-radius:3px; padding:9px 14px; color:var(--text);
    font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:700; letter-spacing:1px; outline:none; cursor:pointer; }
  .dc-teamsel:focus { border-color:var(--red); }
  .section-header { display:flex; align-items:center; gap:12px; margin:24px 0 14px; }
  .section-title { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .dc-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
  .dc-stat { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:16px 18px; position:relative; overflow:hidden; }
  .dc-stat::before { content:''; position:absolute; top:0;left:0;right:0; height:3px; background:var(--red); }
  .dc-stat.out::before { background:var(--muted); }
  .dc-stat-val { font-family:'Barlow Condensed',sans-serif; font-size:38px; font-weight:700; line-height:1; }
  .dc-stat-lbl { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:6px; }
  .year-block { margin-bottom:12px; }
  .year-num { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:900; margin-bottom:6px; }
  .pick-card { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:12px 16px; margin-bottom:7px; }
  .pick-card.out { opacity:0.78; }
  .pick-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .pick-label { font-weight:600; font-size:14px; }
  .pick-to { font-size:11px; color:var(--muted); }
  .pick-details { font-size:11px; color:var(--muted); line-height:1.5; margin-top:5px; }
  .badge { display:inline-block; font-size:8px; letter-spacing:1px; text-transform:uppercase; padding:2px 7px; border-radius:2px; font-weight:700; }
  .badge.first { background:rgba(249,115,22,0.15); color:#f97316; border:1px solid rgba(249,115,22,0.3); }
  .badge.second { background:rgba(102,102,102,0.15); color:var(--muted); border:1px solid rgba(102,102,102,0.3); }
  .badge.swap { background:rgba(96,165,250,0.15); color:#60a5fa; border:1px solid rgba(96,165,250,0.35); }
  .badge.prot { background:rgba(196,162,101,0.15); color:var(--gold); border:1px solid rgba(196,162,101,0.35); }
  .badge.outb { background:rgba(206,17,65,0.13); color:var(--red); border:1px solid rgba(206,17,65,0.3); }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .note { font-size:11px; color:var(--muted); letter-spacing:0.5px; line-height:1.6; margin-top:16px; }
  .note b { color:var(--text); }
  .empty { color:var(--muted); font-size:12px; padding:8px 0; }
`;

const isProtected = (d) => /protect/i.test(d || "") && !/no protection/i.test(d || "");

function PickCard({ p, outgoing }) {
  const kind = p.kind === "swap" ? "swap" : (p.round === 1 ? "first" : "second");
  return (
    <div className={"pick-card" + (outgoing ? " out" : "")}>
      <div className="pick-top">
        <span className={"badge " + kind}>{p.kind === "swap" ? "Swap" : (p.round === 1 ? "1st" : "2nd")}</span>
        <span className="pick-label">{p.label}</span>
        {isProtected(p.details) && <span className="badge prot">Protected</span>}
        {outgoing && p.to && <span className="pick-to">→ {p.to}</span>}
      </div>
      {p.details && p.details.toLowerCase() !== "no protections" && (
        <div className="pick-details">{p.details}</div>
      )}
    </div>
  );
}

export default function DraftCapital() {
  const [team, setTeam] = useState("HOU");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/draft/picks`, { params: { team } })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [team]);

  // Group held (incoming) picks by year.
  const byYear = {};
  (data?.incoming || []).forEach(p => { (byYear[p.year] = byYear[p.year] || []).push(p); });
  const years = Object.keys(byYear).sort();
  const outByYear = {};
  (data?.outgoing || []).forEach(p => { (outByYear[p.year] = outByYear[p.year] || []).push(p); });
  const outYears = Object.keys(outByYear).sort();
  const s = data?.summary;

  return (
    <div className="page">
      <style>{css}</style>
      <div className="dc-head">
        <div>
          <div className="dc-title">Draft <span style={{ color: "var(--red)" }}>Capital</span></div>
          <div className="dc-sub">Real pick ownership{data?.season ? ` · ${data.season}` : ""}</div>
        </div>
        <select className="dc-teamsel" value={team} onChange={e => setTeam(e.target.value)}>
          {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <div className="loading">Loading draft capital…</div> : !data ? (
        <div className="loading">No pick data — run draft_scraper.py</div>
      ) : (
        <>
          <div className="dc-summary">
            <div className="dc-stat">
              <div className="dc-stat-val">{s.first_round_held}</div>
              <div className="dc-stat-lbl">First-Rounders Held</div>
            </div>
            <div className="dc-stat">
              <div className="dc-stat-val">{s.second_round_held}</div>
              <div className="dc-stat-lbl">Second-Rounders Held</div>
            </div>
            <div className="dc-stat">
              <div className="dc-stat-val">{s.swaps}</div>
              <div className="dc-stat-lbl">Swap Rights</div>
            </div>
            <div className="dc-stat out">
              <div className="dc-stat-val">{s.outgoing_firsts}</div>
              <div className="dc-stat-lbl">Firsts Owed</div>
            </div>
          </div>

          <div className="section-header"><div className="section-title">Picks Held</div><div className="section-line" /></div>
          {years.length === 0 && <div className="empty">No held picks on record.</div>}
          {years.map(y => (
            <div className="year-block" key={y}>
              <div className="year-num">{y}</div>
              {byYear[y].map((p, i) => <PickCard key={i} p={p} />)}
            </div>
          ))}

          {outYears.length > 0 && (
            <>
              <div className="section-header"><div className="section-title">Picks Owed / Outgoing</div><div className="section-line" /></div>
              {outYears.map(y => (
                <div className="year-block" key={y}>
                  <div className="year-num">{y}</div>
                  {outByYear[y].map((p, i) => <PickCard key={i} p={p} outgoing />)}
                </div>
              ))}
            </>
          )}

          <div className="note">
            Real future-pick ownership scraped from Fanspo (incoming, outgoing, protections & swap rights).
            A <b>swap</b> names its counterparty — e.g. a 2027 BKN swap is the right to swap with Brooklyn's pick,
            distinct from an outright pick acquired from Phoenix. Re-run <b>draft_scraper.py</b> to refresh.
          </div>
        </>
      )}
    </div>
  );
}
