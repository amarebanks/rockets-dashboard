"""
spotrac_scraper.py — snapshot NBA salary data from Spotrac into JSON files that
contracts.py loads (replacing the hand-curated cap/contract estimates).

Scrapes two things per cap year (Spotrac keys by START year: 2026 == 2026-27):
  • TEAM CAP TOTALS  (cover page /nba/cap/_/year/<yr>)  → spotrac_cap_<yr>.json
  • PER-PLAYER CONTRACTS (each team page)               → spotrac_players_<yr>.json
and merges multiple years into a forward-looking per-player view → spotrac_contracts.json
(salary_by_season, so contracts.py can show current + future cap hits).

Why this design:
  • Spotrac blocks bots — a real-browser User-Agent is REQUIRED (a default fetcher
    gets HTTP 403). With the UA below it returns 200 + full HTML tables.
  • Built-in html.parser only — runs on a clean install (no lxml/bs4 needed).
  • Snapshot, don't fetch live: contract data moves slowly, so scrape occasionally,
    commit the JSON, and keep request volume low (faster + ToS-friendlier).

Run:   python spotrac_scraper.py              # both seasons (2025-26 + 2026-27)
       python spotrac_scraper.py 2026         # just 2026-27
       python spotrac_scraper.py 2025 2026     # explicit list

Be a good citizen: personal use, low volume, ~1s between requests, and re-verify a
couple of figures against the site after a run.
"""

import json
import os
import sys
import time
import urllib.request
from datetime import date
from html.parser import HTMLParser

DEFAULT_YEARS = [2025, 2026]          # 2025-26 (current app season) + 2026-27 (future)
REQUEST_DELAY = 1.0                   # seconds between team requests — be polite

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# abbr → Spotrac team slug (la-clippers / los-angeles-lakers / portland-trail-blazers
# are the irregular ones). Edit if Spotrac ever renames a slug.
TEAM_SLUGS = {
    "ATL": "atlanta-hawks", "BOS": "boston-celtics", "BKN": "brooklyn-nets",
    "CHA": "charlotte-hornets", "CHI": "chicago-bulls", "CLE": "cleveland-cavaliers",
    "DAL": "dallas-mavericks", "DEN": "denver-nuggets", "DET": "detroit-pistons",
    "GSW": "golden-state-warriors", "HOU": "houston-rockets", "IND": "indiana-pacers",
    "LAC": "la-clippers", "LAL": "los-angeles-lakers", "MEM": "memphis-grizzlies",
    "MIA": "miami-heat", "MIL": "milwaukee-bucks", "MIN": "minnesota-timberwolves",
    "NOP": "new-orleans-pelicans", "NYK": "new-york-knicks", "OKC": "oklahoma-city-thunder",
    "ORL": "orlando-magic", "PHI": "philadelphia-76ers", "PHX": "phoenix-suns",
    "POR": "portland-trail-blazers", "SAC": "sacramento-kings", "SAS": "san-antonio-spurs",
    "TOR": "toronto-raptors", "UTA": "utah-jazz", "WAS": "washington-wizards",
}


def _season_str(year):
    return f"{year}-{str(year + 1)[2:]}"


def _get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def _dollars(s):
    s = (s or "").replace("$", "").replace(",", "").strip()
    if not s or s == "-":
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


# ── Cover-page team cap table ────────────────────────────────────────────────
# Columns (verified): 0 Rank · 1 Team · 2 Record · 3 Players · 4 AvgAge ·
# 5 Total Cap Allocations · 6 Cap Space · 7 Active · 8 Active Top3 · 9 Dead Cap
class _CapTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self._cur, self._cell, self._buf, self._d = [], None, None, "", 0

    def handle_starttag(self, t, a):
        if t == "table": self._d += 1
        elif self._d and t == "tr": self._cur = []
        elif self._d and t in ("td", "th"): self._cell, self._buf = [], ""

    def handle_endtag(self, t):
        if self._d and t in ("td", "th") and self._cell is not None:
            self._cur.append(self._buf.strip()); self._cell = None
        elif self._d and t == "tr" and self._cur is not None:
            if self._cur: self.rows.append(self._cur)
            self._cur = None
        elif t == "table" and self._d: self._d -= 1

    def handle_data(self, d):
        if self._cell is not None: self._buf += d


def _abbr(cell):
    for tok in cell.split():
        tok = tok.strip()
        if tok.isalpha() and 2 <= len(tok) <= 3:
            return tok.upper()
    return ""


def fetch_cap_totals(year):
    p = _CapTable(); p.feed(_get(f"https://www.spotrac.com/nba/cap/_/year/{year}"))
    teams, cap_line = {}, None
    for row in p.rows:
        if len(row) < 10 or not row[0].strip().isdigit():
            continue
        ab, total, space = _abbr(row[1]), _dollars(row[5]), _dollars(row[6])
        if not ab or total is None:
            continue
        if cap_line is None and space is not None:
            cap_line = total + space
        teams[ab] = {"committed": total, "active": _dollars(row[7]), "dead_cap": _dollars(row[9])}
    return teams, cap_line


# ── Per-team player contracts ────────────────────────────────────────────────
# Each player cell: <span class="d-none">Surname</span><a href=".../player/_/id/..">Full Name</a>
# Columns: 0 Player · 1 Pos · 2 Age · 3 Type · 4 Cap Hit · … · 10 Guaranteed
class _PlayerTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self._cur = self._cell = None
        self._buf = self._nbuf = ""
        self._d = 0
        self._in_dnone = self._in_plink = False
        self._name = None

    def handle_starttag(self, t, a):
        ad = dict(a)
        if t == "table": self._d += 1
        elif self._d and t == "tr": self._cur = []; self._name = None
        elif self._d and t in ("td", "th"): self._cell, self._buf = [], ""
        elif self._d and t == "span" and ad.get("class") == "d-none": self._in_dnone = True
        elif self._d and t == "a" and "/player/_/id/" in ad.get("href", ""):
            self._in_plink, self._nbuf = True, ""

    def handle_endtag(self, t):
        if t == "span" and self._in_dnone: self._in_dnone = False
        elif t == "a" and self._in_plink:
            self._in_plink = False
            if not self._name:
                self._name = self._nbuf.strip()
        elif self._d and t in ("td", "th") and self._cell is not None:
            self._cur.append(self._buf.strip()); self._cell = None
        elif self._d and t == "tr" and self._cur is not None:
            if self._cur: self.rows.append((self._name, self._cur))
            self._cur = None
        elif t == "table" and self._d: self._d -= 1

    def handle_data(self, d):
        if self._in_plink: self._nbuf += d
        if self._cell is not None and not self._in_dnone: self._buf += d


def fetch_team_players(slug, year):
    p = _PlayerTable(); p.feed(_get(f"https://www.spotrac.com/nba/{slug}/cap/_/year/{year}"))
    out = []
    for name, row in p.rows:
        if not name or len(row) < 5:
            continue
        cap = _dollars(row[4])
        if cap is None:
            continue   # skip header / non-salary rows
        out.append({
            "name": name,
            "pos": row[1] if len(row) > 1 else None,
            "age": int(row[2]) if len(row) > 2 and row[2].strip().isdigit() else None,
            "type": row[3] if len(row) > 3 else None,
            "salary": cap,
            "guaranteed": _dollars(row[10]) if len(row) > 10 else None,
        })
    return out


def scrape_players(year):
    players, failed = {}, []
    for ab, slug in TEAM_SLUGS.items():
        try:
            roster = fetch_team_players(slug, year)
            if not roster:
                failed.append(ab); continue
            for pl in roster:
                players[pl["name"]] = {**pl, "team": ab}
            print(f"    {ab}: {len(roster)} players")
        except Exception as e:
            failed.append(ab); print(f"    {ab}: FAILED ({e})")
        time.sleep(REQUEST_DELAY)
    if failed:
        print(f"  ! check slugs for: {', '.join(failed)}")
    return players


def _write(name, payload):
    path = os.path.join(os.path.dirname(__file__), name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return os.path.basename(path)


def main():
    args = [a for a in sys.argv[1:] if a.isdigit()]
    env = os.getenv("SPOTRAC_YEARS") or os.getenv("SPOTRAC_YEAR")
    years = [int(a) for a in args] or ([int(y) for y in env.split(",")] if env else DEFAULT_YEARS)

    merged = {}   # full name → {team, pos, salary_by_season}
    for year in years:
        season = _season_str(year)
        print(f"\n=== {season} ===")
        teams, cap_line = fetch_cap_totals(year)
        print(f"  cap totals: {len(teams)} teams · cap ${(cap_line or 0)/1e6:.1f}M")
        _write(f"spotrac_cap_{year}.json", {
            "season": season, "cap_year": year, "cap_line": cap_line,
            "scraped_at": date.today().isoformat(), "teams": teams,
        })
        print("  player contracts:")
        players = scrape_players(year)
        _write(f"spotrac_players_{year}.json", {
            "season": season, "cap_year": year,
            "scraped_at": date.today().isoformat(), "players": players,
        })
        for name, p in players.items():
            m = merged.setdefault(name, {"team": p["team"], "pos": p["pos"], "salary_by_season": {}})
            m["team"] = p["team"]              # latest scraped year wins for current team
            m["type"] = p.get("type")          # contract type (RK-1ST/RK-2ND = rookie scale, etc.)
            m["salary_by_season"][season] = p["salary"]

    f3 = _write("spotrac_contracts.json", {
        "scraped_at": date.today().isoformat(),
        "seasons": [_season_str(y) for y in years],
        "players": merged,
    })
    print(f"\nMerged {len(merged)} players across {len(years)} season(s) → {f3}")


if __name__ == "__main__":
    main()
