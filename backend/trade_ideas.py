"""
trade_ideas.py — suggests realistic trades to push the Rockets toward a title.

Pipeline:
  1. Pull league-wide player stats (Base + Advanced) and team rankings once.
  2. Diagnose Houston's needs from where they rank poorly.
  3. Score every non-Rocket on a fast trade-value proxy + how well they fit needs.
  4. For the best fits, assemble a value-matched Rockets package (players + picks),
     reusing the star-premium + diminishing-returns model from the trade analyzer.
  5. Rank and return the top ideas with a plain-language rationale.

Fit-only for now — no salary/cap matching (that needs contract data). Results are
cached in-process since a completed season's data doesn't change.
"""

import time
from nba_api.stats.endpoints import leaguedashplayerstats, leaguedashteamstats
import recognition

ROCKETS_ID = 1610612745

# Acquisition model — identical in spirit to the frontend trade analyzer.
DECAY = 0.85
def premium_mult(value):
    if value >= 96: return 1.60
    if value >= 90: return 1.45
    if value >= 85: return 1.30
    if value >= 78: return 1.18
    if value >= 70: return 1.10
    return 1.0

# Draft capital used to close value gaps in a package.
PICKS = [("2026 First-Round Pick", 30), ("2028 First-Round Pick", 27), ("Future Second-Rounder", 8)]

# Need categories → which team-ranking fields signal weakness there.
NEED_FIELDS = {
    "3PT Shooting":       ["FG3_PCT_RANK"],
    "Playmaking":         ["AST_RANK"],
    "Perimeter Defense":  ["STL_RANK", "DEF_RATING_RANK"],
    "Rim Protection":     ["BLK_RANK", "DEF_RATING_RANK"],
    "Rebounding":         ["REB_RANK"],
    "Shot Creation":      ["OFF_RATING_RANK"],
}

_CACHE = {"data": None, "built_at": 0.0, "season": None}
_TTL = 6 * 60 * 60


def _clamp(x):
    return max(0.0, min(1.0, x))


def _f(row, col, default=0.0):
    try:
        v = float(row.get(col))
        return default if v != v else v  # NaN guard
    except (TypeError, ValueError):
        return default


def _age_score(age):
    if not age:        return 80
    if age <= 24:      return 95
    if age <= 27:      return 100
    if age == 28:      return 95
    if age == 29:      return 88
    if age == 30:      return 80
    if age <= 32:      return 70
    if age <= 34:      return 55
    return 40


def _proxy_value(s):
    """Fast 0–100 trade value from bulk league stats (no per-player API calls)."""
    name = s["name"]
    pts_s = min(s["pts"] / 28 * 100, 100)
    reb_s = min(s["reb"] / 12 * 100, 100)
    ast_s = min(s["ast"] / 9  * 100, 100)
    drtg_comp = min(max((113 - s["def_rtg"]) / 6 * 50 + 50, 0), 100)
    def_s = (min(s["stl"] / 2 * 100, 100) + min(s["blk"] / 2 * 100, 100)) / 2 * 0.20 + drtg_comp * 0.80
    pm_s  = min(max((s["plus_minus"] + 5) / 10 * 100, 0), 100)
    ts_s  = min(max((s["ts_pct"]  - 0.45) / 0.20 * 100, 0), 100)
    usg_s = min(max((s["usg_pct"] - 0.15) / 0.20 * 100, 0), 100)
    gp_s  = min(s["gp"] / 70 * 100, 100)
    age_s = _age_score(s["age"])

    corner = recognition.is_cornerstone(name)
    star   = corner or recognition.is_allstar(name)
    recog  = 100 if corner else (75 if star else 0)

    raw = (pts_s * 0.12 + reb_s * 0.05 + ast_s * 0.05 + def_s * 0.08 + pm_s * 0.05 +
           ts_s * 0.08 + usg_s * 0.04 + gp_s * 0.06 + age_s * 0.08 +
           recog * 0.30 + 60 * 0.09)
    if not corner and star:
        raw = max(raw, 68)
    if corner:
        raw = max(raw, 97)
    return round(min(raw, 100), 1), corner, star


def _category_strengths(s):
    """How strong a player is in each need category, 0–1."""
    vol3 = _clamp(s["fg3a"] / 4.0)
    shooting = _clamp((s["fg3_pct"] - 0.30) / 0.12) * (0.4 + 0.6 * vol3)
    playmaking = _clamp(s["ast"] / 8.0)
    drtg_q = _clamp((113 - s["def_rtg"]) / 8.0)
    perim_d = (_clamp(s["stl"] / 1.8) + drtg_q) / 2
    rim_d   = (_clamp(s["blk"] / 1.8) + drtg_q) / 2
    rebounding = _clamp(s["reb"] / 10.0)
    scoring = (_clamp(s["pts"] / 25.0) + _clamp((s["usg_pct"] - 0.15) / 0.15)) / 2
    return {
        "3PT Shooting": shooting,
        "Playmaking": playmaking,
        "Perimeter Defense": perim_d,
        "Rim Protection": rim_d,
        "Rebounding": rebounding,
        "Shot Creation": scoring,
    }


def _adjusted(items):
    """Premium-adjusted, diminishing-returns value of a package."""
    vals = sorted(
        [(premium_mult(i["value"]) * i["value"]) if i["type"] == "player" else i["value"]
         for i in items],
        reverse=True,
    )
    return sum(v * (DECAY ** idx) for idx, v in enumerate(vals))


def _build_package(target_value, rockets):
    """Assemble Rockets outgoing assets to meet a target's acquisition cost.
    Best-fit: at each step add the asset (player or pick) that lands the package
    closest to cost, so we don't stack two stars when one player + a pick fits."""
    cost = target_value * premium_mult(target_value)
    pool_sorted = sorted(rockets, key=lambda p: p["value"], reverse=True)
    protected = pool_sorted[0]["name"] if pool_sorted else None   # keep the centerpiece

    pool = [{"name": p["name"], "value": p["value"], "type": "player"} for p in pool_sorted[1:]]
    pool += [{"name": nm, "value": v, "type": "pick"} for nm, v in PICKS]

    chosen, used = [], set()
    while _adjusted(chosen) < cost * 0.92 and len(chosen) < 4:
        best_i, best_key = None, None
        for i, a in enumerate(pool):
            if i in used:
                continue
            key = abs(_adjusted(chosen + [a]) - cost)
            if best_key is None or key < best_key:
                best_i, best_key = i, key
        if best_i is None:
            break
        chosen.append(pool[best_i])
        used.add(best_i)

    # Remove any asset that brings the package closer to cost by leaving (trims overpay).
    improved = True
    while improved and len(chosen) > 1:
        improved = False
        base = abs(_adjusted(chosen) - cost)
        for k in range(len(chosen)):
            trial = chosen[:k] + chosen[k+1:]
            if _adjusted(trial) >= cost * 0.82 and abs(_adjusted(trial) - cost) < base:
                chosen = trial
                improved = True
                break

    out_value = round(_adjusted(chosen), 1)
    diff_pct = round((out_value - cost) / cost * 100, 1) if cost else 0
    if diff_pct >= 12:    verdict = "Rockets overpay"
    elif diff_pct <= -12: verdict = "Package falls short"
    else:                 verdict = "Fair value"
    return chosen, out_value, round(cost, 1), verdict, diff_pct, protected


def _fetch_players(season):
    base = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Base", per_mode_detailed="PerGame",
    ).get_data_frames()[0]
    time.sleep(0.6)
    adv = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Advanced", per_mode_detailed="PerGame",
    ).get_data_frames()[0]

    adv_by_id = {int(r["PLAYER_ID"]): r for _, r in adv.iterrows()}
    players = []
    for _, b in base.iterrows():
        pid = int(b["PLAYER_ID"])
        a = adv_by_id.get(pid, {})
        players.append({
            "player_id": pid,
            "name":      b["PLAYER_NAME"],
            "team_id":   int(b["TEAM_ID"]),
            "team":      b.get("TEAM_ABBREVIATION", ""),
            "age":       _f(b, "AGE"),
            "gp":        _f(b, "GP"),
            "min":       _f(b, "MIN"),
            "pts":       _f(b, "PTS"),
            "reb":       _f(b, "REB"),
            "ast":       _f(b, "AST"),
            "stl":       _f(b, "STL"),
            "blk":       _f(b, "BLK"),
            "tov":       _f(b, "TOV"),
            "fg3m":      _f(b, "FG3M"),
            "fg3a":      _f(b, "FG3A"),
            "fg3_pct":   _f(b, "FG3_PCT"),
            "plus_minus": _f(b, "PLUS_MINUS"),
            "ts_pct":    _f(a, "TS_PCT", 0.55),
            "usg_pct":   _f(a, "USG_PCT", 0.20),
            "def_rtg":   _f(a, "DEF_RATING", 113),
        })
    return players


def _fetch_needs(season):
    """Rockets' weakness weight (0–1) per need category from team rankings."""
    base = leaguedashteamstats.LeagueDashTeamStats(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Base", per_mode_detailed="PerGame",
    ).get_data_frames()[0]
    time.sleep(0.6)
    adv = leaguedashteamstats.LeagueDashTeamStats(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Advanced", per_mode_detailed="PerGame",
    ).get_data_frames()[0]

    brow = base[base["TEAM_ID"] == ROCKETS_ID]
    arow = adv[adv["TEAM_ID"] == ROCKETS_ID]
    ranks = {}
    if not brow.empty:
        for c in ["FG3_PCT_RANK", "AST_RANK", "STL_RANK", "BLK_RANK", "REB_RANK", "PTS_RANK"]:
            if c in brow.columns:
                ranks[c] = int(brow[c].iloc[0])
    if not arow.empty:
        for c in ["DEF_RATING_RANK", "OFF_RATING_RANK"]:
            if c in arow.columns:
                ranks[c] = int(arow[c].iloc[0])

    needs = {}
    for cat, fields in NEED_FIELDS.items():
        vals = [ranks[f] for f in fields if f in ranks]
        if not vals:
            continue
        avg_rank = sum(vals) / len(vals)
        needs[cat] = {"rank": round(avg_rank), "weight": round(avg_rank / 30.0, 3)}
    return needs


def _build(season):
    players = _fetch_players(season)
    needs = _fetch_needs(season)
    total_w = sum(n["weight"] for n in needs.values()) or 1.0

    rockets, candidates = [], []
    for s in players:
        value, corner, star = _proxy_value(s)
        strengths = _category_strengths(s)
        entry = {**s, "value": value, "is_cornerstone": corner, "is_allstar": star,
                 "strengths": strengths}
        if s["team_id"] == ROCKETS_ID:
            rockets.append(entry)
        else:
            candidates.append(entry)

    # Score each non-Rocket on fit to Houston's needs.
    scored = []
    for c in candidates:
        if c["gp"] < 30 or c["min"] < 20 or c["is_cornerstone"] or c["value"] < 55:
            continue
        fit = sum(c["strengths"][cat] * needs[cat]["weight"] for cat in needs) / total_w
        addresses = [cat for cat in needs
                     if c["strengths"][cat] >= 0.55 and needs[cat]["weight"] >= 0.55]
        c["fit"] = round(fit * 100, 1)
        c["addresses"] = addresses
        scored.append(c)

    # Rank by a blend of need-fit and raw value (championship swing).
    scored.sort(key=lambda c: c["fit"] * 0.6 + c["value"] * 0.4, reverse=True)

    rockets_min = [{"name": r["name"], "value": r["value"]} for r in rockets]
    ideas = []
    for c in scored[:10]:
        if not c["addresses"]:
            continue
        gives, out_value, cost, verdict, diff_pct, protected = _build_package(c["value"], rockets)
        top_need = c["addresses"][0]
        need_rank = needs[top_need]["rank"]
        rationale = (
            f"Houston ranks {_ordinal(need_rank)} in {top_need.lower()}. "
            f"{c['name']} ({_stat_line(c, top_need)}) directly upgrades it"
            + (f", and also helps with {', '.join(a.lower() for a in c['addresses'][1:])}." if len(c["addresses"]) > 1 else ".")
        )
        ideas.append({
            "target": {
                "player_id": c["player_id"], "name": c["name"], "team": c["team"],
                "value": c["value"], "fit": c["fit"], "is_allstar": c["is_allstar"],
                "addresses": c["addresses"],
                "stats": {"pts": round(c["pts"],1), "reb": round(c["reb"],1), "ast": round(c["ast"],1),
                          "fg3_pct": round(c["fg3_pct"]*100,1), "stl": round(c["stl"],1),
                          "blk": round(c["blk"],1), "usg_pct": round(c["usg_pct"]*100,1)},
            },
            "gives": gives,
            "out_value": out_value,
            "cost": cost,
            "fairness": {"verdict": verdict, "diff_pct": diff_pct},
            "protected": protected,
            "rationale": rationale,
        })
        if len(ideas) >= 6:
            break

    needs_sorted = sorted(
        [{"category": k, **v} for k, v in needs.items()],
        key=lambda n: n["weight"], reverse=True,
    )
    return {
        "season": season,
        "needs": needs_sorted,
        "rockets_core": sorted(rockets_min, key=lambda r: r["value"], reverse=True)[:5],
        "ideas": ideas,
    }


def _ordinal(n):
    if 10 <= n % 100 <= 20:
        suf = "th"
    else:
        suf = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suf}"


def _stat_line(c, need):
    if need == "3PT Shooting":      return f"{c['fg3_pct']*100:.1f}% on {c['fg3a']:.1f} 3PA"
    if need == "Playmaking":        return f"{c['ast']:.1f} AST"
    if need == "Rebounding":        return f"{c['reb']:.1f} REB"
    if need == "Rim Protection":    return f"{c['blk']:.1f} BLK"
    if need == "Perimeter Defense": return f"{c['stl']:.1f} STL"
    return f"{c['pts']:.1f} PPG"


def get_trade_ideas(season, force=False):
    now = time.time()
    if (force or _CACHE["data"] is None or _CACHE["season"] != season
            or now - _CACHE["built_at"] > _TTL):
        _CACHE["data"] = _build(season)
        _CACHE["built_at"] = now
        _CACHE["season"] = season
    return _CACHE["data"]
