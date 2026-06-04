"""
contracts.py - NBA salary / contract data + cap math.

Primary source is a SCRAPED snapshot from Spotrac (run spotrac_scraper.py to
refresh spotrac_cap_*.json / spotrac_players_*.json / spotrac_contracts.json):
real per-player cap hits across seasons + real team payrolls. nba_api has no
salary data, so anything the snapshot is missing falls back to a small hand-
CURATED table, and anything still missing falls back to a value-based ESTIMATE -
so the trade engine always has a number to match against.

The module does three jobs:

  • CAP VIEW   - each team's committed salary vs the cap / luxury-tax / apron
                 lines, so you can see who's a taxpayer and who has room.
  • VALUE      - a contract nudges a player's 0–100 trade value: a bargain
                 (underpaid vs production) is a positive asset, a "bad contract"
                 (overpaid) is a drag teams want off their books.
  • LEGALITY   - CBA salary-matching + apron rules, so the Championship Builder
                 only proposes cap-legal packages (and adds salary filler when a
                 high-paid target needs matching money).

Contracts are modeled as the CURRENT-SEASON cap hit plus a forward outlook
(future cap hits, years remaining). Roster membership for trade logic comes from
nba_api (who actually played), NOT the Spotrac cap sheet - that page carries dead
money (e.g. a waived/stretched player still on his old team's books), which must
not be treated as a tradeable asset. Salaries are whole dollars.
"""

import json
import os
import recognition

# ── Cap landscape (real published figures; 2026-27 cap is scraped, lines scaled) ─
CAP_BY_SEASON = {
    "2026-27": {"cap": 165_000_000, "tax": 200_500_000, "apron1": 209_100_000, "apron2": 222_900_000},
    "2025-26": {"cap": 154_647_000, "tax": 187_895_000, "apron1": 195_945_000, "apron2": 207_824_000},
    "2024-25": {"cap": 140_588_000, "tax": 170_814_000, "apron1": 178_132_000, "apron2": 188_931_000},
}
DEFAULT_SEASON = "2025-26"
RAISE = 1.05            # assumed annual raise when projecting future cap hits
_MIN_SALARY = 2_300_000


# ── Curated contracts ────────────────────────────────────────────────────────
# name → {team, salary (current-season cap hit), years_left (incl. current),
#         option ("PO"|"TO"|None on the final year), expires (FA summer, year str)}
# Future salaries are projected from `salary` with RAISE. APPROXIMATE - edit freely.
CONTRACTS = {
    # ── Houston Rockets ──
    "Kevin Durant":        {"team": "HOU", "salary": 54_708_608, "years_left": 1, "option": None, "expires": "2026"},
    "Alperen Sengun":      {"team": "HOU", "salary": 33_935_000, "years_left": 5, "option": None, "expires": "2030"},
    "Fred VanVleet":       {"team": "HOU", "salary": 25_000_000, "years_left": 2, "option": "TO", "expires": "2027"},
    "Dorian Finney-Smith": {"team": "HOU", "salary": 13_350_000, "years_left": 4, "option": "PO", "expires": "2029"},
    "Steven Adams":        {"team": "HOU", "salary": 12_600_000, "years_left": 2, "option": None, "expires": "2027"},
    "Clint Capela":        {"team": "HOU", "salary":  7_150_000, "years_left": 3, "option": None, "expires": "2028"},
    "Jabari Smith Jr.":    {"team": "HOU", "salary": 12_435_000, "years_left": 5, "option": None, "expires": "2030"},
    "Tari Eason":          {"team": "HOU", "salary":  5_739_000, "years_left": 1, "option": None, "expires": "2026"},
    "Amen Thompson":       {"team": "HOU", "salary":  9_044_000, "years_left": 2, "option": "TO", "expires": "2027"},
    "Reed Sheppard":       {"team": "HOU", "salary":  7_132_000, "years_left": 3, "option": "TO", "expires": "2028"},
    "Jae'Sean Tate":       {"team": "HOU", "salary":  7_600_000, "years_left": 1, "option": "TO", "expires": "2026"},
    "Aaron Holiday":       {"team": "HOU", "salary":  4_762_000, "years_left": 1, "option": None, "expires": "2026"},
    "Jock Landale":        {"team": "HOU", "salary":  8_000_000, "years_left": 1, "option": None, "expires": "2026"},
    "Josh Okogie":         {"team": "HOU", "salary":  7_750_000, "years_left": 1, "option": "TO", "expires": "2026"},

    # ── League stars / max & near-max deals ──
    "Shai Gilgeous-Alexander": {"team": "OKC", "salary": 38_333_000, "years_left": 5, "option": None, "expires": "2031"},
    "Nikola Jokic":        {"team": "DEN", "salary": 55_224_000, "years_left": 3, "option": "PO", "expires": "2028"},
    "Luka Doncic":         {"team": "LAL", "salary": 45_999_000, "years_left": 3, "option": "PO", "expires": "2028"},
    "Giannis Antetokounmpo": {"team": "MIL", "salary": 54_126_000, "years_left": 3, "option": "PO", "expires": "2028"},
    "Joel Embiid":         {"team": "PHI", "salary": 55_224_000, "years_left": 4, "option": "PO", "expires": "2029"},
    "Victor Wembanyama":   {"team": "SAS", "salary": 13_853_000, "years_left": 2, "option": None, "expires": "2027"},
    "Jayson Tatum":        {"team": "BOS", "salary": 54_126_000, "years_left": 5, "option": "PO", "expires": "2030"},
    "Anthony Edwards":     {"team": "MIN", "salary": 42_176_000, "years_left": 4, "option": None, "expires": "2029"},
    "Devin Booker":        {"team": "PHX", "salary": 53_142_000, "years_left": 4, "option": None, "expires": "2029"},
    "Anthony Davis":       {"team": "DAL", "salary": 54_126_000, "years_left": 3, "option": "PO", "expires": "2028"},
    "Stephen Curry":       {"team": "GSW", "salary": 59_606_000, "years_left": 2, "option": None, "expires": "2027"},
    "LeBron James":        {"team": "LAL", "salary": 52_627_000, "years_left": 1, "option": "PO", "expires": "2026"},
    "Jalen Brunson":       {"team": "NYK", "salary": 34_944_000, "years_left": 4, "option": "PO", "expires": "2029"},
    "Jaylen Brown":        {"team": "BOS", "salary": 53_142_000, "years_left": 4, "option": None, "expires": "2029"},
    "Donovan Mitchell":    {"team": "CLE", "salary": 46_438_000, "years_left": 4, "option": "PO", "expires": "2029"},
    "Kawhi Leonard":       {"team": "LAC", "salary": 50_000_000, "years_left": 2, "option": None, "expires": "2027"},
    "Cade Cunningham":     {"team": "DET", "salary": 46_438_000, "years_left": 5, "option": None, "expires": "2030"},
    "Tyrese Maxey":        {"team": "PHI", "salary": 37_896_000, "years_left": 4, "option": None, "expires": "2029"},
    "Jamal Murray":        {"team": "DEN", "salary": 46_081_000, "years_left": 4, "option": None, "expires": "2029"},
    "Jalen Johnson":       {"team": "ATL", "salary": 30_000_000, "years_left": 5, "option": None, "expires": "2030"},
    "Jalen Duren":         {"team": "DET", "salary":  6_700_000, "years_left": 1, "option": None, "expires": "2026"},
    "Chet Holmgren":       {"team": "OKC", "salary": 13_787_000, "years_left": 2, "option": None, "expires": "2027"},
    "Domantas Sabonis":    {"team": "SAC", "salary": 43_577_000, "years_left": 3, "option": None, "expires": "2028"},
    "Karl-Anthony Towns":  {"team": "NYK", "salary": 53_142_000, "years_left": 3, "option": "PO", "expires": "2028"},
    "Bam Adebayo":         {"team": "MIA", "salary": 37_096_000, "years_left": 4, "option": "PO", "expires": "2029"},
    "Evan Mobley":         {"team": "CLE", "salary": 37_896_000, "years_left": 5, "option": None, "expires": "2030"},
    "De'Aaron Fox":        {"team": "SAS", "salary": 37_096_000, "years_left": 3, "option": None, "expires": "2028"},
    "Brandon Ingram":      {"team": "TOR", "salary": 36_000_000, "years_left": 3, "option": None, "expires": "2028"},
    "Deni Avdija":         {"team": "POR", "salary": 14_437_000, "years_left": 3, "option": None, "expires": "2028"},
    "Scottie Barnes":      {"team": "TOR", "salary": 38_333_000, "years_left": 5, "option": None, "expires": "2030"},
    "Austin Reaves":       {"team": "LAL", "salary": 13_945_000, "years_left": 1, "option": "PO", "expires": "2026"},

    # ── Notable heavy / "bad" contracts (overpaid vs production - dump candidates) ──
    "Bradley Beal":        {"team": "LAC", "salary":  5_400_000, "years_left": 2, "option": "PO", "expires": "2027"},  # waived by PHX, signed LAC
    "Zach LaVine":         {"team": "SAC", "salary": 47_499_000, "years_left": 2, "option": "PO", "expires": "2027"},
    "Andrew Wiggins":      {"team": "MIA", "salary": 28_222_000, "years_left": 2, "option": "PO", "expires": "2027"},
    "Tobias Harris":       {"team": "DET", "salary": 26_000_000, "years_left": 1, "option": None, "expires": "2026"},
    "Jordan Poole":        {"team": "WAS", "salary": 31_829_000, "years_left": 3, "option": None, "expires": "2028"},
    "Pascal Siakam":       {"team": "IND", "salary": 42_745_000, "years_left": 4, "option": None, "expires": "2029"},
    "Rudy Gobert":         {"team": "MIN", "salary": 43_827_000, "years_left": 2, "option": "PO", "expires": "2027"},
    "Julius Randle":       {"team": "MIN", "salary": 33_138_000, "years_left": 2, "option": "PO", "expires": "2027"},
    "CJ McCollum":         {"team": "WAS", "salary": 30_666_000, "years_left": 1, "option": None, "expires": "2026"},
    "Klay Thompson":       {"team": "DAL", "salary": 16_575_000, "years_left": 2, "option": None, "expires": "2027"},
    "Kristaps Porzingis":  {"team": "ATL", "salary": 30_731_000, "years_left": 1, "option": None, "expires": "2026"},
    "Nikola Vucevic":      {"team": "CHI", "salary": 21_484_000, "years_left": 1, "option": None, "expires": "2026"},
    "Zion Williamson":     {"team": "NOP", "salary": 39_446_000, "years_left": 4, "option": None, "expires": "2029"},
    "Jimmy Butler":        {"team": "GSW", "salary": 54_126_000, "years_left": 2, "option": "PO", "expires": "2027"},
    "Dillon Brooks":       {"team": "PHX", "salary": 21_000_000, "years_left": 2, "option": None, "expires": "2027"},
    "Jalen Green":         {"team": "PHX", "salary": 33_333_000, "years_left": 4, "option": None, "expires": "2029"},

    # ── Common mid-tier trade targets / quality starters ──
    "Mikal Bridges":       {"team": "NYK", "salary": 24_900_000, "years_left": 1, "option": None, "expires": "2026"},
    "OG Anunoby":          {"team": "NYK", "salary": 39_000_000, "years_left": 4, "option": None, "expires": "2029"},
    "Desmond Bane":        {"team": "ORL", "salary": 36_725_000, "years_left": 4, "option": None, "expires": "2029"},
    "Jerami Grant":        {"team": "POR", "salary": 32_000_000, "years_left": 3, "option": "PO", "expires": "2028"},
    "Jrue Holiday":        {"team": "POR", "salary": 32_400_000, "years_left": 2, "option": None, "expires": "2027"},
    "Derrick White":       {"team": "BOS", "salary": 28_100_000, "years_left": 4, "option": None, "expires": "2029"},
    "Jaren Jackson Jr.":   {"team": "MEM", "salary": 23_410_000, "years_left": 1, "option": None, "expires": "2026"},
    "Ja Morant":           {"team": "MEM", "salary": 39_446_000, "years_left": 3, "option": None, "expires": "2028"},
    "Trae Young":          {"team": "ATL", "salary": 45_999_000, "years_left": 2, "option": "PO", "expires": "2027"},
    "Darius Garland":      {"team": "CLE", "salary": 39_446_000, "years_left": 3, "option": None, "expires": "2028"},
    "Lauri Markkanen":     {"team": "UTA", "salary": 46_385_000, "years_left": 4, "option": None, "expires": "2029"},
    "Collin Sexton":       {"team": "CHA", "salary": 19_000_000, "years_left": 1, "option": None, "expires": "2026"},
    "Stephon Castle":      {"team": "SAS", "salary":  9_165_000, "years_left": 3, "option": None, "expires": "2028"},
    "Dyson Daniels":       {"team": "ATL", "salary":  6_750_000, "years_left": 1, "option": None, "expires": "2026"},
    "Cason Wallace":       {"team": "OKC", "salary":  5_200_000, "years_left": 1, "option": None, "expires": "2026"},
    "Ausar Thompson":      {"team": "DET", "salary":  9_200_000, "years_left": 2, "option": "TO", "expires": "2027"},
}

_CONTRACTS_NORM = {recognition.norm_name(n): v for n, v in CONTRACTS.items()}

# ── Team committed salary (current season) for the cap view. APPROXIMATE total
# team payroll; used directly so the cap sheet doesn't depend on curating every
# rostered player. Edit toward real totals. (~$188M ≈ the luxury-tax line.)
TEAM_COMMITTED = {
    "HOU": 196_000_000, "OKC": 168_000_000, "DEN": 188_000_000, "LAL": 195_000_000,
    "MIL": 186_000_000, "PHI": 192_000_000, "SAS": 165_000_000, "BOS": 225_000_000,
    "MIN": 205_000_000, "PHX": 193_000_000, "DAL": 178_000_000, "GSW": 198_000_000,
    "NYK": 215_000_000, "CLE": 198_000_000, "LAC": 190_000_000, "DET": 172_000_000,
    "SAC": 187_000_000, "TOR": 188_000_000, "POR": 170_000_000, "ATL": 184_000_000,
    "MIA": 184_000_000, "IND": 178_000_000, "CHI": 160_000_000, "WAS": 168_000_000,
    "NOP": 175_000_000, "CHA": 158_000_000, "MEM": 182_000_000, "ORL": 186_000_000,
    "UTA": 155_000_000, "BKN": 152_000_000,
}


def _fmt_m(dollars):
    return round(dollars / 1_000_000, 1)


# ── Scraped Spotrac snapshot (primary source - see spotrac_scraper.py) ────────
_DIR = os.path.dirname(__file__)
_SCRAPED_SAL = {}        # season -> {norm_name: amount}
_SCRAPED_CAP = {}        # season -> {team: committed}
_SCRAPED_OUTLOOK = {}    # norm_name -> {name, team, pos, salary_by_season}


def _load_json(name):
    try:
        with open(os.path.join(_DIR, name), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _load_snapshots():
    try:
        files = os.listdir(_DIR)
    except OSError:
        files = []
    for f in files:
        if f.startswith("spotrac_cap_") and f.endswith(".json"):
            d = _load_json(f)
            if d and d.get("season"):
                _SCRAPED_CAP[d["season"]] = {t: v["committed"] for t, v in d.get("teams", {}).items()
                                             if v.get("committed") is not None}
    merged = _load_json("spotrac_contracts.json")
    if merged:
        for name, p in merged.get("players", {}).items():
            nn = recognition.norm_name(name)
            sbs = {s: a for s, a in p.get("salary_by_season", {}).items() if a}
            _SCRAPED_OUTLOOK[nn] = {"name": name, "team": p.get("team"),
                                    "pos": p.get("pos"), "type": p.get("type"),
                                    "salary_by_season": sbs}
            for season, amt in sbs.items():
                _SCRAPED_SAL.setdefault(season, {})[nn] = amt


# Slotted rookie-scale deals are non-negotiated (set by draft position) and team-
# friendly - they're never "bad contracts" no matter how a rookie's early
# production grades out. (Rookie EXTENSIONS, RK-EXT, ARE negotiated, so not here.)
_ROOKIE_TYPES = {"RK-1ST", "RK-2ND", "RK-3RD", "RK-4TH", "RK"}
# Rookie-scale + rookie extensions = young building blocks a team controls cheaply
# and builds around (e.g. a rookie-max extension goes to your best young star).
# Never cap-dump candidates, even when the 0–100 proxy under-rates them.
_YOUNG_CORE_TYPES = _ROOKIE_TYPES | {"RK-EXT", "DRK-EXT", "DRK-1ST", "ROOKIE-MAXIMUM-EXTENSION"}


def _ctype(name):
    o = _SCRAPED_OUTLOOK.get(recognition.norm_name(name))
    return (o.get("type") or "").upper() if o else ""


def is_rookie_scale(name):
    return _ctype(name) in _ROOKIE_TYPES


def is_young_core(name):
    return _ctype(name) in _YOUNG_CORE_TYPES


_load_snapshots()
HAS_SCRAPE = bool(_SCRAPED_OUTLOOK)


def _scraped_salary(name, season):
    return _SCRAPED_SAL.get(season, {}).get(recognition.norm_name(name))


def team_committed(team, season=DEFAULT_SEASON):
    """A team's committed payroll for the season - scraped if available, else the
    curated 2025-26 estimate, else None."""
    cap = _SCRAPED_CAP.get(season)
    if cap and team in cap:
        return cap[team]
    if season == "2025-26":
        return TEAM_COMMITTED.get(team)
    return None


def _all_teams(season=DEFAULT_SEASON):
    cap = _SCRAPED_CAP.get(season)
    return sorted(cap.keys()) if cap else sorted(TEAM_COMMITTED.keys())


# ── Salary lookup + estimate fallback ────────────────────────────────────────

def _expected_salary(value):
    """The salary a player's 0–100 trade value 'should' command (a fair-market
    curve). Drives the bargain/overpaid judgment and the estimate fallback for
    players not in the curated table."""
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
    """Player's cap hit for the season: scraped Spotrac figure first, then the
    curated table, then a value-based estimate (so there's always a number)."""
    s = _scraped_salary(name, season)
    if s:
        return s
    c = _CONTRACTS_NORM.get(recognition.norm_name(name))
    if c and c.get("salary"):
        return c["salary"]
    if value is not None:
        return _expected_salary(value)
    return _MIN_SALARY


def _future_salaries(salary, years_left, season=DEFAULT_SEASON):
    """Projected cap hits for the seasons AFTER the current one (RAISE per year)."""
    out = []
    start = int(season[:4])
    s = salary
    for i in range(1, max(0, years_left)):
        s = round(s * RAISE, -3)
        yr = start + i
        out.append({"season": f"{yr}-{str(yr + 1)[2:]}", "amount": s, "amount_m": _fmt_m(s)})
    return out


def contract_outlook(name, season=DEFAULT_SEASON):
    """Current + future view of a contract for display: salary now, real future
    cap hits (scraped) or projected ones, total remaining, years left, option,
    expiry. None if the player isn't known at all."""
    nn = recognition.norm_name(name)
    cc = _CONTRACTS_NORM.get(nn, {})
    o = _SCRAPED_OUTLOOK.get(nn)
    if o and o["salary_by_season"].get(season):
        sbs = o["salary_by_season"]
        cur = sbs[season]
        future = [{"season": s, "amount": sbs[s], "amount_m": _fmt_m(sbs[s])}
                  for s in sorted(sbs) if s > season]
        total = cur + sum(f["amount"] for f in future)
        return {
            "salary": cur, "salary_m": _fmt_m(cur),
            "years_left": 1 + len(future),            # known years within scraped range
            "option": cc.get("option"), "expires": cc.get("expires"),
            "future": future,
            "total_remaining": total, "total_remaining_m": _fmt_m(total),
        }
    if not cc or not cc.get("salary"):
        return None
    yl = cc.get("years_left", 1)
    future = _future_salaries(cc["salary"], yl, season)
    total = cc["salary"] + sum(f["amount"] for f in future)
    return {
        "salary": cc["salary"], "salary_m": _fmt_m(cc["salary"]),
        "years_left": yl, "option": cc.get("option"), "expires": cc.get("expires"),
        "future": future,
        "total_remaining": total, "total_remaining_m": _fmt_m(total),
    }


def get_contract(name):
    """Raw contract record (scraped outlook merged with curated option/expiry)."""
    nn = recognition.norm_name(name)
    o = _SCRAPED_OUTLOOK.get(nn)
    cc = _CONTRACTS_NORM.get(nn)
    if o:
        return {**(cc or {}), "team": o["team"], "salary_by_season": o["salary_by_season"]}
    return cc


# ── Contract → trade-value modifier ──────────────────────────────────────────

def contract_grade(name, value, season=DEFAULT_SEASON):
    """Judge a contract relative to production. Returns salary, expected, ratio,
    label (Bargain|Value|Fair|Overpaid|Bad contract), value_delta (added to the
    0–100 trade value), dumpable, and the forward outlook (years_left/option/
    expires/total_remaining_m/future). value_delta is bounded so it tunes, not
    dominates, the stat-driven value."""
    if value is None:
        value = 0
    salary = get_salary(name, season, value)
    expected = _expected_salary(value)
    ratio = salary / expected if expected else 1.0

    # Rookie-scale deals are slotted by draft position, not negotiated - never bad.
    if is_rookie_scale(name):
        out = {"salary": salary, "expected": expected, "ratio": round(ratio, 2),
               "label": "Rookie scale", "value_delta": 0.0, "dumpable": False}
        outlook = contract_outlook(name, season)
        if outlook:
            out.update({k: outlook[k] for k in
                        ("years_left", "option", "expires", "total_remaining_m", "future")})
        return out

    # "Bad contract" is reserved for genuinely egregious deals (ratio > 2.5, e.g.
    # Dorian Finney-Smith); a moderately rich deal for a real rotation player reads
    # "Overpaid" (e.g. Naz Reid), not bad. Bands are wide because the 0–100 proxy
    # value under-rates role players, which would otherwise inflate ratios.
    if ratio <= 0.55:
        label, delta = "Bargain", min(7.0, (0.55 - ratio) * 22)
    elif ratio <= 0.85:
        label, delta = "Value", (0.85 - ratio) * 8
    elif ratio <= 1.25:
        label, delta = "Fair", 0.0
    elif ratio <= 2.5:
        label, delta = "Overpaid", -min(7.0, (ratio - 1.25) * 6)
    else:
        label, delta = "Bad contract", -min(11.0, (ratio - 1.25) * 6)

    out = {
        "salary": salary,
        "expected": expected,
        "ratio": round(ratio, 2),
        "label": label,
        "value_delta": round(delta, 1),
        "dumpable": ratio > 1.60,
    }
    outlook = contract_outlook(name, season)
    if outlook:
        out.update({k: outlook[k] for k in
                    ("years_left", "option", "expires", "total_remaining_m", "future")})
    return out


# ── CBA salary-matching / legality ───────────────────────────────────────────

def team_apron_status(team, season=DEFAULT_SEASON):
    """Where a team sits vs the cap lines: room | over_cap | taxpayer |
    first_apron | second_apron. Governs how much salary it can take back."""
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    committed = team_committed(team, season)
    if committed is None:
        return "over_cap"
    if committed >= lines["apron2"]:  return "second_apron"
    if committed >= lines["apron1"]:  return "first_apron"
    if committed >= lines["tax"]:     return "taxpayer"
    if committed >= lines["cap"]:     return "over_cap"
    return "room"


def matchable_incoming(out_salary, status):
    """Max salary a team in `status` may take back for `out_salary` (simplified
    2023 CBA). Second-apron = dollar-for-dollar; apron/tax/over-cap = 125%+$250K;
    below the cap = 200%+$250K."""
    if status == "second_apron":
        return out_salary + 100_000
    if status in ("first_apron", "taxpayer", "over_cap"):
        return round(out_salary * 1.25 + 250_000)
    return round(out_salary * 2.0 + 250_000)


def trade_legal(out_salary, in_salary, status):
    """Is taking back `in_salary` for `out_salary` legal for a team in `status`?
    Returns (legal: bool, allowed: int, shortfall: int>=0)."""
    allowed = matchable_incoming(out_salary, status)
    legal = in_salary <= allowed
    if status == "second_apron":
        need_out = max(0, in_salary - 100_000)
    elif status in ("first_apron", "taxpayer", "over_cap"):
        need_out = max(0, round((in_salary - 250_000) / 1.25))
    else:
        need_out = max(0, round((in_salary - 250_000) / 2.0))
    shortfall = max(0, need_out - out_salary)
    return legal, allowed, shortfall


_STATUS_LABEL = {
    "room": "Cap Room", "over_cap": "Over Cap", "taxpayer": "Taxpayer",
    "first_apron": "First Apron", "second_apron": "Second Apron",
}


def apply_trade(team, out_salary, in_salary, season=DEFAULT_SEASON):
    """How a trade moves ONE team across the cap lines: payroll and apron status
    before vs after sending `out_salary` and taking back `in_salary`, plus whether
    the team can legally absorb the incoming money. Returns a display-ready dict."""
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    before = team_committed(team, season)
    if before is None:
        before = lines["cap"]   # assume a cap-team if unknown, so math still works
    after = before - out_salary + in_salary

    def _status(committed):
        if committed >= lines["apron2"]:  return "second_apron"
        if committed >= lines["apron1"]:  return "first_apron"
        if committed >= lines["tax"]:     return "taxpayer"
        if committed >= lines["cap"]:     return "over_cap"
        return "room"

    status_before, status_after = _status(before), _status(after)
    legal, allowed, shortfall = trade_legal(out_salary, in_salary, status_before)
    return {
        "team": team,
        "out_salary_m": _fmt_m(out_salary), "in_salary_m": _fmt_m(in_salary),
        "committed_before_m": _fmt_m(before), "committed_after_m": _fmt_m(after),
        "status_before": status_before, "status_after": status_after,
        "status_before_label": _STATUS_LABEL.get(status_before, status_before),
        "status_after_label": _STATUS_LABEL.get(status_after, status_after),
        "tax_after_m": _fmt_m(after - lines["tax"]),     # >0 = a taxpayer after
        "legal": legal, "allowed_m": _fmt_m(allowed),
        "shortfall_m": _fmt_m(shortfall),
    }


# ── Cap view payload ─────────────────────────────────────────────────────────

def get_cap_sheet(season=DEFAULT_SEASON):
    """Per-team cap summary: committed payroll vs the cap / tax / apron lines,
    sorted by payroll (biggest spenders first)."""
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    teams = []
    for team in _all_teams(season):
        total = team_committed(team, season)
        if total is None:
            continue
        status = team_apron_status(team, season)
        teams.append({
            "team": team,
            "committed": total,
            "committed_m": _fmt_m(total),
            "status": status,
            "over_cap_m": _fmt_m(total - lines["cap"]),
            "room_m": _fmt_m(lines["cap"] - total),
            "tax_m": _fmt_m(total - lines["tax"]),
        })
    teams.sort(key=lambda t: t["committed"], reverse=True)
    return {
        "season": season,
        "lines": {k: _fmt_m(v) for k, v in lines.items()},
        "lines_raw": lines,
        "teams": teams,
    }


def cap_relief_plan(team, season=DEFAULT_SEASON, value_lookup=None, roster=None):
    """For a team over the tax/apron, the most likely moves to get back under -
    the real front-office calculus, especially for teams 'well above the second
    apron'.

    Targets the highest line the team is over. Candidates are the team's ACTUAL
    roster (passed in `roster` from nba_api - who really plays there, so dead money
    / waived players on the cap sheet are excluded), shed worst-first (bad/overpaid
    deals, then vets), assuming each is moved for a minimum-salary replacement (net
    saving = salary − minimum). A team will NOT shed its best player or any
    star/cornerstone for cap relief - those are protected (they'd only move by
    request, and then via trade, not a salary dump). Returns None for teams in line.

    `value_lookup(name) -> 0–100 value` grades each contract and finds the team's
    best player to protect. `roster` is the list of player names actually on the
    team; if omitted, falls back to scraped/curated contracts filed under the team.
    """
    lines = CAP_BY_SEASON.get(season, CAP_BY_SEASON[DEFAULT_SEASON])
    committed = team_committed(team, season)
    if committed is None:
        return None
    status = team_apron_status(team, season)
    if status in ("room", "over_cap"):
        return None

    if committed >= lines["apron2"]:   target_name, target = "second apron", lines["apron2"]
    elif committed >= lines["apron1"]: target_name, target = "first apron", lines["apron1"]
    else:                              target_name, target = "luxury tax", lines["tax"]
    overage = committed - target

    # Candidate pool = the real roster (nba_api) if given, else contracts on file.
    if roster:
        names = list(dict.fromkeys(roster))
    else:
        names = [o["name"] for o in _SCRAPED_OUTLOOK.values()
                 if o.get("team") == team and o["salary_by_season"].get(season)] \
                or [n for n, c in CONTRACTS.items() if c.get("team") == team and c.get("salary")]

    # Identify the team's best player (by value) so we never recommend moving him.
    best_name = None
    if value_lookup:
        graded = [(n, value_lookup(n)) for n in names]
        graded = [(n, v) for n, v in graded if v is not None]
        if graded:
            best_name = max(graded, key=lambda x: x[1])[0]

    # Who a team sheds is a function of IMPORTANCE (on-court value) and SALARY.
    # Two distinct groups:
    #   • TRADES - meaningful salary (>= CUT_MAX) the team would trade, tiered:
    #       0 Overpaid / Bad contract (worst first) → 1 Fringe (low value) → 2 Rotation piece
    #   • POTENTIAL CUTS - small, low-importance deals (< CUT_MAX) a team could just
    #       waive for minor relief (not real trade chips, not big concerns).
    # Protected (never shed): the team's best player, stars by recognition
    # (star_floor>=76) OR by production (value>=STAR_VALUE, e.g. a multi-time
    # All-Star like Trae Young), and slotted rookie deals.
    FRINGE_VALUE = 46
    STAR_VALUE = 72
    STAR_SALARY = 40_000_000   # near-max money only goes to stars - never a cap dump
    CUT_MAX = 8_000_000
    cands, cuts = [], []
    for name in names:
        val = value_lookup(name) if value_lookup else None
        sal = get_salary(name, season, val)
        if sal <= _MIN_SALARY * 1.5:
            continue
        if (name == best_name or recognition.is_cornerstone(name)
                or recognition.star_floor(name, season) >= 76
                or (val is not None and val >= STAR_VALUE) or sal >= STAR_SALARY
                or is_young_core(name)):
            continue  # protected - franchise / star-caliber / max-salary / young core
        grade = contract_grade(name, val, season) if val is not None else {"label": "-", "ratio": None}
        if sal < CUT_MAX:
            # Small deals are "potential cuts" - but only genuine non-stars. A cheap
            # deal alone doesn't make someone cuttable (e.g. a young stud on his rookie
            # scale); and skip unknown-value players so we never suggest waiving a star.
            if val is not None and val < STAR_VALUE:
                cuts.append({"name": name, "salary_m": _fmt_m(sal), "label": "Fringe",
                             "action": "Waive", "saves_m": _fmt_m(sal - _MIN_SALARY)})
            continue
        label = grade.get("label")
        if label in ("Overpaid", "Bad contract"):
            tier, shed_label = 0, label
        elif val is not None and val < FRINGE_VALUE:
            tier, shed_label = 1, "Fringe"
        else:
            tier, shed_label = 2, "Rotation piece"
        cands.append({"name": name, "salary": sal, "salary_m": _fmt_m(sal),
                      "label": shed_label, "option": grade.get("option"),
                      "rank": (tier, -(grade.get("ratio") or 0) if tier == 0 else 0, -sal)})
    cands.sort(key=lambda x: x["rank"])
    cuts.sort(key=lambda c: c["saves_m"], reverse=True)

    moves, saved, max_tier = [], 0, -1
    for c in cands:
        if saved >= overage:
            break
        net = c["salary"] - _MIN_SALARY
        expiring_team_option = c["option"] == "TO" and (
            get_contract(c["name"]) or {}).get("years_left", 9) <= 1
        action = "Decline team option" if expiring_team_option else "Trade away"
        moves.append({"name": c["name"], "salary_m": c["salary_m"],
                      "label": c["label"], "action": action, "saves_m": _fmt_m(net)})
        saved += net
        max_tier = max(max_tier, c["rank"][0])

    reachable = saved >= overage
    movable = ", ".join(m["name"] for m in moves)
    if not moves:
        note = (f"No bad or movable contracts big enough to trade - this payroll is efficient "
                f"(stars + rookie-scale deals). Getting under the {target_name} would take a star trade."
                + (" Minor relief is possible by waiving the fringe deals below." if cuts else ""))
    elif not reachable:
        note = (f"Even trading {movable} (~${_fmt_m(saved)}M) leaves them over the {target_name}; "
                f"the rest is core salary, so a star trade would be required.")
    elif max_tier == 0:
        note = f"Trading the overpaid deal(s) - {movable} - clears ${_fmt_m(saved)}M, enough to dip under the {target_name}."
    elif max_tier == 1:
        note = (f"No clearly bad contract; trading fringe/depth salary ({movable}) frees "
                f"${_fmt_m(saved)}M to get under the {target_name}.")
    else:
        note = (f"No bad contracts here - getting under the {target_name} means trading a rotation "
                f"contributor ({movable}), not a salary dump.")
    return {
        "team": team,
        "status": status,
        "target_line": target_name,
        "committed_m": _fmt_m(committed),
        "target_m": _fmt_m(target),
        "overage_m": _fmt_m(overage),
        "best_player": best_name,
        "moves": moves,
        "potential_cuts": cuts[:5],
        "projected_saving_m": _fmt_m(saved),
        "gets_under": reachable,
        "note": note,
    }


def get_team_contracts(team, season=DEFAULT_SEASON):
    """One team's contracts for the season with the forward outlook on each.
    Scraped roster (real cap sheet, incl. dead money) when available, else curated."""
    rows = []
    scraped = [o["name"] for o in _SCRAPED_OUTLOOK.values()
               if o.get("team") == team and o["salary_by_season"].get(season)]
    if scraped:
        for name in scraped:
            o = contract_outlook(name, season)
            if not o:
                continue
            rows.append({
                "name": name, "salary": o["salary"], "salary_m": o["salary_m"],
                "years_left": o.get("years_left"), "option": o.get("option"),
                "expires": o.get("expires"), "total_remaining_m": o.get("total_remaining_m"),
            })
    else:
        for name, c in CONTRACTS.items():
            if c["team"] != team or not c.get("salary"):
                continue
            o = contract_outlook(name, season)
            rows.append({
                "name": name, "salary": c["salary"], "salary_m": _fmt_m(c["salary"]),
                "years_left": c.get("years_left"), "option": c.get("option"),
                "expires": c.get("expires"),
                "total_remaining_m": o["total_remaining_m"] if o else _fmt_m(c["salary"]),
            })
    rows.sort(key=lambda r: r["salary"], reverse=True)
    return rows
