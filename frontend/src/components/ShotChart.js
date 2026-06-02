import { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

// NBA court dimensions: 500 wide x 470 tall (half court)
// API returns coordinates in tenths of a foot, origin at basket
// x: -250 to 250, y: -50 to 890

const SCALE      = 0.9;
const W          = 500 * SCALE;
const H          = 470 * SCALE;
const toX = x  => (x + 250) * SCALE;
const toY = y  => (420 - y)  * SCALE;  // flip y axis

const css = `
  .shotchart-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 20px; margin-bottom: 36px; }
  .shotchart-controls { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  .sc-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;
    padding: 6px 14px; border-radius: 2px; border: 1px solid var(--border); background: transparent;
    color: var(--muted); cursor: pointer; transition: all 0.15s; }
  .sc-btn:hover { border-color: var(--text); color: var(--text); }
  .sc-btn.active { background: var(--red); border-color: var(--red); color: #fff; }
  .sc-btn.made { background: transparent; border-color: #4ade80; color: #4ade80; }
  .sc-btn.made.active { background: #4ade80; color: #000; }
  .sc-btn.missed { background: transparent; border-color: var(--red); color: var(--red); }
  .sc-btn.missed.active { background: var(--red); color: #fff; }
  .sc-stats { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
  .sc-stat { text-align: center; }
  .sc-stat-val { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 700; }
  .sc-stat-val.red { color: var(--red); }
  .sc-stat-val.gold { color: var(--gold); }
  .sc-stat-lbl { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
  .sc-court-wrap { display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start; }
  .sc-zones { flex: 1; min-width: 200px; }
  .sc-zone-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); }
  .sc-zone-row:last-child { border-bottom: none; }
  .sc-zone-name { font-size: 12px; flex: 1; }
  .sc-zone-bar-wrap { width: 80px; height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; }
  .sc-zone-bar { height: 100%; border-radius: 3px; }
  .sc-zone-pct { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; width: 44px; text-align: right; }
  .sc-zone-att { font-size: 11px; color: var(--muted); width: 36px; text-align: right; }
  .loading-sc { display: flex; align-items: center; justify-content: center; height: 200px; color: var(--muted); font-size: 12px; letter-spacing: 2px; text-transform: uppercase; }
  .sc-legend { display: flex; gap: 16px; margin-top: 8px; }
  .sc-legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); letter-spacing: 1px; }
  .sc-dot-legend { width: 10px; height: 10px; border-radius: 50%; }
`;

function Court({ shots, showMade, showMissed }) {
  const filtered = shots.filter(s => {
    if (showMade && !showMissed) return s.made;
    if (showMissed && !showMade) return !s.made;
    return true;
  });

  return (
    <svg
      width={W}
      height={H}
      style={{ display: "block", maxWidth: "100%" }}
      viewBox={`0 0 ${W} ${H}`}
    >
      {/* Court background */}
      <rect width={W} height={H} fill="#111" rx="4" />

      {/* ── Court lines ── */}
      {/* Outer boundary */}
      <rect x={toX(-250)} y={toY(422.5)} width={500*SCALE} height={422.5*SCALE} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />

      {/* Paint / key */}
      <rect x={toX(-80)} y={toY(190)} width={160*SCALE} height={190*SCALE} fill="rgba(206,17,65,0.04)" stroke="#2a2a2a" strokeWidth="1.5" />

      {/* Free throw circle */}
      <ellipse cx={toX(0)} cy={toY(190)} rx={60*SCALE} ry={60*SCALE} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />

      {/* Basket */}
      <circle cx={toX(0)} cy={toY(0)} r={7.5*SCALE} fill="none" stroke="#555" strokeWidth="1.5" />
      <line x1={toX(-30)} y1={toY(0)} x2={toX(30)} y2={toY(0)} stroke="#444" strokeWidth="1" />

      {/* Backboard */}
      <line x1={toX(-30)} y1={toY(-7.5)} x2={toX(30)} y2={toY(-7.5)} stroke="#555" strokeWidth="2" />

      {/* Three point arc */}
      <path
        d={`M ${toX(-220)} ${toY(0)} L ${toX(-220)} ${toY(87.5)} A ${239*SCALE} ${239*SCALE} 0 0 1 ${toX(220)} ${toY(87.5)} L ${toX(220)} ${toY(0)}`}
        fill="none" stroke="#2a2a2a" strokeWidth="1.5"
      />

      {/* Restricted area arc */}
      <path
        d={`M ${toX(-40)} ${toY(0)} A ${40*SCALE} ${40*SCALE} 0 0 1 ${toX(40)} ${toY(0)}`}
        fill="none" stroke="#2a2a2a" strokeWidth="1.5"
      />

      {/* Mid-court line */}
      <line x1={toX(-250)} y1={toY(422.5)} x2={toX(250)} y2={toY(422.5)} stroke="#1f1f1f" strokeWidth="1" />

      {/* Shot dots */}
      {filtered.map((s, i) => {
        const cx = toX(s.x);
        const cy = toY(s.y);
        if (cx < 0 || cx > W || cy < 0 || cy > H) return null;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={3.5}
            fill={s.made ? "rgba(74,222,128,0.75)" : "rgba(206,17,65,0.55)"}
            stroke={s.made ? "rgba(74,222,128,0.3)" : "rgba(206,17,65,0.2)"}
            strokeWidth="0.5"
          />
        );
      })}
    </svg>
  );
}

export default function ShotChart({ playerId, playerName, seasonType = "Regular Season", live = false }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showMade, setShowMade]       = useState(true);
  const [showMissed, setShowMissed]   = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    // Compare page pulls any NBA player live; profile uses the local Rockets table.
    const url = live ? `${API}/nba/player/${playerId}/shots` : `${API}/shots/${playerId}`;
    axios.get(url, { params: { season_type: seasonType } })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerId, seasonType, live]);

  const fgPct = data && data.total > 0
    ? ((data.made / data.total) * 100).toFixed(1)
    : null;

  const getZoneColor = (pct) => {
    if (pct >= 55) return "#4ade80";
    if (pct >= 45) return "#C4A265";
    if (pct >= 35) return "#f97316";
    return "#CE1141";
  };

  return (
    <>
      <style>{css}</style>
      <div className="shotchart-wrap">
        {live && playerName && (
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>
            {playerName}
          </div>
        )}
        {loading ? (
          <div className="loading-sc">Loading shot chart...</div>
        ) : !data || data.total === 0 ? (
          <div className="loading-sc">No shot data available</div>
        ) : (
          <>
            {/* Stats row */}
            <div className="sc-stats">
              <div className="sc-stat">
                <div className="sc-stat-val red">{data.total}</div>
                <div className="sc-stat-lbl">Attempts</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val" style={{ color: "var(--green)" }}>{data.made}</div>
                <div className="sc-stat-lbl">Made</div>
              </div>
              <div className="sc-stat">
                <div className="sc-stat-val gold">{fgPct}%</div>
                <div className="sc-stat-lbl">FG%</div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="shotchart-controls">
              <button
                className={`sc-btn made ${showMade ? "active" : ""}`}
                onClick={() => setShowMade(v => !v)}
              >
                ● Made
              </button>
              <button
                className={`sc-btn missed ${showMissed ? "active" : ""}`}
                onClick={() => setShowMissed(v => !v)}
              >
                ● Missed
              </button>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", letterSpacing: 1 }}>
                Showing {data.shots.filter(s => {
                  if (showMade && !showMissed) return s.made;
                  if (showMissed && !showMade) return !s.made;
                  return true;
                }).length} shots
              </div>
            </div>

            {/* Court + zones */}
            <div className="sc-court-wrap">
              <div>
                <Court shots={data.shots} showMade={showMade} showMissed={showMissed} />
                <div className="sc-legend">
                  <div className="sc-legend-item">
                    <div className="sc-dot-legend" style={{ background: "#4ade80" }} />Made
                  </div>
                  <div className="sc-legend-item">
                    <div className="sc-dot-legend" style={{ background: "#CE1141" }} />Missed
                  </div>
                </div>
              </div>

              {/* Zone breakdown */}
              <div className="sc-zones">
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
                  Zone Breakdown
                </div>
                {data.zones.map((z, i) => (
                  <div className="sc-zone-row" key={i}>
                    <div className="sc-zone-name">{z.shot_zone}</div>
                    <div className="sc-zone-bar-wrap">
                      <div
                        className="sc-zone-bar"
                        style={{
                          width: `${Math.min(z.pct, 100)}%`,
                          background: getZoneColor(z.pct),
                        }}
                      />
                    </div>
                    <div className="sc-zone-pct" style={{ color: getZoneColor(z.pct) }}>
                      {z.pct}%
                    </div>
                    <div className="sc-zone-att">{z.attempts}x</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
