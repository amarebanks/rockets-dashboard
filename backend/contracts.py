"""
contracts.py — curated NBA salary / contract data + cap math.

nba_api exposes NO salary data, so the tables here are hand-maintained and
APPROXIMATE (same philosophy as draft.py's pick inventory — edit them as deals
happen). The module does three jobs:

  • CAP VIEW   — each team's committed salary vs the cap / luxury-tax / apron
                 lines, so you can see who's a taxpayer and who has room.
  • VALUE      — a contract nudges a player's 0–100 trade value: a bargain
                 (underpaid vs production) is a positive asset, a "bad contract"
                 (overpaid) is a drag teams want off their books.
  • LEGALITY   — CBA salary-matching + apron rules, so the Championship Builder
                 only proposes cap-legal packages (and adds salary filler when a
                 high-paid target needs matching money).

Salaries are in whole dollars. Curated coverage is deepest for Houston, league
stars, and notable bad contracts; anyone uncurated falls back to a value-based
salary ESTIMATE so the trade engine always has a number to match against.
"""

import recognition

# ── Cap landscape (real published figures) ───────────────────────────────────
# cap = salary cap, tax = luxury-tax line, apron1 / apron2 = the two aprons.
CAP_BY_SEASON = {
    "2025-26": {"cap": 154_647_000, "tax": 187_895_000, "apron1": 195_945_000, "apron2": 207_824_000},
    "2024-25": {"cap": 140_588_000, "tax": 170_814_000, "apron1": 178_132_000, "apron2": 188_931_000},
}
DEFAULT_SEASON = "2025-26"

# Minimum-ish salary used as the floor for the estimate fallback.
_MIN_SALARY = 2_300_000


# ── Curated contracts ────────────────────────────────────────────────────────
# name → {"team": ABBR, "salary": {season: dollars}, "years_left": n, "option": "PO"|"TO"|None}
# years_left / option are after the listed season (for display flavor only).
# APPROXIMATE — edit to match reality. Anyone not here is estimated from value.
CONTRACTS = {
    # ── Houston Rockets (post-KD-trade roster) ──
    "Kevin Durant":        {"team": "HOU", "salary": {"2025-26": 54_708_608}, "years_left": 1, "option": None},
    "Alperen Sengun":      {"team": "HOU", "salary": {"2024-25": 5_419_000, "2025-26": 33_935_000}, "years_left": 4, "option": None},
    "Fred VanVleet":       {"team": "HOU", "salary": {"2024-25": 42_846_615, "2025-26": 25_000_000}, "years_left": 1, "option": "TO"},
    "Dorian Finney-Smith": {"team": "HOU", "salary": {"2025-26": 13_350_000}, "years_left": 3, "option": "PO"},
    "Steven Adams":        {"team": "HOU", "salary": {"2024-25": 12_600_000, "2025-26": 12_600_000}, "years_left": 2, "option": None},
    "Clint Capela":        {"team": "HOU", "salary": {"2025-26": 7_150_000}, "years_left": 2, "option": None},
    "Jabari Smith Jr.":    {"team": "HOU", "salary": {"2024-25": 11_369_000, "2025-26": 12_435_000}, "years_left": 1, "option": None},
    "Tari Eason":          {"team": "HOU", "salary": {"2024-25": 4_775_000, "2025-26": 5_739_000}, "years_left": 1, "option": None},
    "Amen Thompson":       {"team": "HOU", "salary": {"2024-25": 8_613_000, "2025-26": 9_044_000}, "years_left": 2, "option": "TO"},
    "Reed Sheppard":       {"team": "HOU", "salary": {"2024-25": 6_792_000, "2025-26": 7_132_000}, "years_left": 2, "option": None},
    "Jae'Sean Tate":       {"team": "HOU", "salary": {"2024-25": 7_600_000, "2025-26": 7_600_000}, "years_left": 1, "option": "TO"},
    "Aaron Holiday":       {"team": "HOU", "salary": {"2025-26": 4_762_000}, "years_left": 1, "option": None},
    "Jock Landale":        {"team": "HOU", "salary": {"2024-25": 8_000_000, "2025-26": 8_000_000}, "years_left": 1, "option": None},
    "Josh Okogie":         {"team": "HOU", "salary": {"2025-26": 7_750_000}, "years_left": 1, "option": "TO"},

    # ── League stars / max & near-max deals ──
    "Shai Gilgeous-Alexander": {"team": "OKC", "salary": {"2025-26": 38_333_000}, "years_left": 4, "option": None},
    "Nikola Jokic":        {"team": "DEN", "salary": {"2025-26": 55_224_000}, "years_left": 2, "option": "PO"},
    "Luka Doncic":         {"team": "LAL", "salary": {"2025-26": 45_999_000}, "years_left": 2, "option": "PO"},
    "Giannis Antetokounmpo": {"team": "MIL", "salary": {"2025-26": 54_126_000}, "years_left": 2, "option": "PO"},
    "Joel Embiid":         {"team": "PHI", "salary": {"2025-26": 55_224_000}, "years_left": 3, "option": "PO"},
    "Victor Wembanyama":   {"team": "SAS", "salary": {"2025-26": 13_853_000}, "years_left": 1, "option": None},
    "Jayson Tatum":        {"team": "BOS", "salary": {"2025-26": 54_126_000}, "years_left": 4, "option": None},
    "Anthony Edwards":     {"team": "MIN", "salary": {"2025-26": 42_176_000}, "years_left": 4, "option": None},
    "Devin Booker":        {"team": "PHX", "salary": {"2025-26": 53_142_000}, "years_left": 3, "option": None},
    "Anthony Davis":       {"team": "DAL", "salary": {"2025-26": 54_126_000}, "years_left": 2, "option": "PO"},
    "Stephen Curry":       {"team": "GSW", "salary": {"2025-26": 59_606_000}, "years_left": 1, "option": None},
    "LeBron James":        {"team": "LAL", "salary": {"2025-26": 52_627_000}, "years_left": 1, "option": "PO"},
    "Jalen Brunson":       {"team": "NYK", "salary": {"2025-26": 34_944_000}, "years_left": 3, "option": "PO"},
    "Jaylen Brown":        {"team": "BOS", "salary": {"2025-26": 53_142_000}, "years_left": 4, "option": None},
    "Donovan Mitchell":    {"team": "CLE", "salary": {"2025-26": 46_438_000}, "years_left": 3, "option": "PO"},
    "Kawhi Leonard":       {"team": "LAC", "salary": {"2025-26": 50_000_000}, "years_left": 2, "option": None},
    "Cade Cunningham":     {"team": "DET", "salary": {"2025-26": 46_438_000}, "years_left": 4, "option": None},
    "Tyrese Maxey":        {"team": "PHI", "salary": {"2025-26": 37_896_000}, "years_left": 3, "option": None},
    "Jamal Murray":        {"team": "DEN", "salary": {"2025-26": 46_081_000}, "years_left": 3, "option": None},
    "Jalen Johnson":       {"team": "ATL", "salary": {"2025-26": 30_000_000}, "years_left": 4, "option": None},
    "Jalen Duren":         {"team": "DET", "salary": {"2025-26": 6_700_000}, "years_left": 1, "option": None},
    "Chet Holmgren":       {"team": "OKC", "salary": {"2025-26": 13_787_000}, "years_left": 1, "option": None},
    "Domantas Sabonis":    {"team": "SAC", "salary": {"2025-26": 43_577_000}, "years_left": 3, "option": None},
    "Karl-Anthony Towns":  {"team": "NYK", "salary": {"2025-26": 53_142_000}, "years_left": 2, "option": "PO"},
    "Bam Adebayo":         {"team": "MIA", "salary": {"2025-26": 37_096_000}, "years_left": 3, "option": "PO"},
    "Evan Mobley":         {"team": "CLE", "salary": {"2025-26": 37_896_000}, "years_left": 4, "option": None},
    "De'Aaron Fox":        {"team": "SAS", "salary": {"2025-26": 37_096_000}, "years_left": 2, "option": None},
    "Brandon Ingram":      {"team": "TOR", "salary": {"2025-26": 36_000_000}, "years_left": 2, "option": None},
    "Deni Avdija":         {"team": "POR", "salary": {"2025-26": 14_437_000}, "years_left": 3, "option": None},
    "Scottie Barnes":      {"team": "TOR", "salary": {"2025-26": 38_333_000}, "years_left": 4, "option": None},
    "Austin Reaves":       {"team": "LAL", "salary": {"2025-26": 13_945_000}, "years_left": 1, "option": "PO"},

    # ── Notable "bad" / heavy contracts (overpaid vs production — dump candidates) ──
    "Ben Simmons":         {"team": "BKN", "salary": {"2024-25": 40_338_000}, "years_left": 0, "option": None},
    "Bradley Beal":        {"team": "PHX", "salary": {"2025-26": 53_666_000}, "years_left": 1, "option": "NTC"},
    "Zach LaVine":         {"team": "SAC", "salary": {"2025-26": 47_499_000}, "years_left": 1, "option": "PO"},
    "Andrew Wiggins":      {"team": "MIA", "salary": {"2025-26": 28_222_000}, "years_left": 1, "option": "PO"},
    "Tobias Harris":       {"team": "DET", "salary": {"2025-26": 26_000_000}, "years_left": 1, "option": None},
    "Jordan Poole":        {"team": "WAS", "salary": {"2025-26": 31_829_000}, "years_left": 2, "option": None},
    "Fred VanVleet ":      {"team": "HOU", "salary": {}, "years_left": 0, "option": None},  # guard against trailing-space dupes
    "Pascal Siakam":       {"team": "IND", "salary": {"2025-26": 42_745_000}, "years_left": 3, "option": None},
    "Rudy Gobert":         {"team": "MIN", "salary": {"2025-26": 43_827_000}, "years_left": 1, "option": "PO"},
    "Julius Randle":       {"team": "MIN", "salary": {"2025-26": 33_138_000}, "years_left": 1, "option": "PO"},
    "CJ McCollum":         {"team": "WAS", "salary": {"2025-26": 30_666_000}, "years_left": 1, "option": None},
    "Klay Thompson":       {"team": "DAL", "salary": {"2025-26": 16_575_000}, "years_left": 2, "option": None},
    "Kristaps Porzingis":  {"team": "ATL", "salary": {"2025-26": 30_731_000}, "years_left": 1, "option": None},
    "Nikola Vucevic":      {"team": "CHI", "salary": {"2025-26": 21_484_000}, "years_left": 1, "option": None},
    "Zion Williamson":     {"team": "NOP", "salary": {"2025-26": 39_446_000}, "years_left": 3, "option": None},
    "Brandon Miller":      {"team": "CHA", "salary": {"2025-26": 11_650_000}, "years_left": 1, "option": None},

    # ── Common mid-tier trade targets / quality starters ──
    "Mikal Bridges":       {"team": "NYK", "salary": {"2025-26": 24_900_000}, "years_left": 1, "option": None},
    "OG Anunoby":          {"team": "NYK", "salary": {"2025-26": 39_000_000}, "years_left": 4, "option": None},
    "Desmond Bane":        {"team": "ORL", "salary": {"2025-26": 36_725_000}, "years_left": 4, "option": None},
    "Jerami Grant":        {"team": "POR", "salary": {"2025-26": 32_000_000}, "years_left": 3, "option": "PO"},
    "Jrue Holiday":        {"team": "POR", "salary": {"2025-26": 32_400_000}, "years_left": 2, "option": None},
    "Jimmy Butler":        {"team": "GSW", "salary": {"2025-26": 54_126_000}, "years_left": 1, "option": "PO"},
    "Derrick White":       {"team": "BOS", "salary": {"2025-26": 28_100_000}, "years_left": 3, "option": None},
    "Jaren Jackson Jr.":   {"team": "MEM", "salary": {"2025-26": 23_410_000}, "years_left": 1, "option": None},
    "Ja Morant":           {"team": "MEM", "salary": {"2025-26": 39_446_000}, "years_left": 3, "option": None},
    "Trae Young":          {"team": "ATL", "salary": {"2025-26": 45_999_000}, "years_left": 2, "option": "PO"},
    "Darius Garland":      {"team": "CLE", "salary": {"2025-26": 39_446_000}, "years_left": 3, "option": None},
    "Lauri Markkanen":     {"team": "UTA", "salary": {"2025-26": 46_385_000}, "years_left": 4, "option": None},
    "Collin Sexton":       {"team": "CHA", "salary": {"2025-26": 19_000_000}, "years_left": 1, "option": None},
    "Stephon Castle":      {"team": "SAS", "salary": {"2025-26": 9_165_000}, "years_left": 2, "option": None},
    "Dyson Daniels":       {"team": "ATL", "salary": {"2025-26": 6_750_000}, "years_left": 1, "option": None},
    "Cason Wallace":       {"team": "OKC", "salary": {"2025-26": 5_200_000}, "years_left": 1, "option": None},
    "Ausar Thompson":      {"team": "DET", "salary": {"2025-26": 9_200_000}, "years_left": 2, "option": "TO"},
}
# Remove the dummy guard entry (kept above only to document the trailing-space hazard).
CONTRACTS.pop("Fred VanVleet ", None)

# ── Team committed salary (for the cap view). APPROXIMATE total team payroll for
# the season; used directly so the cap sheet doesn't depend on curating every
# rostered player. Edit toward real totals. (~$170M ≈ tax-line team.)
TEAM_COMMITTED = {
    "2025-26": {
        "HOU": 196_000_000, "OKC": 168_000_000, "DEN": 188_000_000, "LAL": 195_000_000,
        "MIL": 186_000_000, "PHI": 192_000_000, "SAS": 165_000_000, "BOS": 225_000_000,
        "MIN": 205_000_000, "PHX": 215_000_000, "DAL": 178_000_000, "GSW": 198_000_000,
        "NYK": 215_000_000, "CLE": 198_000_000, "LAC": 190_000_000, "DET": 172_000_000,
        "SAC": 187_000_000, "TOR": 188_000_000, "POR": 170_000_000, "ATL": 184_000_000,
        "MIA": 184_000_000, "IND": 178_000_000, "CHI": 160_000_000, "WAS": 168_000_000,
        "NOP": 175_000_000, "CHA": 158_000_000, "MEM": 182_000_000, "ORL": 186_000_000,
        "UTA": 155_000_000, "BKN": 152_000_000,
    },
}

_CONTRACTS_NORM = {recognition.norm_name(n): v for n, v in CONTRACTS.items()}


# ── Salary lookup + estimate fallback ────────────────────────────────────────

def _expected_salary(value):
    """The salary a player's 0–100 trade value 'should' command (a fair-market
    curve). Used both for the bargain/overpaid judgment and the estimate fallback
    when a player isn't in the curated table."""
    table = [(95, 56_000_000), (88, 48_000_000), (82, 41_000_000), (76, 35_000_000),
             (68, 27_000_000), (60, 20_000_000), (52, 14_000_000), (44, 9_500_000),
             (36, 6_000_000), (28, 4_000_000), (0, _MIN_SALARY)]
    for i, (v, sal) in enumerate(table):
        if value >= v:
            if i == 0:
                return sal
            v_hi, s_hi = table[i - 1]
            frac = (value - v) / (v_hi - v) if v_hi != v else 0
            return round(sal + frac * (s_hi - sal))
    return _MIN_SALARY


def get_salary(name, season=DEFAULT_SEASON, value=None):
    """Player's salary for the season. Curated if known, else estimated from
    `value` (0–100 trade value). Returns whole dollars."""
    c = _CONTRACTS_NORM.get(recognition.norm_name(name))
    if c:
        sal = c["salary"].get(season)
        if sal:
            return sal
    if value is not None:
        return _expected_salary(value)
    return _MIN_SALARY


def get_contract(name):
    """Full curated contract record (team, salary map, years_left, option) or None."""
    return _CONTRACTS_NORM.get(recognition.norm_name(name))


# ── Contract → trade-value modifier ──────────────────────────────────────────

def contract_grade(name, value, season=DEFAULT_SEASON):
    """Judge a contract relative to production. Returns a dict:
        salary, expected, ratio, label ("Bargain"|"Fair"|"Overpaid"|"Bad contract"),
        value_delta (added to the player's 0–100 trade value), dumpable (bool).

    A bargain (e.g. a star on a rookie deal) is a positive trade asset; a bad
    contract is a drag teams will attach picks to shed. value_delta is small and
    bounded so it tunes, not dominates, the stat-driven value.
    """
    salary = get_salary(name, season, value)
    expected = _expected_salary(value)
    ratio = salary / expected if expected else 1.0

    if ratio <= 0.55:
        label, delta = "Bargain", min(7.0, (0.55 - ratio) * 22)
    elif ratio <= 0.85:
        label, delta = "Value", (0.85 - ratio) * 8
    elif ratio <= 1.20:
        label, delta = "Fair", 0.0
    elif ratio <= 1.55:
        label, delta = "Overpaid", -((ratio - 1.20) * 14)
    else:
        label, delta = "Bad contract", -min(10.0, (ratio - 1.20) * 14)

    return {
        "salary": salary,
        "expected": expected,
        "ratio": round(ratio, 2),
        "label": label,
        "value_delta": round(delta, 1),
        "dumpable": ratio > 1.40,   # team would attach an asset to move it for cap relief
    }


# ── CBA salary-matching / legality ───────────────────────────────────────────

def team_apron_status(team, season=DEFAULT_SEASON):
    """Where a team sits relative to the cap lines: 'room' | 'over_cap' |
    'taxpayer' | 'first_apron' | 'second_apron'. Governs how much salary it can
    take back in a trade."""
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    committed = TEAM_COMMITTED.get(season, {}).get(team)
    if committed is None:
        return "over_cap"
    if committed >= lines["apron2"]:  return "second_apron"
    if committed >= lines["apron1"]:  return "first_apron"
    if committed >= lines["tax"]:     return "taxpayer"
    if committed >= lines["cap"]:     return "over_cap"
    return "room"


def matchable_incoming(out_salary, status):
    """Max salary a team in `status` may take back when sending `out_salary`
    (simplified 2023 CBA). Second-apron teams must match dollar-for-dollar;
    apron/tax/over-cap teams use 125% + $250K; teams under the cap can absorb
    into room (handled by the caller), so here they also get the generous bracket."""
    if status == "second_apron":
        return out_salary + 100_000               # essentially dollar-in / dollar-out
    if status in ("first_apron", "taxpayer", "over_cap"):
        return round(out_salary * 1.25 + 250_000)
    # below the cap: 200% + $250K (the most generous matching bracket)
    return round(out_salary * 2.0 + 250_000)


def trade_legal(out_salary, in_salary, status):
    """Is taking back `in_salary` for `out_salary` legal for a team in `status`?
    Returns (legal: bool, allowed: int, shortfall: int>=0)."""
    allowed = matchable_incoming(out_salary, status)
    legal = in_salary <= allowed
    # Minimum outgoing salary required to legally absorb in_salary.
    if status == "second_apron":
        need_out = max(0, in_salary - 100_000)
    elif status in ("first_apron", "taxpayer", "over_cap"):
        need_out = max(0, round((in_salary - 250_000) / 1.25))
    else:
        need_out = max(0, round((in_salary - 250_000) / 2.0))
    shortfall = max(0, need_out - out_salary)
    return legal, allowed, shortfall


# ── Cap view payload ─────────────────────────────────────────────────────────

def _fmt_m(dollars):
    return round(dollars / 1_000_000, 1)


def get_cap_sheet(season=DEFAULT_SEASON):
    """Per-team cap summary for the Contracts page: committed payroll vs the
    cap / tax / apron lines, sorted by payroll (biggest spenders first)."""
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    committed = TEAM_COMMITTED.get(season, {})
    teams = []
    for team, total in committed.items():
        status = team_apron_status(team, season)
        teams.append({
            "team": team,
            "committed": total,
            "committed_m": _fmt_m(total),
            "status": status,
            "over_cap_m": _fmt_m(total - lines["cap"]),
            "room_m": _fmt_m(lines["cap"] - total),     # negative if over the cap
            "tax_m": _fmt_m(total - lines["tax"]),       # positive if a taxpayer
        })
    teams.sort(key=lambda t: t["committed"], reverse=True)
    return {
        "season": season,
        "lines": {k: _fmt_m(v) for k, v in lines.items()},
        "lines_raw": lines,
        "teams": teams,
    }


def cap_relief_plan(team, season=DEFAULT_SEASON, value_lookup=None):
    """For a team over the tax/apron lines, the most likely moves to get back
    under — the real front-office calculus the user wants surfaced, especially
    for teams 'well above the second apron'.

    We target the highest line the team is over (a second-apron team aims to get
    under the second apron first). Candidates are the team's curated contracts,
    shed worst-first (bad/overpaid deals, then biggest expirings), assuming each
    is moved/replaced by a minimum salary (so net saving = salary − minimum,
    reflecting that you take back some money in any trade). Returns None for
    teams already in line.

    `value_lookup(name) -> 0–100 value` (optional) lets the planner grade each
    contract; without it, raw salary ordering is used.
    """
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    committed = TEAM_COMMITTED.get(season, {}).get(team)
    if committed is None:
        return None
    status = team_apron_status(team, season)
    if status in ("room", "over_cap"):
        return None  # not a tax/apron team — no relief pressure

    # The line to dip under (just below the highest one they're over).
    if committed >= lines["apron2"]:   target_name, target = "second apron", lines["apron2"]
    elif committed >= lines["apron1"]: target_name, target = "first apron", lines["apron1"]
    else:                              target_name, target = "luxury tax", lines["tax"]
    overage = committed - target

    # Candidate contracts on this team, worst-first.
    cands = []
    for name, c in CONTRACTS.items():
        if c["team"] != team:
            continue
        sal = c["salary"].get(season)
        if not sal or sal <= _MIN_SALARY * 1.5:
            continue  # minimum deals don't create meaningful relief
        val = value_lookup(name) if value_lookup else None
        grade = contract_grade(name, val, season) if val is not None else {"label": "—", "dumpable": False, "ratio": None}
        # Teams shed contracts in a realistic order, NOT just biggest salary:
        #   0 bad contracts → 1 overpaid/fair vets → 2 bargains (kept if possible)
        #   → 3 All-Stars & franchise cornerstones (last resort).
        # A team dumps dead money before it touches a star or a good-value deal.
        keeper = recognition.is_cornerstone(name) or recognition.star_floor(name, season) >= 76
        label = grade.get("label")
        if keeper:                               tier = 3
        elif label in ("Bargain", "Value"):      tier = 2
        elif grade.get("dumpable"):              tier = 0
        else:                                    tier = 1
        rank = (tier, -(grade.get("ratio") or 0), -sal)
        cands.append({"name": name, "salary": sal, "salary_m": _fmt_m(sal),
                      "label": grade.get("label"), "rank": rank,
                      "option": c.get("option")})
    cands.sort(key=lambda x: x["rank"])

    moves, saved = [], 0
    for c in cands:
        if saved >= overage:
            break
        net = c["salary"] - _MIN_SALARY     # replace the outgoing deal with a minimum
        action = "Decline option / let expire" if c["option"] in ("PO", "TO") else "Trade / shed"
        moves.append({"name": c["name"], "salary_m": c["salary_m"],
                      "label": c["label"], "action": action,
                      "saves_m": _fmt_m(net)})
        saved += net

    reachable = saved >= overage
    return {
        "team": team,
        "status": status,
        "target_line": target_name,
        "committed_m": _fmt_m(committed),
        "target_m": _fmt_m(target),
        "overage_m": _fmt_m(overage),
        "moves": moves,
        "projected_saving_m": _fmt_m(saved),
        "gets_under": reachable,
        "note": (
            f"Shedding {', '.join(m['name'] for m in moves)} clears about "
            f"${_fmt_m(saved)}M — enough to dip under the {target_name}."
            if reachable else
            f"Even moving {', '.join(m['name'] for m in moves) or 'their tradable deals'} "
            f"(~${_fmt_m(saved)}M) leaves them over the {target_name}; a bigger salary dump "
            f"or a star trade would be required."
        ),
    }


def get_team_contracts(team, season=DEFAULT_SEASON):
    """Curated contracts for one team (for a roster cap breakdown). Approximate —
    only players in the CONTRACTS table appear."""
    rows = []
    for name, c in CONTRACTS.items():
        if c["team"] != team:
            continue
        sal = c["salary"].get(season)
        if not sal:
            continue
        rows.append({
            "name": name, "salary": sal, "salary_m": _fmt_m(sal),
            "years_left": c.get("years_left"), "option": c.get("option"),
        })
    rows.sort(key=lambda r: r["salary"], reverse=True)
    return rows
