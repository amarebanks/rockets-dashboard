"""
accolades.py - official end-of-season honors per player, for the Accolades display
on Player Profile and Compare.

Sourced from the 2025-26 NBA awards voting (MVP, ROY, DPOY, 6MOY, MIP, Clutch POY,
All-NBA, All-Defensive, All-Rookie). Keyed by accent-safe normalized name. All-Star
selections are merged in from recognition.py at lookup time. Earlier seasons fall back
to All-Star badges only (no full voting tables loaded).
"""

import recognition

# season -> {player name: [honor labels, most prestigious first]}
ACCOLADES_BY_SEASON = {
    "2025-26": {
        # ── Award winners ───────────────────────────────────────────────
        "Shai Gilgeous-Alexander": ["MVP", "Clutch POY", "All-NBA 1st Team"],
        "Cooper Flagg":            ["Rookie of the Year", "All-Rookie 1st Team"],
        "Victor Wembanyama":       ["Defensive POY", "All-NBA 1st Team", "All-Defensive 1st Team"],
        "Keldon Johnson":          ["Sixth Man of the Year"],
        "Nickeil Alexander-Walker":["Most Improved Player"],

        # ── All-NBA (remaining) ─────────────────────────────────────────
        "Nikola Jokic":     ["All-NBA 1st Team"],
        "Luka Doncic":      ["All-NBA 1st Team"],
        "Cade Cunningham":  ["All-NBA 1st Team"],
        "Jaylen Brown":     ["All-NBA 2nd Team"],
        "Kawhi Leonard":    ["All-NBA 2nd Team"],
        "Donovan Mitchell": ["All-NBA 2nd Team"],
        "Kevin Durant":     ["All-NBA 2nd Team"],
        "Jalen Brunson":    ["All-NBA 2nd Team"],
        "Tyrese Maxey":     ["All-NBA 3rd Team"],
        "Jamal Murray":     ["All-NBA 3rd Team"],
        "Jalen Johnson":    ["All-NBA 3rd Team"],
        "Jalen Duren":      ["All-NBA 3rd Team", "Most Improved (2nd)"],
        "Chet Holmgren":    ["All-NBA 3rd Team", "All-Defensive 1st Team"],

        # ── All-Defensive (remaining) ───────────────────────────────────
        "Ausar Thompson": ["All-Defensive 1st Team"],
        "Rudy Gobert":    ["All-Defensive 1st Team"],
        "Derrick White":  ["All-Defensive 1st Team"],
        "Scottie Barnes": ["All-Defensive 2nd Team"],
        "Cason Wallace":  ["All-Defensive 2nd Team"],
        "Bam Adebayo":    ["All-Defensive 2nd Team"],
        "OG Anunoby":     ["All-Defensive 2nd Team"],
        "Dyson Daniels":  ["All-Defensive 2nd Team", "Most Improved (Votes)"],

        # ── All-Rookie (remaining) ──────────────────────────────────────
        "VJ Edgecombe":        ["All-Rookie 1st Team"],
        "Kon Knueppel":        ["All-Rookie 1st Team", "ROY (2nd)"],
        "Dylan Harper":        ["All-Rookie 1st Team"],
        "Cedric Coward":       ["All-Rookie 1st Team"],
        "Maxime Raynaud":      ["All-Rookie 2nd Team"],
        "Derik Queen":         ["All-Rookie 2nd Team"],
        "Jeremiah Fears":      ["All-Rookie 2nd Team"],
        "Ace Bailey":          ["All-Rookie 2nd Team"],
        "Collin Murray-Boyles":["All-Rookie 2nd Team"],

        # ── Notable vote-getters (incl. all Rockets who placed) ─────────
        "Amen Thompson":     ["All-Defensive (Votes)", "Defensive POY (8th)"],
        "Reed Sheppard":     ["Sixth Man (6th)", "Most Improved (Votes)"],
        "Alperen Sengun":    ["All-NBA (Votes)"],
        "Jabari Smith Jr.":  ["All-Defensive (Votes)"],
        "Deni Avdija":       ["Most Improved (3rd)", "All-NBA (Votes)"],
        "Karl-Anthony Towns":["All-NBA (Votes)"],
        "James Harden":      ["All-NBA (Votes)"],
        "Stephon Castle":    ["All-NBA (Votes)", "All-Defensive (Votes)"],
        "LaMelo Ball":       ["All-NBA (Votes)"],
        "Brandon Ingram":    ["All-NBA (Votes)"],
        "Evan Mobley":       ["All-NBA (Votes)", "All-Defensive (Votes)"],
        "Anthony Edwards":   ["Clutch POY (3rd)"],
    },
}

_BY_SEASON_NORM = {
    season: {recognition.norm_name(n): labels for n, labels in players.items()}
    for season, players in ACCOLADES_BY_SEASON.items()
}


def get_accolades(name, season=None):
    """Return the honor labels for a player in a season (most prestigious first).
    All-Star is appended when the player has no higher All-NBA selection."""
    labels = list(_BY_SEASON_NORM.get(season, {}).get(recognition.norm_name(name), []))
    if recognition.is_allstar(name, season) and not any("All-NBA" in l for l in labels):
        labels.append("All-Star")
    return labels
