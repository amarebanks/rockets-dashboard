"""
draft.py — NBA draft-capital inventory and pick valuation.

Primary source is a SCRAPED snapshot of every team's future pick ownership from
Fanspo (run draft_scraper.py to refresh draft_picks.json). The old hand-curated,
Houston-only ROCKETS_PICKS remains as a fallback for the legacy /draft/assets view.

  • INVENTORY — real per-team incoming (held) / outgoing picks with protections &
    swap rights, loaded from draft_picks.json.
  • VALUATION — scores each pick 0–100 on the Trade-Analyzer scale (1st ≈ 28, 2nd
    ≈ 8) adjusted for protection, swap status, and how many years out it is.
"""

import json
import os

_DIR = os.path.dirname(__file__)
CURRENT_DRAFT_YEAR_FANSPO = 2026   # snapshot season start year

CURRENT_DRAFT_YEAR = 2026

# Projected slot → base trade value (0–100). Steep early decline mirrors the real
# surplus-value curve of draft position.
_SLOT_TABLE = [(1, 72), (3, 64), (5, 58), (9, 48), (14, 40),
               (20, 30), (25, 22), (30, 16), (45, 9), (60, 5)]


def _slot_value(slot):
    for hi, val in _SLOT_TABLE:
        if slot <= hi:
            return val
    return 4


def _tier(slot):
    if slot <= 5:  return "Top 5"
    if slot <= 14: return "Lottery"
    if slot <= 20: return "Mid First"
    if slot <= 30: return "Late First"
    return "Second Round"


def _pick_value(p):
    lo, hi = p["proj_slot"]
    mid = (lo + hi) / 2
    val = _slot_value(mid)
    if p["kind"] == "swap":
        val *= 0.35                       # a swap right is worth a fraction of an outright pick
    if p.get("protection"):
        val *= 0.78                       # protection lowers value to the receiver
    years_out = max(0, p["year"] - CURRENT_DRAFT_YEAR)
    val *= 0.93 ** years_out              # time discount — distant picks are less certain
    return round(val, 1)


# ── Curated inventory (EDIT to match real ownership) ─────────────────────────
# direction: "incoming" = Rockets control it, "outgoing" = Rockets owe it.
# proj_slot: estimated draft range based on the source team's expected strength.
ROCKETS_PICKS = [
    {"year": 2026, "label": "Own 1st",        "via": "HOU", "kind": "first",  "direction": "incoming", "proj_slot": (18, 25)},
    {"year": 2026, "label": "Own 2nd",        "via": "HOU", "kind": "second", "direction": "incoming", "proj_slot": (40, 52)},
    {"year": 2027, "label": "Own 1st",        "via": "HOU", "kind": "first",  "direction": "incoming", "proj_slot": (17, 25)},
    {"year": 2027, "label": "Phoenix 1st",    "via": "PHX", "kind": "first",  "direction": "incoming", "proj_slot": (7, 16)},
    {"year": 2027, "label": "PHX/HOU Swap",   "via": "PHX", "kind": "swap",   "direction": "incoming", "proj_slot": (14, 22)},
    {"year": 2028, "label": "Own 1st",        "via": "HOU", "kind": "first",  "direction": "incoming", "proj_slot": (18, 26)},
    {"year": 2028, "label": "Own 2nd",        "via": "HOU", "kind": "second", "direction": "incoming", "proj_slot": (42, 54)},
    {"year": 2029, "label": "Phoenix 1st",    "via": "PHX", "kind": "first",  "direction": "incoming", "proj_slot": (8, 16)},
    {"year": 2029, "label": "PHX/HOU Swap",   "via": "PHX", "kind": "swap",   "direction": "incoming", "proj_slot": (14, 22)},
    {"year": 2030, "label": "Own 1st",        "via": "HOU", "kind": "first",  "direction": "incoming", "proj_slot": (18, 26)},
    {"year": 2031, "label": "Own 1st",        "via": "HOU", "kind": "first",  "direction": "incoming", "proj_slot": (18, 26)},
]


def get_draft_assets():
    picks = []
    for p in ROCKETS_PICKS:
        lo, hi = p["proj_slot"]
        picks.append({
            **p,
            "value": _pick_value(p),
            "tier": _tier((lo + hi) / 2),
            "proj_range": f"{lo}-{hi}",
        })

    incoming = [p for p in picks if p["direction"] == "incoming"]
    outgoing = [p for p in picks if p["direction"] == "outgoing"]
    total_in  = round(sum(p["value"] for p in incoming), 1)
    total_out = round(sum(p["value"] for p in outgoing), 1)

    # Group by year for the timeline view.
    years = {}
    for p in picks:
        years.setdefault(p["year"], []).append(p)
    by_year = [{"year": y, "picks": years[y], "value": round(sum(x["value"] for x in years[y]), 1)}
               for y in sorted(years)]

    return {
        "current_year": CURRENT_DRAFT_YEAR,
        "picks": picks,
        "by_year": by_year,
        "summary": {
            "first_round": sum(1 for p in incoming if p["kind"] == "first"),
            "swaps":       sum(1 for p in incoming if p["kind"] == "swap"),
            "second_round": sum(1 for p in incoming if p["kind"] == "second"),
            "total_value": round(total_in - total_out, 1),
            "net_capital": round(total_in - total_out, 1),
        },
    }


# ── Real per-team pick ownership (scraped from Fanspo — see draft_scraper.py) ──

def _load_snapshot():
    try:
        with open(os.path.join(_DIR, "draft_picks.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


_SNAP = _load_snapshot()
HAS_PICKS = bool(_SNAP and _SNAP.get("teams"))


def _fanspo_value(p, current_year):
    """0–100 value for a scraped pick, by round + protection/swap + time discount.
    No projected slot is available, so first-rounders use a single mid-first base."""
    rnd = p.get("round") or 2
    base = 28.0 if rnd == 1 else 8.0
    det = (p.get("details") or "").lower()
    if p.get("direction") == "swap":
        base *= 0.45                       # a swap right is worth a fraction of an outright pick
    if "protected" in det:                 # "No protections" won't match ("protections" != "protected")
        base *= 0.82
    yr = p.get("year") or current_year
    base *= 0.94 ** max(0, yr - current_year)
    return round(base, 1)


def _pick_label(p):
    rnd = "1st" if p.get("round") == 1 else "2nd"
    label = f"{p['year']} {rnd}"
    if p.get("direction") == "swap":
        label += " swap"
    elif p.get("from"):
        label += f" (via {p['from']})"
    return label


def get_team_picks(tri, current_year=CURRENT_DRAFT_YEAR_FANSPO):
    """Real incoming (held) / outgoing pick ledger for one team, valued. None if no
    snapshot. `incoming` = picks the team controls (own/acquired/swap rights)."""
    if not _SNAP:
        return None
    t = _SNAP["teams"].get(tri.upper())
    if not t:
        return None
    incoming, outgoing = [], []
    for p in t["picks"]:
        item = {
            "year": p["year"], "round": p["round"], "from": p.get("from", ""),
            "to": p.get("to", ""), "details": p.get("details", ""),
            "label": _pick_label(p), "value": _fanspo_value(p, current_year),
            "kind": "swap" if p["direction"] == "swap" else ("first" if p["round"] == 1 else "second"),
        }
        (outgoing if p["direction"] == "outgoing" else incoming).append(item)
    return {
        "team": tri.upper(),
        "season": _SNAP.get("season"),
        "scraped_at": _SNAP.get("scraped_at"),
        "incoming": incoming,
        "outgoing": outgoing,
        "summary": {
            "first_round_held": sum(1 for p in incoming if p["round"] == 1 and p["kind"] != "swap"),
            "second_round_held": sum(1 for p in incoming if p["round"] == 2 and p["kind"] != "swap"),
            "swaps": sum(1 for p in incoming if p["kind"] == "swap"),
            "outgoing_firsts": sum(1 for p in outgoing if p["round"] == 1),
            "held_value": round(sum(p["value"] for p in incoming), 1),
        },
    }


def tradeable_picks(tri):
    """A team's held picks as [{name, value}] for the Trade Machine's pick selector."""
    data = get_team_picks(tri)
    if not data:
        return []
    picks = [{"name": p["label"], "value": p["value"]} for p in data["incoming"]]
    picks.sort(key=lambda p: p["value"], reverse=True)
    return picks
