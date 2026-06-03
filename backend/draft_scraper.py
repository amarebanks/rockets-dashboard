"""
draft_scraper.py — snapshot every NBA team's future draft-pick ownership from
Fanspo into a JSON file that draft.py loads (replacing the old hand-curated,
Houston-only ROCKETS_PICKS).

Why Fanspo: it's a Next.js app that ships the full pick ledger as clean embedded
JSON (`__NEXT_DATA__` → Apollo cache), including protections and swap rights — far
cleaner than RealGM (Cloudflare-blocked) or Spotrac (no future-pick data). Pages
are keyed by a numeric teamId 1–30 and are slug-agnostic, so we just iterate ids.

KEY FACTS (verified live):
  • Full browser headers REQUIRED (Sec-Fetch-* + Upgrade-Insecure-Requests), else
    some requests are refused. Built-in json/urllib only — no extra deps.
  • Each DraftPick: {year, round, from, to, details}. `to == ""` → the team keeps
    the pick (incoming asset); `to` naming the team itself → a swap right it holds;
    `to` naming other teams → outgoing. `from` names where an acquired pick came from.

Run periodically to keep ownership current:
    python draft_scraper.py
Output: draft_picks.json  → {scraped_at, season, teams: {TRI: {team_id, picks:[…]}}}

Be a good citizen: low volume, ~0.8s between requests, personal use.
"""

import json
import os
import re
import sys
import time
import urllib.request
from datetime import date

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none", "Upgrade-Insecure-Requests": "1",
}
TEAM_IDS = range(1, 31)          # Fanspo NBA teamId 1..30
REQUEST_DELAY = 0.8
_NEXT = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def _fetch_team(team_id):
    url = f"https://fanspo.com/nba/teams/_/{team_id}/draft-picks"   # slug-agnostic
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", "ignore")
    m = _NEXT.search(html)
    if not m:
        raise ValueError("no __NEXT_DATA__ blob")
    apollo = json.loads(m.group(1))["props"]["pageProps"]["apolloState"]

    profile = next((v for k, v in apollo.items() if k.startswith("nba_TeamProfile:")), {})
    tri = profile.get("triName", str(team_id))
    season = profile.get("seasonId", "")

    picks = []
    for k, v in apollo.items():
        if not k.startswith("nba_DraftPick:") or not v.get("isActive", True):
            continue
        # Strip Fanspo's trade-citation brackets (e.g. "[…from HOU]") everywhere —
        # they can contain a team code that would confuse direction classification.
        _debracket = lambda s: re.sub(r"\s*\[[^\]]*\]", "", (s or "")).strip()
        frm = _debracket(v.get("from"))
        to = _debracket(v.get("to"))
        details = _debracket(v.get("details"))
        # Direction: empty `to` = the team keeps/selects it; `to` naming the team
        # itself = a swap right it holds (still an asset); otherwise it's outgoing.
        if to == "" or tri in to:
            direction = "swap" if ("swap" in to.lower() or "swap" in frm.lower()) else "incoming"
        else:
            direction = "outgoing"
        picks.append({
            "year": v.get("year"), "round": v.get("round"),
            "from": frm, "to": to, "details": details, "direction": direction,
        })
    picks.sort(key=lambda p: (p["year"] or 0, p["round"] or 0))
    return tri, season, picks


def main():
    teams, season = {}, ""
    failed = []
    for tid in TEAM_IDS:
        try:
            tri, s, picks = _fetch_team(tid)
            season = season or s
            teams[tri] = {"team_id": tid, "picks": picks}
            inc = sum(1 for p in picks if p["direction"] != "outgoing")
            print(f"  {tri:>3} (id {tid:>2}): {len(picks)} picks, {inc} held")
        except Exception as e:
            failed.append(tid); print(f"  id {tid}: FAILED ({e})")
        time.sleep(REQUEST_DELAY)

    if not teams:
        print("No teams parsed — Fanspo may have changed its markup or blocked the request.")
        sys.exit(1)
    if failed:
        print(f"  ! failed ids: {failed}")

    payload = {"scraped_at": date.today().isoformat(), "season": season, "teams": teams}
    path = os.path.join(os.path.dirname(__file__), "draft_picks.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"\n{len(teams)} teams · season {season} → {os.path.basename(path)}")


if __name__ == "__main__":
    print("Scraping NBA future draft-pick ownership from Fanspo…")
    main()
