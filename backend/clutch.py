"""
clutch.py - Houston's clutch performance (NBA's official clutch definition:
last 5 minutes, score within 5 points).

Pulls team + player clutch box scores once from nba_api and derives accurate
shooting splits (box-score totals, never per-game averages) plus a TS%-based
clutch rating. Cached in-process since a completed season doesn't change.
"""

import time
from nba_api.stats.endpoints import leaguedashplayerclutch, leaguedashteamclutch

ROCKETS_ID = 1610612745
MIN_CLUTCH_MIN = 15      # ignore tiny samples (garbage-time noise)

_CACHE = {"data": None, "built_at": 0.0, "season": None}
_TTL = 6 * 60 * 60


def _f(row, col, default=0.0):
    try:
        v = float(row.get(col))
        return default if v != v else v
    except (TypeError, ValueError):
        return default


def _ts_pct(pts, fga, fta):
    denom = 2 * (fga + 0.44 * fta)
    return round(pts / denom, 3) if denom > 0 else 0.0


def _pct(made, att):
    return round(made / att, 3) if att > 0 else 0.0


def _fetch_team(season):
    df = leaguedashteamclutch.LeagueDashTeamClutch(
        season=season, season_type_all_star="Regular Season",
        measure_type_detailed_defense="Base", per_mode_detailed="Totals",
        clutch_time="Last 5 Minutes", ahead_behind="Ahead or Behind", point_diff=5,
    ).get_data_frames()[0]
    row = df[df["TEAM_ID"] == ROCKETS_ID]
    if row.empty:
        return None
    r = row.iloc[0]
    w, l = int(_f(r, "W")), int(_f(r, "L"))
    return {
        "gp": int(_f(r, "GP")), "w": w, "l": l,
        "w_pct": round(_f(r, "W_PCT"), 3),
        "pts": round(_f(r, "PTS"), 1),
        "fg_pct": round(_f(r, "FG_PCT"), 3),
        "fg3_pct": round(_f(r, "FG3_PCT"), 3),
        "plus_minus": round(_f(r, "PLUS_MINUS"), 1),
    }


def _fetch_players(season):
    df = leaguedashplayerclutch.LeagueDashPlayerClutch(
        season=season, season_type_all_star="Regular Season",
        team_id_nullable=ROCKETS_ID,
        measure_type_detailed_defense="Base", per_mode_detailed="Totals",
        clutch_time="Last 5 Minutes", ahead_behind="Ahead or Behind", point_diff=5,
    ).get_data_frames()[0]

    players = []
    for _, r in df.iterrows():
        mins = _f(r, "MIN")
        if mins < MIN_CLUTCH_MIN:
            continue
        gp  = int(_f(r, "GP"))
        pts = _f(r, "PTS")
        fgm, fga = _f(r, "FGM"), _f(r, "FGA")
        fg3m, fg3a = _f(r, "FG3M"), _f(r, "FG3A")
        ftm, fta = _f(r, "FTM"), _f(r, "FTA")
        players.append({
            "player_id": int(_f(r, "PLAYER_ID")),
            "name": r.get("PLAYER_NAME", ""),
            "gp": gp,
            "min": round(mins, 1),
            "pts": round(pts, 0),
            "pts_per_g": round(pts / gp, 1) if gp else 0.0,
            "fgm": int(fgm), "fga": int(fga), "fg_pct": _pct(fgm, fga),
            "fg3m": int(fg3m), "fg3a": int(fg3a), "fg3_pct": _pct(fg3m, fg3a),
            "ftm": int(ftm), "fta": int(fta), "ft_pct": _pct(ftm, fta),
            "ts_pct": _ts_pct(pts, fga, fta),
            "plus_minus": int(_f(r, "PLUS_MINUS")),
        })
    # Most clutch minutes first - the players the team actually trusts late.
    players.sort(key=lambda p: p["min"], reverse=True)
    return players


def _build(season):
    team = _fetch_team(season)
    time.sleep(0.6)
    players = _fetch_players(season)
    return {"season": season, "team": team, "players": players}


def get_clutch(season, force=False):
    now = time.time()
    if (force or _CACHE["data"] is None or _CACHE["season"] != season
            or now - _CACHE["built_at"] > _TTL):
        _CACHE["data"] = _build(season)
        _CACHE["built_at"] = now
        _CACHE["season"] = season
    return _CACHE["data"]
