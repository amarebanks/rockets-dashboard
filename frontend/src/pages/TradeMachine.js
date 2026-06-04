import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { getSeason, seasonLabel } from "../season";

const API = "http://127.0.0.1:8000";

// Draft picks the builder can attach (value on the same 0–100 scale as players).
const PICKS = [
  { name: "First-Round Pick (unprotected)", value: 32 },
  { name: "First-Round Pick (protected)", value: 18 },
  { name: "Pick Swap", value: 12 },
  { name: "Second-Round Pick", value: 7 },
];

const STATUS = {
  room:         { bg: "rgba(74,158,255,0.15)", c: "#4a9eff", label: "Cap Room" },
  over_cap:     { bg: "rgba(150,150,150,0.15)", c: "var(--muted)", label: "Over Cap" },
  taxpayer:     { bg: "rgba(196,162,101,0.18)", c: "var(--gold)", label: "Taxpayer" },
  first_apron:  { bg: "rgba(255,140,60,0.18)", c: "#ff8c3c", label: "First Apron" },
  second_apron: { bg: "rgba(206,17,65,0.20)", c: "var(--red)", label: "Second Apron" },
};
const clabelColor = (l) =>
  l === "Bargain" || l === "Value" ? "var(--green)" :
  l === "Overpaid" ? "#ff8c3c" : l === "Bad contract" ? "var(--red)" : "var(--muted)";

const css = `
  .tm-title { font-family:var(--display); font-size:36px; font-weight:600; letter-spacing: -0.01em; }
  .tm-title span { color:var(--red); }
  .tm-sub { color:var(--muted); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin:4px 0 24px; }
  .tm-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .tm-panel { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; }
  .tm-panel.A { border-top:3px solid var(--red); }
  .tm-panel.B { border-top:3px solid #4a9eff; }
  .tm-teamsel { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:3px; padding:9px 12px; color:var(--text); font-family:var(--display); font-size:18px; font-weight:700; letter-spacing:1px; outline:none; cursor:pointer; }
  .tm-caprow { display:flex; align-items:center; justify-content:space-between; margin:10px 0 4px; }
  .tm-pill { font-size:9px; letter-spacing:1px; text-transform:uppercase; font-weight:800; padding:3px 8px; border-radius:3px; }
  .tm-committed { font-family:var(--display); font-size:15px; font-weight:700; color:var(--muted); }
  .tm-deadzone { min-height:40px; border:1px dashed var(--border); border-radius:10px; padding:8px; margin:8px 0; }
  .tm-deadzone.empty { display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:11px; letter-spacing:1px; text-transform:uppercase; }
  .tm-chip { display:flex; align-items:center; justify-content:space-between; gap:8px; background:var(--surface2); border:1px solid var(--border); border-radius:3px; padding:7px 10px; margin-bottom:5px; }
  .tm-chip .nm { font-size:13px; font-weight:600; }
  .tm-chip .meta { font-size:10px; color:var(--muted); margin-top:1px; }
  .tm-chip .tv { font-family:var(--display); font-size:18px; font-weight:800; color:var(--gold); }
  .tm-x { background:none; border:1px solid var(--border); color:var(--muted); width:22px; height:22px; border-radius:8px; cursor:pointer; flex-shrink:0; }
  .tm-x:hover { border-color:var(--red); color:var(--red); }
  .tm-search { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:8px 11px; color:var(--text); font-size:13px; outline:none; margin:6px 0; }
  .tm-search:focus { border-color:var(--red); }
  .tm-roster { max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:3px; }
  .tm-rrow { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; border-bottom:1px solid var(--border); cursor:pointer; font-size:13px; }
  .tm-rrow:last-child { border-bottom:none; }
  .tm-rrow:hover { background:var(--surface2); }
  .tm-rrow.used { opacity:0.35; cursor:default; }
  .tm-rrow .rv { font-family:var(--display); font-weight:700; color:var(--muted); }
  .tm-pickadd { display:flex; gap:6px; margin-top:8px; }
  .tm-pickadd select { flex:1; background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:12px; padding:7px; outline:none; }
  .tm-pickadd button { font-family:var(--display); font-size:11px; letter-spacing:1px; text-transform:uppercase; padding:0 14px; border:1px solid var(--border); background:transparent; color:var(--muted); border-radius:8px; cursor:pointer; }
  .tm-pickadd button:hover { border-color:var(--text); color:var(--text); }
  .tm-eval { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:20px 24px; margin-top:20px; }
  .tm-legal { display:inline-block; font-family:var(--display); font-size:18px; font-weight:800; letter-spacing:1px; padding:6px 16px; border-radius:3px; }
  .tm-capgrid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:16px 0; }
  .tm-capcard { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; }
  .tm-capcard .t { font-family:var(--display); font-size:16px; font-weight:800; letter-spacing:1px; }
  .tm-capline { font-size:12px; color:var(--muted); margin-top:6px; }
  .tm-capline b { color:var(--text); font-family:var(--display); }
  .tm-arrow { color:var(--muted); }
  .tm-fair-wrap { margin-top:6px; }
  .tm-fair-bar { height:13px; background:var(--surface2); border-radius:7px; overflow:hidden; display:flex; margin:10px 0 6px; }
  .tm-fair-a { background:var(--red); }
  .tm-fair-b { background:#4a9eff; }
  .tm-fair-labels { display:flex; justify-content:space-between; font-family:var(--display); font-size:16px; font-weight:700; }
  .loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--muted); font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .tm-note { font-size:11px; color:var(--muted); line-height:1.6; margin-top:14px; }
  .tm-note b { color:var(--text); }
  @media (max-width:760px){ .tm-grid { grid-template-columns:1fr; } .tm-capgrid { grid-template-columns:1fr; } }
`;

function StatusArrow({ before, after }) {
  const a = STATUS[before] || STATUS.over_cap;
  const b = STATUS[after] || STATUS.over_cap;
  const changed = before !== after;
  return (
    <span>
      <span style={{ color: a.c }}>{a.label}</span>
      {changed && <><span className="tm-arrow"> → </span><span style={{ color: b.c, fontWeight: 700 }}>{b.label}</span></>}
    </span>
  );
}

function CapCard({ side, color }) {
  const c = side.cap;
  if (!c) return <div className="tm-capcard"><div className="t" style={{ color }}>{side.team || "-"}</div><div className="tm-capline">Pick a team</div></div>;
  return (
    <div className="tm-capcard">
      <div className="t" style={{ color }}>{c.team}</div>
      <div className="tm-capline">Salary out <b>${c.out_salary_m}M</b> · in <b>${c.in_salary_m}M</b></div>
      <div className="tm-capline">Payroll <b>${c.committed_before_m}M → ${c.committed_after_m}M</b></div>
      <div className="tm-capline"><StatusArrow before={c.status_before} after={c.status_after} /></div>
      <div className="tm-capline" style={{ color: c.legal ? "var(--green)" : "var(--red)" }}>
        {c.legal ? "✓ Can legally absorb the incoming salary"
                 : `✗ Needs ~$${c.shortfall_m}M more outgoing salary (max take-back $${c.allowed_m}M)`}
      </div>
    </div>
  );
}

function TeamPanel({ side, teams, team, setTeam, deal, setDeal, picks, setPicks, otherTeam }) {
  const [q, setQ] = useState("");
  const teamObj = useMemo(() => teams.find(t => t.team === team), [teams, team]);
  const roster = teamObj?.players || [];
  const allPicks = teamObj?.picks?.length ? teamObj.picks : (team ? PICKS : []);
  const usedPicks = new Set(picks.map(p => p.name));
  const availPicks = allPicks.filter(p => !usedPicks.has(p.name));
  const used = new Set(deal.map(p => p.name));
  const filtered = roster.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
  const st = STATUS[teamObj?.status] || STATUS.over_cap;
  const committed = teamObj?.committed_m;

  return (
    <div className={"tm-panel " + side}>
      <select className="tm-teamsel" value={team} onChange={e => { setTeam(e.target.value); setDeal([]); setPicks([]); }}>
        <option value="">Select a team…</option>
        {teams.map(t => <option key={t.team} value={t.team} disabled={t.team === otherTeam}>{t.team}</option>)}
      </select>

      {team && (
        <div className="tm-caprow">
          <span className="tm-pill" style={{ background: st.bg, color: st.c }}>{st.label}</span>
          <span className="tm-committed">${committed}M payroll</span>
        </div>
      )}

      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", margin: "10px 0 4px" }}>Sends</div>
      <div className={"tm-deadzone" + (deal.length + picks.length === 0 ? " empty" : "")}>
        {deal.length + picks.length === 0 ? "Click players / picks below to add" : (
          <>
            {deal.map((p, i) => (
              <div className="tm-chip" key={"p" + i}>
                <div>
                  <div className="nm">{p.name}</div>
                  <div className="meta">${p.salary_m}M · <span style={{ color: clabelColor(p.contract_label) }}>{p.contract_label}</span></div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="tv">{p.value}</span>
                  <button className="tm-x" onClick={() => setDeal(deal.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>
            ))}
            {picks.map((p, i) => (
              <div className="tm-chip" key={"k" + i}>
                <div><div className="nm">🏀 {p.name}</div><div className="meta">Draft pick</div></div>
                <button className="tm-x" onClick={() => setPicks(picks.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </>
        )}
      </div>

      {team && (
        <>
          <input className="tm-search" placeholder={`Filter ${team} roster…`} value={q} onChange={e => setQ(e.target.value)} />
          <div className="tm-roster">
            {filtered.map(p => {
              const isUsed = used.has(p.name);
              return (
                <div key={p.name} className={"tm-rrow" + (isUsed ? " used" : "")}
                     onClick={() => !isUsed && setDeal([...deal, p])}>
                  <span>{p.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>${p.salary_m}M</span></span>
                  <span className="rv">{p.value}</span>
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 10, color: "var(--muted)", fontSize: 12 }}>No matches.</div>}
          </div>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", margin: "12px 0 4px" }}>
            Tradeable picks {teamObj?.picks?.length ? "" : "(generic)"}
          </div>
          <div className="tm-roster" style={{ maxHeight: 170 }}>
            {availPicks.map((p, i) => (
              <div key={p.name + i} className="tm-rrow" onClick={() => setPicks([...picks, p])}>
                <span>🏀 {p.name}</span>
              </div>
            ))}
            {availPicks.length === 0 && <div style={{ padding: 10, color: "var(--muted)", fontSize: 12 }}>No picks available.</div>}
          </div>
        </>
      )}
    </div>
  );
}

export default function TradeMachine() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamA, setTeamA] = useState("HOU");
  const [teamB, setTeamB] = useState("");
  const [dealA, setDealA] = useState([]);
  const [dealB, setDealB] = useState([]);
  const [picksA, setPicksA] = useState([]);
  const [picksB, setPicksB] = useState([]);
  const [evalRes, setEvalRes] = useState(null);

  useEffect(() => {
    axios.get(`${API}/trade/rosters`)
      .then(r => { setTeams(r.data.teams); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const runEval = useCallback(() => {
    if (!teamA || !teamB || (dealA.length + picksA.length + dealB.length + picksB.length === 0)) {
      setEvalRes(null); return;
    }
    axios.post(`${API}/trade/evaluate`, {
      season: getSeason(),
      a: { team: teamA, players: dealA.map(p => p.name), picks: picksA },
      b: { team: teamB, players: dealB.map(p => p.name), picks: picksB },
    }).then(r => setEvalRes(r.data)).catch(() => setEvalRes(null));
  }, [teamA, teamB, dealA, dealB, picksA, picksB]);

  useEffect(() => { const t = setTimeout(runEval, 250); return () => clearTimeout(t); }, [runEval]);

  if (loading) return <div className="page"><style>{css}</style><div className="loading">Loading rosters…</div></div>;

  const f = evalRes?.fairness;
  const ga = f?.a_gives || 0, gb = f?.b_gives || 0, sum = ga + gb;
  const barA = sum ? (ga / sum) * 100 : 50;

  return (
    <div className="page">
      <style>{css}</style>
      <div className="tm-title">Trade <span>Machine</span></div>
      <div className="tm-sub">Build a deal · check cap legality & value · {seasonLabel()}</div>

      <div className="tm-grid">
        <TeamPanel side="A" teams={teams} team={teamA} setTeam={setTeamA}
                   deal={dealA} setDeal={setDealA} picks={picksA} setPicks={setPicksA} otherTeam={teamB} />
        <TeamPanel side="B" teams={teams} team={teamB} setTeam={setTeamB}
                   deal={dealB} setDeal={setDealB} picks={picksB} setPicks={setPicksB} otherTeam={teamA} />
      </div>

      {evalRes && (
        <div className="tm-eval">
          <span className="tm-legal" style={evalRes.legal
            ? { background: "rgba(74,222,128,0.16)", color: "var(--green)" }
            : { background: "rgba(206,17,65,0.16)", color: "var(--red)" }}>
            {evalRes.legal ? "✓ Cap-legal trade" : "✗ Not cap-legal"}
          </span>

          <div className="tm-capgrid">
            <CapCard side={evalRes.a} color="var(--red)" />
            <CapCard side={evalRes.b} color="#4a9eff" />
          </div>

          {f && f.winner !== undefined && (
            <div className="tm-fair-wrap">
              <div className="tm-fair-labels">
                <span style={{ color: "var(--red)" }}>{evalRes.a.team} gives {ga}</span>
                <span style={{ color: f.verdict.startsWith("Fair") ? "var(--green)" : "var(--gold)" }}>{f.verdict}</span>
                <span style={{ color: "#4a9eff" }}>{evalRes.b.team} gives {gb}</span>
              </div>
              <div className="tm-fair-bar">
                <div className="tm-fair-a" style={{ width: `${barA}%` }} />
                <div className="tm-fair-b" style={{ width: `${100 - barA}%` }} />
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", letterSpacing: 1 }}>
                Premium-adjusted value · Δ {Math.abs(ga - gb).toFixed(1)} ({f.diff_pct}%) - the team giving less value comes out ahead
              </div>
            </div>
          )}
        </div>
      )}

      <div className="tm-note">
        <b>How it works:</b> pick two teams, click players (or picks) into each side's "Sends" box. The engine checks
        each team's <b>apron status</b> and whether it can legally absorb the incoming salary under CBA matching rules,
        shows how the deal moves both payrolls across the cap/tax/apron lines, and weighs the talent with the same
        premium + diminishing-returns model as the Championship Builder. Salaries are from the Spotrac snapshot.
      </div>
    </div>
  );
}
