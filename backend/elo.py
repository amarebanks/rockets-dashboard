"""
elo.py — League-wide Elo ratings for game prediction.

Pulls every team's regular-season game results for the season from the NBA
stats API (one LeagueGameLog call returns all 30 teams' games), then runs a
FiveThirtyEight-style Elo model chronologically. The resulting per-team
ratings drive the /predict endpoints.

Ratings are computed once and cached in-process, since a completed season's
results never change.
"""

import time
import math
from nba_api.stats.endpoints import leaguegamelog

# ── Model constants ─────────────────────────────────────────────────────────
START_ELO   = 1500.0   # every team begins the season here
K_FACTOR    = 20.0     # how fast ratings move per game
HOME_ADV    = 100.0    # home-court advantage, in Elo points (~3.5 pts of spread)
ELO_PER_PT  = 28.0     # Elo points ≈ one point of expected margin (538 rule of thumb)
HOME_PTS    = 1.5      # points added to the home side's projected score

_CACHE = {}   # season -> {"ratings":..., "built_at":...}
_CACHE_TTL = 6 * 60 * 60  # 6 hours


def _expected(rating_a, rating_b):
    """Probability that A beats B given their (HCA-adjusted) ratings."""
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))


def _mov_multiplier(margin, winner_elo_diff):
    """538 margin-of-victory multiplier — bigger wins move Elo more, with an
    autocorrelation correction so favorites don't get over-rewarded."""
    return ((abs(margin) + 3.0) ** 0.8) / (7.5 + 0.006 * winner_elo_diff)


def _build_ratings(season, season_type="Regular Season"):
    """Fetch the full season and run the Elo model. Returns a dict keyed by
    team abbreviation with elo, record, and scoring averages."""
    log = leaguegamelog.LeagueGameLog(
        season=season, season_type_all_star=season_type
    )
    df = log.get_data_frames()[0]
    if df.empty:
        return {}

    # Each game_id has two rows (one per team). Pair them up into games.
    games = {}
    for _, r in df.iterrows():
        gid = r["GAME_ID"]
        side = {
            "abbr":   r["TEAM_ABBREVIATION"],
            "name":   r["TEAM_NAME"],
            "pts":    int(r["PTS"]) if r["PTS"] is not None else 0,
            "home":   "vs." in r["MATCHUP"],   # "HOU vs. LAL" = home, "HOU @ LAL" = away
            "date":   r["GAME_DATE"],
            "wl":     r["WL"],
        }
        games.setdefault(gid, []).append(side)

    # Keep only fully-paired games, sorted chronologically.
    paired = [(gid, sides) for gid, sides in games.items() if len(sides) == 2]
    paired.sort(key=lambda x: x[1][0]["date"])

    teams = {}  # abbr -> rating/record/scoring accumulator

    def ensure(side):
        if side["abbr"] not in teams:
            teams[side["abbr"]] = {
                "abbr": side["abbr"], "name": side["name"], "elo": START_ELO,
                "wins": 0, "losses": 0, "pts_for": 0, "pts_against": 0, "gp": 0,
            }
        return teams[side["abbr"]]

    for _, sides in paired:
        home = sides[0] if sides[0]["home"] else sides[1]
        away = sides[1] if sides[0]["home"] else sides[0]
        th, ta = ensure(home), ensure(away)

        # Expectation with home-court advantage baked into the home rating.
        exp_home = _expected(th["elo"] + HOME_ADV, ta["elo"])
        home_won = home["pts"] > away["pts"]
        s_home = 1.0 if home_won else 0.0

        margin = home["pts"] - away["pts"]
        winner_diff = (th["elo"] + HOME_ADV - ta["elo"]) if home_won \
            else (ta["elo"] - th["elo"] - HOME_ADV)
        mult = _mov_multiplier(margin, winner_diff)

        delta = K_FACTOR * mult * (s_home - exp_home)
        th["elo"] += delta
        ta["elo"] -= delta

        # Records + scoring totals for projected scores.
        for t, scored, allowed, won in (
            (th, home["pts"], away["pts"], home_won),
            (ta, away["pts"], home["pts"], not home_won),
        ):
            t["gp"] += 1
            t["pts_for"] += scored
            t["pts_against"] += allowed
            if won:
                t["wins"] += 1
            else:
                t["losses"] += 1

    # Finalize derived fields.
    for t in teams.values():
        gp = max(t["gp"], 1)
        t["elo"] = round(t["elo"], 1)
        t["off_ppg"] = round(t["pts_for"] / gp, 1)
        t["def_ppg"] = round(t["pts_against"] / gp, 1)
    return teams


def get_ratings(season, season_type="Regular Season", force=False):
    """Return cached league ratings for a season, rebuilding if stale or missing.
    Cached per-season so toggling the dashboard's season doesn't thrash rebuilds."""
    now = time.time()
    entry = _CACHE.get(season)
    if force or entry is None or now - entry["built_at"] > _CACHE_TTL:
        _CACHE[season] = {"ratings": _build_ratings(season, season_type), "built_at": now}
    return _CACHE[season]["ratings"]


def predict(home_team, away_team, ratings):
    """Predict a single matchup. `home_team`/`away_team` are dicts from
    get_ratings(). Returns win probabilities, projected score, and the spread."""
    rh, ra = home_team["elo"], away_team["elo"]
    p_home = _expected(rh + HOME_ADV, ra)
    p_away = 1.0 - p_home

    # Projected points: blend each team's offense with the other's defense,
    # then give the home side a small boost.
    home_pts = (home_team["off_ppg"] + away_team["def_ppg"]) / 2 + HOME_PTS
    away_pts = (away_team["off_ppg"] + home_team["def_ppg"]) / 2 - HOME_PTS

    # Nudge the projected margin toward what Elo implies, so the score and the
    # win probability tell a consistent story.
    elo_margin = (rh + HOME_ADV - ra) / ELO_PER_PT      # expected home margin
    score_margin = home_pts - away_pts
    adjust = (elo_margin - score_margin) / 2
    home_pts += adjust
    away_pts -= adjust

    return {
        "home_win_prob": round(p_home * 100, 1),
        "away_win_prob": round(p_away * 100, 1),
        "home_proj_score": round(home_pts),
        "away_proj_score": round(away_pts),
        "projected_spread": round(home_pts - away_pts, 1),
        "favorite": home_team["abbr"] if p_home >= 0.5 else away_team["abbr"],
    }
