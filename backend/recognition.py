"""
recognition.py — player recognition tiers (All-Star / Franchise Cornerstone)
and accent-safe name matching, shared by the trade value algorithm and the
trade-idea engine.

The NBA API returns accented names (e.g. "Luka Dončić", "Nikola Jokić") while
these sets use plain ASCII, so every comparison normalizes (strips diacritics,
lowercases) before checking membership.
"""

import unicodedata

# All-Star selections per season (used to floor/recognize star trade value).
ALL_STARS_BY_SEASON = {
    "2024-25": {
        "Alperen Sengun", "Luka Doncic",
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
        "Domantas Sabonis", "Darius Garland", "Evan Mobley",
        "Pascal Siakam", "Jalen Williams",
    },
    "2025-26": {
        # USA Stars
        "Scottie Barnes", "Devin Booker", "Cade Cunningham", "Jalen Duren",
        "Anthony Edwards", "Chet Holmgren", "Jalen Johnson", "Tyrese Maxey",
        # USA Stripes
        "Jaylen Brown", "Jalen Brunson", "Kevin Durant", "De'Aaron Fox",
        "Brandon Ingram", "LeBron James", "Kawhi Leonard", "Donovan Mitchell",
        # Team World (+ Curry, selected but injured)
        "Giannis Antetokounmpo", "Deni Avdija", "Luka Doncic",
        "Shai Gilgeous-Alexander", "Nikola Jokic", "Jamal Murray",
        "Alperen Sengun", "Stephen Curry",
    },
}

# Back-compat alias + union (used when a caller doesn't specify a season).
ALL_STARS_2025 = ALL_STARS_BY_SEASON["2024-25"]
_ALL_ALLSTARS  = set().union(*ALL_STARS_BY_SEASON.values())

# Genuinely untradable — would require 4-5 first-rounders + multiple quality players.
# Anchored to All-NBA First Team (the top-5 by season), the truest "can't be had" tier.
CORNERSTONES_BY_SEASON = {
    "2024-25": {
        "Nikola Jokic", "Shai Gilgeous-Alexander", "Luka Doncic",
        "Victor Wembanyama", "Giannis Antetokounmpo",
        "Jayson Tatum", "Anthony Edwards",
    },
    "2025-26": {  # All-NBA First Team
        "Cade Cunningham", "Luka Doncic", "Shai Gilgeous-Alexander",
        "Nikola Jokic", "Victor Wembanyama",
    },
}
FRANCHISE_CORNERSTONES = CORNERSTONES_BY_SEASON["2024-25"]   # back-compat alias
_ALL_CORNERSTONES = set().union(*CORNERSTONES_BY_SEASON.values())

# All-NBA teams per season (1st team = the cornerstone set above). Drives the
# star-value hierarchy so acquisition cost scales with how elite a player is.
ALL_NBA_BY_SEASON = {
    "2025-26": {
        2: {"Jaylen Brown", "Kawhi Leonard", "Donovan Mitchell", "Kevin Durant", "Jalen Brunson"},
        3: {"Tyrese Maxey", "Jamal Murray", "Jalen Johnson", "Jalen Duren", "Chet Holmgren"},
    },
}
# Name-brand superstars who command a superstar haul even when they miss an All-NBA
# team in a given year (injury / down season) — recent MVPs & perennial stars.
LEGACY_SUPERSTARS_BY_SEASON = {
    "2025-26": {"Giannis Antetokounmpo", "Joel Embiid", "Anthony Davis", "Devin Booker"},
}

# Defensive recognition tiers (All-Defensive teams + notable DPOY/All-Def vote-getters).
# Used to fix the proxy value model under-weighting elite defense (e.g. Amen Thompson).
ALL_DEFENSIVE_BY_SEASON = {
    "2025-26": {
        1: {  # All-Defensive First Team
            "Victor Wembanyama", "Chet Holmgren", "Ausar Thompson",
            "Rudy Gobert", "Derrick White",
        },
        2: {  # All-Defensive Second Team
            "Scottie Barnes", "Cason Wallace", "Bam Adebayo",
            "OG Anunoby", "Dyson Daniels",
        },
        3: {  # Received notable All-Defensive / DPOY votes (honorable mention)
            "Stephon Castle", "Amen Thompson", "Draymond Green", "Toumani Camara",
            "Kris Dunn", "Evan Mobley", "Luguentz Dort", "Jalen Duren",
            "Neemias Queta", "Jaylen Brown", "Kawhi Leonard", "Jaden McDaniels",
            "Donovan Clingan", "Shai Gilgeous-Alexander", "Jabari Smith Jr.",
            "Alex Caruso",   # perennial All-Defensive guard — elite point-of-attack D
        },
    },
}


def norm_name(s):
    return "".join(
        c for c in unicodedata.normalize("NFKD", str(s)) if not unicodedata.combining(c)
    ).lower().strip()


_ALLSTARS_NORM_BY_SEASON = {
    season: {norm_name(n) for n in names} for season, names in ALL_STARS_BY_SEASON.items()
}
_ALL_ALLSTARS_NORM = {norm_name(n) for n in _ALL_ALLSTARS}
_CORNERSTONES_NORM_BY_SEASON = {
    season: {norm_name(n) for n in names} for season, names in CORNERSTONES_BY_SEASON.items()
}
_ALL_CORNERSTONES_NORM = {norm_name(n) for n in _ALL_CORNERSTONES}
_ALLDEF_NORM_BY_SEASON = {
    season: {tier: {norm_name(n) for n in names} for tier, names in tiers.items()}
    for season, tiers in ALL_DEFENSIVE_BY_SEASON.items()
}
_ALLNBA_NORM_BY_SEASON = {
    season: {tier: {norm_name(n) for n in names} for tier, names in tiers.items()}
    for season, tiers in ALL_NBA_BY_SEASON.items()
}
_LEGACY_NORM_BY_SEASON = {
    season: {norm_name(n) for n in names} for season, names in LEGACY_SUPERSTARS_BY_SEASON.items()
}


def is_cornerstone(name, season=None):
    """Untradable-tier check. Pass `season` for that season's All-NBA First Team;
    omit for the union across known seasons (back-compat for season-agnostic callers)."""
    pool = _CORNERSTONES_NORM_BY_SEASON.get(season, _ALL_CORNERSTONES_NORM)
    return norm_name(name) in pool


def is_allstar(name, season=None):
    """All-Star check. Pass `season` for that season's roster; omit for the
    union across known seasons (back-compat for season-agnostic callers)."""
    pool = _ALLSTARS_NORM_BY_SEASON.get(season, _ALL_ALLSTARS_NORM)
    return is_cornerstone(name, season) or norm_name(name) in pool


def star_floor(name, season=None):
    """Minimum 0–100 trade value a player commands by reputation tier, so acquisition
    cost scales with how elite he is (a superstar isn't valued like a baseline All-Star):
      All-NBA 1st / cornerstone 97 · All-NBA 2nd 88 · legacy superstar 86 ·
      All-NBA 3rd 82 · All-Star 76 · else 0 (stat-driven).
    """
    if is_cornerstone(name, season):
        return 97
    n = norm_name(name)
    tiers = _ALLNBA_NORM_BY_SEASON.get(season, {})
    if n in tiers.get(2, set()):
        return 88
    if n in _LEGACY_NORM_BY_SEASON.get(season, set()):
        return 86
    if n in tiers.get(3, set()):
        return 82
    if is_allstar(name, season):
        return 76
    return 0


def defensive_tier(name, season=None):
    """0 = none, 1 = All-Defensive 1st team, 2 = 2nd team, 3 = received D votes.
    (Lower number = stronger defensive recognition.)"""
    tiers = _ALLDEF_NORM_BY_SEASON.get(season)
    if not tiers:
        return 0
    n = norm_name(name)
    for tier in (1, 2, 3):
        if n in tiers.get(tier, set()):
            return tier
    return 0


def defensive_recognition(name, season=None):
    """0–100 defensive recognition score for the value model."""
    return {1: 100, 2: 78, 3: 50}.get(defensive_tier(name, season), 0)
