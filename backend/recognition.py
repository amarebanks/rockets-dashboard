"""
recognition.py — player recognition tiers (All-Star / Franchise Cornerstone)
and accent-safe name matching, shared by the trade value algorithm and the
trade-idea engine.

The NBA API returns accented names (e.g. "Luka Dončić", "Nikola Jokić") while
these sets use plain ASCII, so every comparison normalizes (strips diacritics,
lowercases) before checking membership.
"""

import unicodedata

ALL_STARS_2025 = {
    "Alperen Sengun", "Jalen Green", "Luka Doncic",
    "Nikola Jokic", "Shai Gilgeous-Alexander", "LeBron James",
    "Anthony Davis", "Stephen Curry", "Anthony Edwards",
    "Victor Wembanyama", "Kevin Durant", "Devin Booker",
    "De'Aaron Fox", "Draymond Green",
    "Giannis Antetokounmpo", "Jayson Tatum", "Jaylen Brown",
    "Karl-Anthony Towns", "Donovan Mitchell", "Damian Lillard",
    "Cade Cunningham", "Tyrese Haliburton", "Bam Adebayo",
    "Jaren Jackson Jr.", "Trae Young", "Paolo Banchero",
    "Jalen Brunson", "James Harden", "Kawhi Leonard",
    "Jimmy Butler", "Zach LaVine", "Tyler Herro", "Ja Morant",
}

# Genuinely untradable — would require 4-5 first-rounders + multiple quality players
FRANCHISE_CORNERSTONES = {
    "Nikola Jokic", "Shai Gilgeous-Alexander", "Luka Doncic",
    "Victor Wembanyama", "Giannis Antetokounmpo",
    "Jayson Tatum", "Anthony Edwards",
}


def norm_name(s):
    return "".join(
        c for c in unicodedata.normalize("NFKD", str(s)) if not unicodedata.combining(c)
    ).lower().strip()


_ALLSTARS_NORM     = {norm_name(n) for n in ALL_STARS_2025}
_CORNERSTONES_NORM = {norm_name(n) for n in FRANCHISE_CORNERSTONES}


def is_cornerstone(name):
    return norm_name(name) in _CORNERSTONES_NORM


def is_allstar(name):
    return is_cornerstone(name) or norm_name(name) in _ALLSTARS_NORM
