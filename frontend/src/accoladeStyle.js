// Map an accolade label (e.g. "All-NBA 1st Team", "Defensive POY (8th)") to a
// color tier used for its badge. Shared by Compare and PlayerProfile.
export function accTier(a) {
  if (/\(|votes/i.test(a))  return "tier-hm";       // vote finishes / honorable mention
  if (/1st Team/.test(a))   return "tier-first";
  if (/2nd Team/.test(a))   return "tier-second";
  if (/3rd Team/.test(a))   return "tier-third";
  if (/All-Star/.test(a))   return "tier-allstar";
  return "tier-award";                              // outright award wins (MVP, DPOY, …)
}

// Shared CSS for accolade badges (injected by pages that render them).
export const accoladeCSS = `
  .acc-badge { font-size:9px; letter-spacing:0.5px; text-transform:uppercase; padding:3px 8px; border-radius:2px; font-weight:700; white-space:nowrap; }
  .acc-badge.tier-award  { background:linear-gradient(135deg,#f97316,#fbbf24); color:#000; }
  .acc-badge.tier-first  { background:var(--gold); color:#000; }
  .acc-badge.tier-second { background:#c0c5ce; color:#000; }
  .acc-badge.tier-third  { background:#b08d57; color:#000; }
  .acc-badge.tier-allstar{ background:rgba(74,158,255,0.18); color:#4a9eff; border:1px solid rgba(74,158,255,0.4); }
  .acc-badge.tier-hm     { background:var(--surface2); color:var(--muted); border:1px solid var(--border); }
`;
