import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

const CONFIRMED_DRAFT_YEAR = 2026;   // the next draft, whose order is set by final standings

const TEAMS = ["ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"];

const css = `
  .dc-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
  .dc-title { font-family:var(--display); font-size:36px; font-weight:600; letter-spacing: -0.01em; }
  .dc-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin-top:4px; }
  .dc-teamsel { background:var(--surface2); border:1px solid var(--border); border-radius:3px; padding:9px 14px; color:var(--text);
    font-family:var(--display); font-size:18px; font-weight:700; letter-spacing:1px; outline:none; cursor:pointer; }
  .dc-teamsel:focus { border-color:var(--red); }
  .section-header { display:flex; align-items:center; gap:12px; margin:24px 0 14px; }
  .section-title { font-family:var(--display); font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; }
  .section-line { flex:1; height:1px; background:var(--border); }
  .dc-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
  .dc-stat { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px 18px; position:relative; overflow:hidden; }
  .dc-stat.out::before { background:var(--muted); }
  .dc-stat-val { font-family:var(--display); font-size:38px; font-weight:700; line-height:1; }
  .dc-stat-lbl { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-top:6px; }
  .year-block { margin-bottom:12px; }
  .year-num { font-family:var(--display); font-size:22px; font-weight:600; margin-bottom:6px; }
  .pick-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:7px; }
  .pick-card.out { opacity:0.78; }
  .pick-top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .pick-label { font-weight:600; font-size:14px; }
  .pick-num { font-family:var(--display); font-weight:800; font-size:15px; color:var(--gold); letter-spacing:0.5px; }
  .pick-to { font-size:11px; color:var(--muted); }
  .pick-details { font-size:11px; color:var(--muted); line-height:1.5; margin-top:5px; }
  .badge { display:inline-block; font-size:8px; letter-spacing:1px; text-transform:uppercase; padding:2px 7px; border-radius:8px; font-weight:700; }
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
        {p.pick_number && <span className="pick-num">No. {p.pick_number}</span>}
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
        <div className="loading">No pick data - run draft_scraper.py</div>
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
            <b>Exact pick numbers</b> are shown for the {CONFIRMED_DRAFT_YEAR} draft, computed from final standings -
            round-2 (31–60) and round-1 non-lottery slots are exact; round-1 lottery slots (1–14) are pre-lottery order.
            Later drafts have no order yet. A <b>swap</b> names its counterparty (e.g. a 2027 BKN swap), distinct from an
            outright pick acquired from another team. Re-run <b>draft_scraper.py</b> to refresh.
          </div>
        </>
      )}
    </div>
  );
}
