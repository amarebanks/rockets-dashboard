import { useState } from "react";

// A thin tabbed container that groups related pages under one nav item. Each tab
// lazily renders its existing page component (only the active one mounts), so the
// pages keep their own data-fetching and layout unchanged.
const css = `
  .hub-bar { max-width:1200px; margin:0 auto; padding:22px 24px 0; display:flex; gap:8px; flex-wrap:wrap; }
  .hub-tab { font-family:'Barlow Condensed',sans-serif; font-size:13px; letter-spacing:1px; text-transform:uppercase;
    padding:9px 20px; border:1px solid var(--border); border-radius:3px; background:var(--surface); color:var(--muted);
    cursor:pointer; font-weight:700; transition:all .15s; }
  .hub-tab:hover { color:var(--text); border-color:var(--muted); }
  .hub-tab.active { background:var(--red); color:#fff; border-color:var(--red); }
`;

export default function Hub({ tabs }) {
  const [active, setActive] = useState(0);
  return (
    <>
      <style>{css}</style>
      <div className="hub-bar">
        {tabs.map((t, i) => (
          <button key={t.label} className={"hub-tab" + (i === active ? " active" : "")}
                  onClick={() => setActive(i)}>{t.label}</button>
        ))}
      </div>
      {tabs[active].render()}
    </>
  );
}
