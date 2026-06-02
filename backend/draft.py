"""
draft.py — Rockets draft-capital inventory and pick valuation.

Two parts:
  • INVENTORY (ROCKETS_PICKS) — curated from publicly reported draft capital.
    nba_api does NOT expose future pick ownership, so this is hand-maintained and
    meant to be edited as trades happen. Treat it as an approximation.
  • VALUATION (the engine) — scores each pick 0–100 on the same scale as the Trade
    Analyzer (Top 5 ≈ 60, lottery ≈ 46, late 1st ≈ 22, 2nd ≈ 8), from its projected
    draft slot, protection, swap status, and how many years out it is (time discount).
"""

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
