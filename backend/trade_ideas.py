"""
trade_ideas.py — suggests realistic trades to push the Rockets toward a title.

Pipeline:
  1. Pull league-wide player stats (Base + Advanced) and team rankings once.
  2. Diagnose Houston's needs from where they rank poorly.
  3. Model each non-Rocket's TRADE AVAILABILITY — would his team actually move him?
     (team record → seller vs contender, his role on the team, age vs timeline,
     star tier). Contenders don't sell stars; rebuilders shop veterans.
  4. Score every realistic target on need-fit + value + availability.
  5. Assemble a value-matched Rockets package TAILORED to the seller's wants
     (rebuilders want youth + picks; contenders want win-now vets), reusing the
     star-premium + diminishing-returns model from the trade analyzer.
  6. Rank and return the top ideas with a plain-language rationale that explains
     both Houston's need and why the other team would say yes.

Fit-only for now — no salary/cap matching (that needs contract data). Results are
cached in-process since a completed season's data doesn't change.
"""

import time
from nba_api.stats.endpoints import leaguedashplayerstats, leaguedashteamstats
import recognition
import contracts

ROCKETS_ID = 1610612745
ROCKETS_ABBR = "HOU"

# Houston's genuine cornerstones per season — kept out of every package. Everyone else,
# including up-and-coming players (Jabari Smith Jr., Reed Sheppard, Tari Eason), is a
# realistic trade chip; landing a proven star means parting with young talent + picks.
# 2025-26 adds Kevin Durant, acquired that offseason and now the on-court centerpiece.
UNTOUCHABLE_BY_SEASON = {
    "2024-25": {"Alperen Sengun", "Amen Thompson"},
    "2025-26": {"Kevin Durant", "Alperen Sengun", "Amen Thompson"},
}
DEFAULT_UNTOUCHABLE = {"Alperen Sengun", "Amen Thompson"}

# Offensive-hub centers. Houston's centerpiece (Şengün) is one, so acquiring another
# high-usage center is a poor positional fit — two paint-based hubs don't share the
# floor. Such targets are skipped (the only way it works is dealing Şengün, but he's
# untouchable). Low-usage rim-protector centers are NOT here — they complement Şengün.
CENTERS = {
    "Joel Embiid", "Nikola Jokic", "Domantas Sabonis", "Karl-Anthony Towns",
    "Nikola Vucevic", "Bam Adebayo", "Alperen Sengun", "Jonas Valanciunas",
    "Deandre Ayton", "Jusuf Nurkic", "Jarrett Allen", "Myles Turner",
    "Evan Mobley", "Jalen Duren", "Jakob Poeltl", "Nikola Vucevic",
}
CENTER_ANCHORS = {"Alperen Sengun"}   # Houston's offensive-hub center


def _untouchable(season):
    return UNTOUCHABLE_BY_SEASON.get(season, DEFAULT_UNTOUCHABLE)


_CENTERS_NORM = {recognition.norm_name(n) for n in CENTERS}
_CENTER_ANCHORS_NORM = {recognition.norm_name(n) for n in CENTER_ANCHORS}


def _redundant_center(c, season):
    """True if the target is an offensive-hub center while Houston's untouchable
    centerpiece is also one — a poor positional fit (can't pair two paint hubs)."""
    core_has_center = any(recognition.norm_name(n) in _CENTER_ANCHORS_NORM
                          for n in _untouchable(season))
    return (core_has_center
            and recognition.norm_name(c["name"]) in _CENTERS_NORM
            and c.get("usg_pct", 0) >= 0.23)

# Acquisition model — identical in spirit to the frontend trade analyzer.
# Higher DECAY pressure + steeper premiums mean stars cost a genuine haul: their
# acquisition price far exceeds their flat value, so it takes several pieces + picks.
DECAY = 0.82
def premium_mult(value):
    if value >= 96: return 1.85
    if value >= 90: return 1.65
    if value >= 85: return 1.45
    if value >= 78: return 1.25
    if value >= 70: return 1.14
    if value >= 60: return 1.07
    return 1.0

# Rockets draft war chest used to close value gaps — multiple firsts/swaps + seconds,
# so a superstar package is realistically pick-heavy, not just a single second-rounder.
PICKS = [
    ("2027 First-Round Pick", 30),
    ("2029 First-Round Pick", 28),
    ("2031 First-Round Pick", 26),
    ("2028 First-Round Swap", 12),
    ("2026 Second-Rounder", 8),
    ("2030 Second-Rounder", 7),
]

# Need categories → which team-ranking fields signal weakness there.
NEED_FIELDS = {
    "3PT Shooting":       ["FG3_PCT_RANK"],
    "Playmaking":         ["AST_RANK"],
    "Perimeter Defense":  ["STL_RANK", "DEF_RATING_RANK"],
    "Rim Protection":     ["BLK_RANK", "DEF_RATING_RANK"],
    "Rebounding":         ["REB_RANK"],
    "Shot Creation":      ["OFF_RATING_RANK"],
}

# Below this availability score a player is treated as effectively untouchable.
AVAIL_FLOOR = 0.32

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


def _proxy_value(s, season=None):
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

    corner = recognition.is_cornerstone(name, season)
    star   = corner or recognition.is_allstar(name, season)
    recog  = 100 if corner else (75 if star else 0)
    def_recog = recognition.defensive_recognition(name, season)  # All-Defensive / DPOY votes

    # Defense now carries more weight (def_s 0.08→0.11 + a 0.06 defensive-recognition
    # term), pulled from the flat baseline and a slightly trimmed star-recognition weight,
    # so elite, award-level defenders (e.g. Amen Thompson) aren't valued like role players.
    raw = (pts_s * 0.12 + reb_s * 0.05 + ast_s * 0.05 + def_s * 0.11 + pm_s * 0.05 +
           ts_s * 0.08 + usg_s * 0.04 + gp_s * 0.06 + age_s * 0.08 +
           recog * 0.25 + def_recog * 0.06 + 60 * 0.05)
    # Reputation-tier floor: All-NBA 1st/2nd/3rd, legacy superstar, or All-Star — so
    # name-brand stars (Giannis, Embiid) aren't valued like role players in a down year.
    raw = max(raw, recognition.star_floor(name, season))
    # Quality-starter floor: an efficient, high-usage 18+ ppg full-time starter is worth
    # more than a role player even without an All-Star nod (e.g. Austin Reaves). Graduated
    # by scoring so a 24-ppg lead guard outvalues an 18-ppg one (avoids flattening).
    if s["pts"] >= 18 and s["usg_pct"] >= 0.22 and s["ts_pct"] >= 0.55 and s["gp"] >= 55:
        raw = max(raw, min(72, 52 + (s["pts"] - 18) * 2.0))
    # Floors for elite defenders who may not be All-Stars (recognition-driven).
    if def_recog >= 100:
        raw = max(raw, 70)   # All-Defensive 1st team
    elif def_recog >= 78:
        raw = max(raw, 64)   # All-Defensive 2nd team
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


# ---------------------------------------------------------------------------
# Trade-availability model — the heart of the realism fix.
# ---------------------------------------------------------------------------

def _team_tier(w_pct):
    """Classify a team as a seller, middle, or contender from win pct."""
    if w_pct >= 0.600: return "contender"
    if w_pct >= 0.450: return "middle"
    return "seller"


def _availability(c, tier, team_rank):
    """Probability-ish 0–1 that a player is realistically tradeable.

    Driven by the reality of the trade market:
      • Contenders don't move their core; rebuilders shop everyone, esp. veterans.
      • A team's #1 option is far harder to pry loose than its 3rd/4th piece.
      • Stars are rarely available, and never from a contender.
      • Young building blocks on a rebuild are kept; aging vets on a rebuild are bait.
    """
    base = {"seller": 0.82, "middle": 0.60, "contender": 0.36}[tier]

    # Role on their own team — the best player is the hardest to get.
    if team_rank == 1:   base *= 0.62
    elif team_rank == 2: base *= 0.85
    elif team_rank >= 4: base *= 1.12

    # Star tier rarely changes teams.
    if c["is_allstar"]:
        base *= 0.55

    # Age vs the selling team's timeline.
    age = c["age"]
    if tier == "seller":
        if age >= 29:   base *= 1.30   # veteran on a tanking team — prime trade bait
        elif age <= 22: base *= 0.55   # cornerstone-of-the-future, they keep him
    elif tier == "contender":
        if c["value"] >= 80:           # contenders only deal role players
            base *= 0.40

    return round(_clamp(base), 3)


def _avail_label(a):
    if a >= 0.60: return "Likely available"
    if a >= 0.42: return "Possible"
    return "Long shot"


# ---------------------------------------------------------------------------
# Package construction — now tailored to what the SELLING team wants back.
# ---------------------------------------------------------------------------

def _return_pref(tier):
    """What the selling team values most in a return package."""
    if tier == "seller":    return "youth_picks"   # rebuild: young players + draft capital
    if tier == "contender": return "win_now"       # win-now: proven vets, picks discounted
    return "balanced"


def _pref_bonus(asset, prefer):
    """Small value-equivalent nudge so equally-priced assets that match the
    seller's wants get chosen. Keeps value-matching primary, composition realistic."""
    if prefer == "youth_picks":
        if asset["type"] == "pick": return 2.0
        if asset.get("age") and asset["age"] <= 25: return 1.5
        return 0.0
    if prefer == "win_now":
        if asset["type"] == "pick": return -2.0    # contenders discount future picks
        if asset.get("age") and asset["age"] >= 27: return 1.0
        return 0.0
    return 0.0


def _adjusted(items):
    """Premium-adjusted, diminishing-returns value of a package."""
    vals = sorted(
        [(premium_mult(i["value"]) * i["value"]) if i["type"] == "player" else i["value"]
         for i in items],
        reverse=True,
    )
    return sum(v * (DECAY ** idx) for idx, v in enumerate(vals))


def _build_package(target_value, rockets, prefer="balanced", star=False, season=None,
                   target_salary=0):
    """Assemble a realistic Rockets package for a target's acquisition cost.

    Mirrors how real deals are shaped: an up-and-coming player (or two) headlines,
    complementary salary/young pieces fill the gap, and pick compensation is almost
    always attached — not a one-for-one swap. Only Houston's cornerstones are
    off-limits; everyone else (Jabari Smith Jr., Reed Sheppard, Tari Eason…) is fair game.

    After value-matching, the package is checked for CBA legality: Houston must send
    enough salary to legally absorb the target. If it's short, salary FILLER (an
    expendable contract, bad deals first) is added so the trade is cap-legal.
    """
    cost = target_value * premium_mult(target_value)
    untouchable = {recognition.norm_name(n) for n in _untouchable(season)}
    ranked = sorted(rockets, key=lambda p: p["value"], reverse=True)
    core = [p["name"] for p in ranked if recognition.norm_name(p["name"]) in untouchable]
    protected = ", ".join(core) if core else (ranked[0]["name"] if ranked else None)

    players = [{"name": p["name"], "value": p["value"], "type": "player", "age": p.get("age"),
                "salary": p.get("salary") or contracts.get_salary(p["name"], season, p["value"]),
                "dumpable": p.get("contract", {}).get("dumpable", False)}
               for p in ranked if recognition.norm_name(p["name"]) not in untouchable]
    picks = [{"name": nm, "value": v, "type": "pick"} for nm, v in PICKS]   # value-desc

    chosen, used = [], set()

    # 1) Headliner — the best chip that sits at/just below the target, so Houston
    #    sends an up-and-coming player for the more proven one (not its very best).
    #    Reserve the single best young chip only when the target is worth *less* than it
    #    (don't trade your prized prospect for a lesser player) — varies the packages.
    skip_top = (not star and len(players) > 1 and players[0]["value"] > target_value)
    start = 1 if skip_top else 0
    head_idx = next((i for i in range(start, len(players))
                     if players[i]["value"] <= target_value * 0.97),
                    len(players) - 1 if players else None)
    if head_idx is not None:
        chosen.append(players[head_idx]); used.add(head_idx)

    # Cap at two players so a big star cost is covered by draft capital (multiple
    # first-rounders), the way real superstar trades are structured — not 3-4 prospects.
    player_cap = 2

    # 2) Complementary player — only add a second player when the headliner leaves a
    #    real gap (else a single player + picks is the tighter, more realistic package).
    while (sum(1 for c in chosen if c["type"] == "player") < player_cap
           and _adjusted(chosen) < cost * 0.80):
        best_i, best_key = None, None
        for i, a in enumerate(players):
            if i in used:
                continue
            trial = _adjusted(chosen + [a])
            if trial > cost * 1.12:
                continue
            key = abs(trial - cost) - _pref_bonus(a, prefer)
            if best_key is None or key < best_key:
                best_i, best_key = i, key
        if best_i is None:
            break
        chosen.append(players[best_i]); used.add(best_i)

    # 3) Pick compensation — fill the gap largest-first, so a big star shortfall pulls
    #    in multiple first-round picks while a minor gap only takes a second-rounder.
    #    Never overshoot the fair band.
    for pk in sorted(picks, key=lambda p: p["value"], reverse=True):
        if _adjusted(chosen) >= cost * 0.92:
            break
        if _adjusted(chosen + [pk]) <= cost * 1.08:
            chosen.append(pk)
    # Almost every real deal carries pick compensation — attach the smallest pick when
    # there isn't one yet, but only if it doesn't tip an already-fair package into overpay.
    if not any(c["type"] == "pick" for c in chosen) and picks:
        sweetener = picks[-1]   # smallest
        if _adjusted(chosen + [sweetener]) <= cost * 1.10:
            chosen.append(sweetener)

    # 4) Still short of fair value? allow one more young piece beyond the soft cap.
    for i, a in enumerate(players):
        if _adjusted(chosen) >= cost * 0.88:
            break
        if i not in used:
            chosen.append(a); used.add(i)

    # 5) Trim the smallest extra pick if we overshoot and still land fairly (keep ≥1 pick).
    improved = True
    while improved:
        improved = False
        pick_idxs = [k for k, c in enumerate(chosen) if c["type"] == "pick"]
        if len(pick_idxs) < 2 or _adjusted(chosen) - cost <= cost * 0.05:
            break
        k = min(pick_idxs, key=lambda i: chosen[i]["value"])
        trial = chosen[:k] + chosen[k+1:]
        if _adjusted(trial) >= cost * 0.90:
            chosen = trial; improved = True

    out_value = round(_adjusted(chosen), 1)
    diff_pct = round((out_value - cost) / cost * 100, 1) if cost else 0
    if diff_pct >= 12:    verdict = "Rockets overpay"
    elif diff_pct <= -12: verdict = "Package falls short"
    else:                 verdict = "Fair value"

    # ── Cap-legal salary matching ────────────────────────────────────────────
    # Houston must send enough salary to legally take the target back. If the
    # value-matched package is short on salary, add filler contracts (bad/dumpable
    # deals first, then largest) until it's legal — exactly how real deals attach
    # a matching salary to a young-talent + picks core.
    status = contracts.team_apron_status(ROCKETS_ABBR, season)

    def _pkg_salary(items):
        return sum(i.get("salary", 0) for i in items if i["type"] == "player")

    out_salary = _pkg_salary(chosen)
    legal, allowed, shortfall = contracts.trade_legal(out_salary, target_salary, status)
    if not legal:
        filler = [i for i, p in enumerate(players) if i not in used]
        # Worst contracts first (cap relief for Houston too), then biggest salary —
        # but prefer ones that add the least extra VALUE so we don't lard the deal.
        filler.sort(key=lambda i: (not players[i]["dumpable"], players[i]["value"], -players[i]["salary"]))
        for i in filler:
            if legal:
                break
            f = dict(players[i]); f["filler"] = True
            chosen.append(f); used.add(i)
            out_salary = _pkg_salary(chosen)
            legal, allowed, shortfall = contracts.trade_legal(out_salary, target_salary, status)
        out_value = round(_adjusted(chosen), 1)
        diff_pct = round((out_value - cost) / cost * 100, 1) if cost else 0

    salary_info = {
        "out": out_salary, "out_m": round(out_salary / 1_000_000, 1),
        "in": target_salary, "in_m": round(target_salary / 1_000_000, 1),
        "allowed_m": round(allowed / 1_000_000, 1),
        "houston_status": status,
        "legal": legal,
        "note": (
            "Salary-legal as constructed."
            if legal else
            f"Needs ~${round(shortfall/1_000_000,1)}M more outgoing salary to be legal "
            f"(Houston is a {status.replace('_',' ')} team)."
        ),
    }

    # Display order: players (by value, desc) first, then picks (by value, desc).
    chosen.sort(key=lambda a: (a["type"] != "player", -a["value"]))
    clean = []
    for a in chosen:
        row = {k: v for k, v in a.items() if k not in ("age", "dumpable")}
        if a["type"] == "player":
            row["salary_m"] = round(a.get("salary", 0) / 1_000_000, 1)
        clean.append(row)
    return clean, out_value, round(cost, 1), verdict, diff_pct, protected, salary_info


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


def _fetch_team_data(season):
    """Returns (needs, team_ctx).
      needs    — Rockets' weakness weight (0–1) per category from team rankings.
      team_ctx — team_id → {w, l, w_pct, tier, team} for the availability model.
    """
    base = leaguedashteamstats.LeagueDashTeamStats(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Base", per_mode_detailed="PerGame",
    ).get_data_frames()[0]
    time.sleep(0.6)
    adv = leaguedashteamstats.LeagueDashTeamStats(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Advanced", per_mode_detailed="PerGame",
    ).get_data_frames()[0]

    team_ctx = {}
    for _, r in base.iterrows():
        tid = int(r["TEAM_ID"])
        w_pct = _f(r, "W_PCT")
        team_ctx[tid] = {
            "w":     int(_f(r, "W")),
            "l":     int(_f(r, "L")),
            "w_pct": w_pct,
            "tier":  _team_tier(w_pct),
            "team":  r.get("TEAM_ABBREVIATION", ""),
        }

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
    return needs, team_ctx


def _build(season):
    players = _fetch_players(season)
    needs, team_ctx = _fetch_team_data(season)
    total_w = sum(n["weight"] for n in needs.values()) or 1.0

    # First pass: on-court value everyone, and rank players within their own team
    # (rotation only) by that pure value, so team-role is unaffected by contracts.
    for s in players:
        base, corner, star = _proxy_value(s, season)
        s["base_value"] = base
        s["value"] = base
        s["is_cornerstone"], s["is_allstar"] = corner, star
    rotation = [s for s in players if s["min"] >= 20 and s["gp"] >= 20]
    team_order = {}
    for s in sorted(rotation, key=lambda p: p["base_value"], reverse=True):
        team_order.setdefault(s["team_id"], []).append(s["player_id"])

    # Contract pass: a player's TRADE value reflects his deal — a bargain is a
    # bonus asset, a bad contract a drag teams pay to escape. Salary is attached
    # for the cap-legal matching done when building packages.
    for s in players:
        g = contracts.contract_grade(s["name"], s["base_value"], season)
        s["contract"] = g
        s["salary"] = g["salary"]
        s["value"] = round(min(100.0, max(0.0, s["base_value"] + g["value_delta"])), 1)

    rockets, candidates = [], []
    for s in players:
        s["strengths"] = _category_strengths(s)
        if s["team_id"] == ROCKETS_ID:
            rockets.append(s)
        else:
            candidates.append(s)

    # Score each realistic, available non-Rocket on fit to Houston's needs.
    scored = []
    for c in candidates:
        if c["gp"] < 30 or c["min"] < 20 or c["is_cornerstone"] or c["value"] < 48:
            continue
        if _redundant_center(c, season):
            continue   # positional redundancy — Houston already has its center hub (Şengün)
        ctx = team_ctx.get(c["team_id"], {"tier": "middle", "w": 41, "l": 41, "w_pct": 0.5, "team": c["team"]})
        order = team_order.get(c["team_id"], [])
        team_rank = (order.index(c["player_id"]) + 1) if c["player_id"] in order else 5
        avail = _availability(c, ctx["tier"], team_rank)
        # A bad contract on a tax/apron team is shopped for cap relief — more gettable.
        if c["contract"]["dumpable"]:
            house = contracts.team_apron_status(ctx["team"], season)
            if house in ("taxpayer", "first_apron", "second_apron"):
                avail = _clamp(avail * 1.30)
            else:
                avail = _clamp(avail * 1.12)
        if avail < AVAIL_FLOOR:
            continue   # untouchable — drop it so we stop suggesting unrealistic stars

        fit = sum(c["strengths"][cat] * needs[cat]["weight"] for cat in needs) / total_w
        addresses = [cat for cat in needs
                     if c["strengths"][cat] >= 0.48 and needs[cat]["weight"] >= 0.50]
        c["fit"] = round(fit * 100, 1)
        c["addresses"] = addresses
        c["availability"] = avail
        c["team_ctx"] = ctx
        c["team_rank"] = team_rank
        scored.append(c)

    # Rank by a blend of need-fit, raw value (championship swing), AND how gettable he is.
    scored.sort(key=lambda c: c["fit"] * 0.42 + c["value"] * 0.23 + c["availability"] * 100 * 0.35,
                reverse=True)

    ideas = []
    for c in scored:
        if not c["addresses"]:
            continue
        ctx = c["team_ctx"]
        prefer = _return_pref(ctx["tier"])
        is_star = c["is_allstar"] or c["value"] >= 74
        gives, out_value, cost, verdict, diff_pct, protected, salary_info = _build_package(
            c["value"], rockets, prefer, star=is_star, season=season,
            target_salary=c.get("salary", 0))
        # Post-trade cap impact for both teams: Houston sends its package salary and
        # takes back the target; the other team does the reverse.
        cap_impact = {
            "hou": contracts.apply_trade(ROCKETS_ABBR, salary_info["out"], salary_info["in"], season),
            "other": contracts.apply_trade(c["team"], salary_info["in"], salary_info["out"], season),
        }
        top_need = c["addresses"][0]
        need_rank = needs[top_need]["rank"]
        grade = c["contract"]
        rationale = (
            f"Houston ranks {_ordinal(need_rank)} in {top_need.lower()}; "
            f"{c['name']} ({_stat_line(c, top_need)}) upgrades it directly"
            + (f" and adds {', '.join(a.lower() for a in c['addresses'][1:])}. " if len(c["addresses"]) > 1 else ". ")
            + _why_they_deal(c, ctx, prefer)
            + (f" {c['team']} would also welcome shedding his ${grade['salary']/1_000_000:.0f}M "
               f"contract for cap relief." if grade["dumpable"] else "")
        )
        ideas.append({
            "target": {
                "player_id": c["player_id"], "name": c["name"], "team": c["team"],
                "value": c["value"], "fit": c["fit"], "is_allstar": c["is_allstar"],
                "addresses": c["addresses"],
                "availability": round(c["availability"] * 100),
                "available_label": _avail_label(c["availability"]),
                "team_record": f"{ctx['w']}–{ctx['l']}",
                "team_tier": ctx["tier"],
                "salary_m": round(grade["salary"] / 1_000_000, 1),
                "contract_label": grade["label"],
                "contract_years": grade.get("years_left"),
                "contract_option": grade.get("option"),
                "contract_expires": grade.get("expires"),
                "stats": {"pts": round(c["pts"],1), "reb": round(c["reb"],1), "ast": round(c["ast"],1),
                          "fg3_pct": round(c["fg3_pct"]*100,1), "stl": round(c["stl"],1),
                          "blk": round(c["blk"],1), "usg_pct": round(c["usg_pct"]*100,1)},
            },
            "gives": gives,
            "out_value": out_value,
            "cost": cost,
            "fairness": {"verdict": verdict, "diff_pct": diff_pct},
            "salary": salary_info,
            "cap_impact": cap_impact,
            "protected": protected,
            "rationale": rationale,
        })
        if len(ideas) >= 6:
            break

    needs_sorted = sorted(
        [{"category": k, **v} for k, v in needs.items()],
        key=lambda n: n["weight"], reverse=True,
    )
    rockets_min = [{"name": r["name"], "value": r["value"]} for r in rockets]
    untouchable = {recognition.norm_name(n) for n in _untouchable(season)}
    protected_core = [r["name"] for r in sorted(rockets_min, key=lambda r: r["value"], reverse=True)
                      if recognition.norm_name(r["name"]) in untouchable]
    # League-wide maps reused by the contracts cap-relief planner (no re-fetch):
    # on-court value, and the REAL team each player suited up for (so the planner
    # sheds only actual roster players, not dead money on a team's cap sheet).
    player_values = {s["name"]: s["base_value"] for s in players
                     if s["gp"] >= 20 and s["min"] >= 12}
    player_teams = {s["name"]: s["team"] for s in players if s["gp"] >= 1}

    # Per-player meta + per-team rosters for the Trade Machine (value, salary,
    # contract). Dedupe traded players to the team they logged the most minutes for.
    player_meta = {}
    for s in players:
        if s["gp"] < 1:
            continue
        prev = player_meta.get(s["name"])
        if prev and prev["_min"] >= s["min"]:
            continue
        player_meta[s["name"]] = {
            "name": s["name"], "team": s["team"], "value": s["value"],
            "base_value": s["base_value"], "salary": s["salary"],
            "salary_m": round(s["salary"] / 1_000_000, 1),
            "contract_label": s["contract"]["label"], "age": s["age"],
            "pts": round(s["pts"], 1), "is_allstar": s["is_allstar"], "_min": s["min"],
        }
    rosters = {}
    for m in player_meta.values():
        m.pop("_min", None)
        rosters.setdefault(m["team"], []).append(m)
    for t in rosters:
        rosters[t].sort(key=lambda p: p["value"], reverse=True)

    return {
        "season": season,
        "needs": needs_sorted,
        "rockets_core": sorted(rockets_min, key=lambda r: r["value"], reverse=True)[:5],
        "protected_core": protected_core,
        "ideas": ideas,
        "player_values": player_values,
        "player_teams": player_teams,
        "player_meta": player_meta,
        "rosters": rosters,
    }


def get_player_values(season, force=False):
    """League-wide {name: on-court value} from the cached build (no extra fetch)."""
    return get_trade_ideas(season, force=force).get("player_values", {})


def get_player_teams(season, force=False):
    """League-wide {name: team_abbr} of who actually played where (nba_api)."""
    return get_trade_ideas(season, force=force).get("player_teams", {})


def get_player_meta(season, force=False):
    """League-wide {name: {value, salary, contract_label, team, ...}} for the Trade Machine."""
    return get_trade_ideas(season, force=force).get("player_meta", {})


def get_rosters(season, force=False):
    """{team_abbr: [player meta, …]} grouped + sorted by value, for the Trade Machine."""
    return get_trade_ideas(season, force=force).get("rosters", {})


def package_value(items):
    """Premium-adjusted, diminishing-returns value of a set of trade assets
    (each {"type": "player"|"pick", "value": n}). Shared with the Trade Machine
    so its fairness read matches the Championship Builder."""
    return round(_adjusted(items), 1)


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


def _why_they_deal(c, ctx, prefer):
    """One clause explaining why the other team would actually make this deal."""
    rec = f"{ctx['w']}–{ctx['l']}"
    if ctx["tier"] == "seller":
        if c["age"] >= 29:
            return (f"{c['team']} ({rec}) is rebuilding and has little use for a {int(c['age'])}-year-old vet — "
                    f"Houston's young pieces and picks fit their timeline.")
        return (f"{c['team']} ({rec}) is out of the race and can flip rotation talent "
                f"for youth and draft capital.")
    if ctx["tier"] == "middle":
        return (f"{c['team']} ({rec}) is on the bubble and could reshape its rotation for the right package.")
    return (f"{c['team']} ({rec}) is a contender, so it would only move him as a role-player swap, "
            f"not part of its core.")


def get_trade_ideas(season, force=False):
    now = time.time()
    if (force or _CACHE["data"] is None or _CACHE["season"] != season
            or now - _CACHE["built_at"] > _TTL):
        _CACHE["data"] = _build(season)
        _CACHE["built_at"] = now
        _CACHE["season"] = season
    return _CACHE["data"]
