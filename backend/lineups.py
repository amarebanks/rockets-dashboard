"""
lineups.py - Houston's lineup net ratings (which player combinations actually work).

Pulls advanced lineup data (off/def/net rating per combo) from nba_api for a given
group size (2-, 3-, or 5-man). Filters out tiny samples, returns the best and worst
combinations. Pairs with the Championship Builder: before trading, see which existing
groups already produce. Cached in-process per (season, size).
"""

import time
from nba_api.stats.endpoints import leaguedashlineups

ROCKETS_ID = 1610612745
MIN_MINUTES = {2: 80, 3: 50, 5: 30}   # sample-size floor by group size

_CACHE = {}   # (season, size) -> {"data":..., "built_at":...}
_TTL = 6 * 60 * 60


def _f(row, col, default=0.0):
    try:
        v = float(row.get(col))
        return default if v != v else v
    except (TypeError, ValueError):
        return default


def _clean_name(group_name):
    # "F. VanVleet - D. Brooks - ..." -> "VanVleet · Brooks · ..."
    parts = [p.strip() for p in str(group_name).split(" - ")]
    out = []
    for p in parts:
        out.append(p.split(". ", 1)[1] if ". " in p else p)
    return " · ".join(out)


def _build(season, size):
    df = leaguedashlineups.LeagueDashLineups(
        season=season, season_type_all_star="Regular Season",
        team_id_nullable=ROCKETS_ID, group_quantity=size,
        measure_type_detailed_defense="Advanced", per_mode_detailed="Totals",
    ).get_data_frames()[0]

    floor = MIN_MINUTES.get(size, 30)
    rows = []
    for _, r in df.iterrows():
        mins = _f(r, "MIN")
        if mins < floor:
            continue
        rows.append({
            "lineup": _clean_name(r.get("GROUP_NAME", "")),
            "gp": int(_f(r, "GP")),
            "min": round(mins, 0),
            "off_rating": round(_f(r, "OFF_RATING"), 1),
            "def_rating": round(_f(r, "DEF_RATING"), 1),
            "net_rating": round(_f(r, "NET_RATING"), 1),
        })
    rows.sort(key=lambda x: x["net_rating"], reverse=True)
    return {
        "season": season, "size": size,
        "count": len(rows),
        "best": rows[:8],
        "worst": rows[-5:][::-1] if len(rows) > 8 else [],
    }


def get_lineups(season, size=5, force=False):
    size = size if size in (2, 3, 5) else 5
    key = (season, size)
    now = time.time()
    entry = _CACHE.get(key)
    if force or entry is None or now - entry["built_at"] > _TTL:
        _CACHE[key] = {"data": _build(season, size), "built_at": now}
    return _CACHE[key]["data"]
