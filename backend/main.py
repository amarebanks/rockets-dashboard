"""
main.py — Houston Rockets Dashboard API (v3)
Endpoints: players, games, shots, season summary, stat leaders,
           NBA search, live scores, team stats, playoffs
"""

import os
import time
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
from nba_api.stats.endpoints import playergamelog, commonplayerinfo, playerdashboardbygeneralsplits, leaguedashplayerstats, leaguedashteamstats
from nba_api.stats.static import players as nba_players_static
from nba_api.live.nba.endpoints import scoreboard
import elo
import accolades as accolades_mod
from recognition import is_cornerstone, is_allstar

load_dotenv()

app = FastAPI(title="Rockets Dashboard API v3", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Available seasons, newest first. DEFAULT_SEASON is what the API serves when no
# ?season= is supplied. The frontend season selector passes one of SEASONS.
SEASONS = ["2025-26", "2024-25"]
DEFAULT_SEASON = SEASONS[0]
SEASON = DEFAULT_SEASON          # back-compat alias for any unconverted reference
ROCKETS_ABV = "HOU"


def valid_season(season: str) -> str:
    """Clamp an incoming season to a known one (guards SQL/API calls)."""
    return season if season in SEASONS else DEFAULT_SEASON


def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "rockets_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Rockets Dashboard API v3 🚀"}


@app.get("/seasons")
def get_seasons():
    """Seasons the dashboard can display; powers the navbar season selector."""
    return {"seasons": SEASONS, "default": DEFAULT_SEASON}

# ── Players ───────────────────────────────────────────────────────────────────

@app.get("/players")
def get_players(season_type: str = Query("Regular Season"), season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p.player_id, p.full_name, p.position, p.jersey_num, p.how_acquired,
                    ROUND(AVG(s.pts)::numeric, 1)     AS avg_pts,
                    ROUND(AVG(s.reb)::numeric, 1)     AS avg_reb,
                    ROUND(AVG(s.ast)::numeric, 1)     AS avg_ast,
                    ROUND(AVG(s.stl)::numeric, 1)     AS avg_stl,
                    ROUND(AVG(s.blk)::numeric, 1)     AS avg_blk,
                    ROUND(SUM(s.fgm)::numeric  / NULLIF(SUM(s.fga),  0), 3) AS avg_fg_pct,
                    ROUND(SUM(s.fg3m)::numeric / NULLIF(SUM(s.fg3a), 0), 3) AS avg_fg3_pct,
                    ROUND(SUM(s.ftm)::numeric  / NULLIF(SUM(s.fta),  0), 3) AS avg_ft_pct,
                    ROUND(AVG(s.plus_minus)::numeric, 1) AS avg_plus_minus,
                    COUNT(s.game_id) AS games_played
                FROM players p
                JOIN player_game_stats s
                    ON p.player_id = s.player_id
                    AND (s.season_type = %s OR s.season_type IS NULL)
                    AND s.season = %s
                GROUP BY p.player_id, p.full_name, p.position, p.jersey_num, p.how_acquired
                HAVING COUNT(s.game_id) > 0
                ORDER BY avg_pts DESC NULLS LAST
            """, (season_type, season))
            return {"players": [dict(p) for p in cur.fetchall()]}
    finally:
        conn.close()

@app.get("/players/overalls")
def get_player_overalls(season: str = Query(DEFAULT_SEASON)):
    """Compute approximate OVR (40–99) for every Rockets player using DB stats + recognition tier."""
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.player_id, p.full_name, p.position,
                       ROUND(AVG(s.pts)::numeric, 1)        AS avg_pts,
                       ROUND(AVG(s.reb)::numeric, 1)        AS avg_reb,
                       ROUND(AVG(s.ast)::numeric, 1)        AS avg_ast,
                       ROUND(AVG(s.stl)::numeric, 1)        AS avg_stl,
                       ROUND(AVG(s.blk)::numeric, 1)        AS avg_blk,
                       ROUND(SUM(s.fgm)::numeric / NULLIF(SUM(s.fga), 0), 3) AS avg_fg_pct,
                       ROUND(AVG(s.plus_minus)::numeric, 1) AS avg_pm,
                       COUNT(s.game_id)                     AS games_played
                FROM players p
                JOIN player_game_stats s
                    ON p.player_id = s.player_id
                    AND (s.season_type = 'Regular Season' OR s.season_type IS NULL)
                    AND s.season = %s
                GROUP BY p.player_id, p.full_name, p.position
                HAVING COUNT(s.game_id) > 0
            """, (season,))
            rows = cur.fetchall()

        result = {}
        for row in rows:
            name     = row["full_name"]
            position = str(row["position"] or "")
            pts  = float(row["avg_pts"]    or 0)
            reb  = float(row["avg_reb"]    or 0)
            ast  = float(row["avg_ast"]    or 0)
            stl  = float(row["avg_stl"]    or 0)
            blk  = float(row["avg_blk"]    or 0)
            fg   = float(row["avg_fg_pct"] or 0.44)
            pm   = float(row["avg_pm"]     or 0)
            gp   = int(row["games_played"] or 0)

            pts_s = min(pts  / 25.0 * 100, 100)
            reb_s = min(reb  / 10.0 * 100, 100)
            ast_s = min(ast  / 8.0  * 100, 100)
            def_s = (min(stl / 2.0  * 100, 100) + min(blk / 2.0 * 100, 100)) / 2
            fg_s  = min(max((fg - 0.38) / 0.22 * 100, 0), 100)
            pm_s  = min(max((pm + 5)   / 10    * 100, 0), 100)
            gp_s  = min(gp  / 65.0 * 100, 100)
            recog = 100 if is_cornerstone(name, season) else (75 if is_allstar(name, season) else 0)
            pos_m = POSITION_VALUE.get(position.upper().strip(), 1.0)

            raw = (
                pts_s * 0.22 + reb_s * 0.08 + ast_s * 0.08 +
                def_s * 0.08 + fg_s  * 0.10 + pm_s  * 0.08 +
                gp_s  * 0.06 + recog * 0.15 + 60    * 0.15
            )
            final   = raw * pos_m
            overall = min(99, max(55, round(final * 0.44 + 56)))
            result[str(row["player_id"])] = overall

        return {"overalls": result}
    finally:
        conn.close()

@app.get("/players/{player_id}")
def get_player(player_id: int, season_type: str = Query("Regular Season"),
               season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM players WHERE player_id = %s", (player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(status_code=404, detail="Player not found")
            cur.execute("""
                SELECT s.*, g.game_date, g.matchup, g.outcome, g.home_away
                FROM player_game_stats s
                LEFT JOIN games g ON s.game_id = g.game_id
                WHERE s.player_id = %s AND (s.season_type = %s OR s.season_type IS NULL)
                  AND s.season = %s
                ORDER BY g.game_date DESC
            """, (player_id, season_type, season))
            game_log = cur.fetchall()
            cur.execute("""
                SELECT
                    ROUND(AVG(pts)::numeric, 1)      AS avg_pts,
                    ROUND(AVG(reb)::numeric, 1)      AS avg_reb,
                    ROUND(AVG(ast)::numeric, 1)      AS avg_ast,
                    ROUND(AVG(stl)::numeric, 1)      AS avg_stl,
                    ROUND(AVG(blk)::numeric, 1)      AS avg_blk,
                    ROUND(SUM(fgm)::numeric  / NULLIF(SUM(fga),  0), 3) AS avg_fg_pct,
                    ROUND(SUM(fg3m)::numeric / NULLIF(SUM(fg3a), 0), 3) AS avg_fg3_pct,
                    ROUND(SUM(ftm)::numeric  / NULLIF(SUM(fta),  0), 3) AS avg_ft_pct,
                    ROUND(AVG(plus_minus)::numeric, 1) AS avg_plus_minus,
                    MAX(pts) AS max_pts, MAX(reb) AS max_reb, MAX(ast) AS max_ast,
                    COUNT(*) AS games_played
                FROM player_game_stats
                WHERE player_id = %s AND (season_type = %s OR season_type IS NULL)
                  AND season = %s
            """, (player_id, season_type, season))
            averages = cur.fetchone()
            cur.execute("""
                SELECT s.pts, s.reb, s.ast, g.game_date, g.matchup, g.outcome
                FROM player_game_stats s
                LEFT JOIN games g ON s.game_id = g.game_id
                WHERE s.player_id = %s AND (s.season_type = %s OR s.season_type IS NULL)
                  AND s.season = %s
                ORDER BY g.game_date DESC LIMIT 5
            """, (player_id, season_type, season))
            last5 = cur.fetchall()
        return {
            "player": dict(player),
            "averages": dict(averages),
            "game_log": [dict(g) for g in game_log],
            "last5": [dict(g) for g in last5],
            "accolades": accolades_mod.get_accolades(player["full_name"], season),
        }
    finally:
        conn.close()

@app.get("/players/{player_id}/stats")
def get_player_stats(player_id: int, season_type: str = Query("Regular Season"),
                     season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM players WHERE player_id = %s", (player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(status_code=404, detail="Player not found")
            cur.execute("""
                SELECT s.*, g.game_date, g.matchup, g.outcome
                FROM player_game_stats s
                LEFT JOIN games g ON s.game_id = g.game_id
                WHERE s.player_id = %s AND (s.season_type = %s OR s.season_type IS NULL)
                  AND s.season = %s
                ORDER BY g.game_date DESC
            """, (player_id, season_type, season))
            stats = cur.fetchall()
            cur.execute("""
                SELECT ROUND(AVG(pts)::numeric,1) AS avg_pts,
                       ROUND(AVG(reb)::numeric,1) AS avg_reb,
                       ROUND(AVG(ast)::numeric,1) AS avg_ast,
                       ROUND(SUM(fgm)::numeric / NULLIF(SUM(fga), 0), 3) AS avg_fg_pct,
                       COUNT(*) AS games_played
                FROM player_game_stats
                WHERE player_id = %s AND (season_type = %s OR season_type IS NULL)
                  AND season = %s
            """, (player_id, season_type, season))
            averages = cur.fetchone()
        return {"player": dict(player), "averages": dict(averages), "game_log": [dict(s) for s in stats]}
    finally:
        conn.close()

# ── Games ─────────────────────────────────────────────────────────────────────

@app.get("/games")
def get_games(
    outcome: str    = Query(None),
    home_away: str  = Query(None),
    season_type: str = Query("Regular Season"),
    season: str     = Query(DEFAULT_SEASON),
    limit: int      = 100
):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT game_id, game_date, matchup, outcome, pts, opp_pts, home_away,
                       COALESCE(season_type, 'Regular Season') AS season_type
                FROM games WHERE (season_type = %s OR (season_type IS NULL AND %s = 'Regular Season'))
                  AND season = %s
            """
            params = [season_type, season_type, season]
            if outcome:
                query += " AND outcome = %s"
                params.append(outcome.upper())
            if home_away:
                query += " AND home_away = %s"
                params.append(home_away.upper())
            query += " ORDER BY game_date DESC LIMIT %s"
            params.append(limit)
            cur.execute(query, params)
            games = cur.fetchall()
        all_games = sorted(games, key=lambda g: g["game_date"], reverse=True)
        streak = 0
        streak_type = None
        for g in all_games:
            if streak_type is None:
                streak_type = g["outcome"]; streak = 1
            elif g["outcome"] == streak_type:
                streak += 1
            else:
                break
        return {"games": [dict(g) for g in games], "streak": {"type": streak_type, "count": streak}}
    finally:
        conn.close()

@app.get("/games/{game_id}")
def get_game(game_id: str):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM games WHERE game_id = %s", (game_id,))
            game = cur.fetchone()
            if not game:
                raise HTTPException(status_code=404, detail="Game not found")
            cur.execute("""
                SELECT p.full_name, p.position, p.jersey_num,
                       s.min, s.pts, s.reb, s.ast, s.stl, s.blk,
                       s.fg_pct, s.fg3_pct, s.ft_pct, s.plus_minus
                FROM player_game_stats s
                JOIN players p ON s.player_id = p.player_id
                WHERE s.game_id = %s ORDER BY s.pts DESC NULLS LAST
            """, (game_id,))
            box_score = cur.fetchall()
        return {"game": dict(game), "box_score": [dict(r) for r in box_score]}
    finally:
        conn.close()

# ── Game Predictor (Elo) ────────────────────────────────────────────────────────

@app.get("/predict/teams")
def get_predict_teams(season: str = Query(DEFAULT_SEASON)):
    """List every team with its current Elo rating and record, sorted strongest
    first — used to populate the opponent picker and a power-ranking view."""
    ratings = elo.get_ratings(valid_season(season))
    teams = sorted(ratings.values(), key=lambda t: t["elo"], reverse=True)
    for rank, t in enumerate(teams, start=1):
        t["rank"] = rank
    return {"teams": teams, "rockets": ratings.get(ROCKETS_ABV)}

@app.get("/predict")
def predict_game(opponent: str = Query(..., description="Opponent team abbreviation, e.g. LAL"),
                 location: str = Query("home", description="Rockets venue: 'home' or 'away'"),
                 season: str = Query(DEFAULT_SEASON)):
    """Predict a hypothetical Rockets vs. opponent game using league-wide Elo."""
    season = valid_season(season)
    ratings = elo.get_ratings(season)
    rockets = ratings.get(ROCKETS_ABV)
    opp = ratings.get(opponent.upper())
    if not rockets:
        raise HTTPException(status_code=503, detail="Ratings unavailable")
    if not opp:
        raise HTTPException(status_code=404, detail=f"Unknown opponent '{opponent}'")
    if opp["abbr"] == ROCKETS_ABV:
        raise HTTPException(status_code=400, detail="Opponent cannot be the Rockets")

    rockets_home = location.lower() in ("home", "h")
    home, away = (rockets, opp) if rockets_home else (opp, rockets)
    result = elo.predict(home, away, ratings)

    # Re-key the result from the Rockets' point of view for the frontend.
    return {
        "season": season,
        "location": "home" if rockets_home else "away",
        "rockets": {
            "abbr": rockets["abbr"], "name": rockets["name"], "elo": rockets["elo"],
            "win_prob":   result["home_win_prob"] if rockets_home else result["away_win_prob"],
            "proj_score": result["home_proj_score"] if rockets_home else result["away_proj_score"],
        },
        "opponent": {
            "abbr": opp["abbr"], "name": opp["name"], "elo": opp["elo"],
            "win_prob":   result["away_win_prob"] if rockets_home else result["home_win_prob"],
            "proj_score": result["away_proj_score"] if rockets_home else result["home_proj_score"],
        },
        "favorite": "HOU" if result["favorite"] == ROCKETS_ABV else opp["abbr"],
    }

# ── Season summary ────────────────────────────────────────────────────────────

@app.get("/season/summary")
def get_season_summary(season_type: str = Query("Regular Season"), season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) AS games_played,
                    SUM(CASE WHEN outcome='W' THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN outcome='L' THEN 1 ELSE 0 END) AS losses,
                    ROUND(AVG(pts)::numeric,1) AS avg_pts_for,
                    ROUND(AVG(opp_pts)::numeric,1) AS avg_pts_against,
                    SUM(CASE WHEN home_away='H' AND outcome='W' THEN 1 ELSE 0 END) AS home_wins,
                    SUM(CASE WHEN home_away='H' AND outcome='L' THEN 1 ELSE 0 END) AS home_losses,
                    SUM(CASE WHEN home_away='A' AND outcome='W' THEN 1 ELSE 0 END) AS away_wins,
                    SUM(CASE WHEN home_away='A' AND outcome='L' THEN 1 ELSE 0 END) AS away_losses
                FROM games
                WHERE (season_type = %s OR (season_type IS NULL AND %s = 'Regular Season'))
                  AND season = %s
            """, (season_type, season_type, season))
            return dict(cur.fetchone())
    finally:
        conn.close()

@app.get("/stats/leaders")
def get_stat_leaders(season_type: str = Query("Regular Season"), season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            def top5(stat):
                cur.execute(f"""
                    SELECT p.full_name, p.player_id, ROUND(AVG(s.{stat})::numeric, 1) AS avg
                    FROM player_game_stats s JOIN players p ON s.player_id = p.player_id
                    WHERE (s.season_type = %s OR s.season_type IS NULL) AND s.season = %s
                    GROUP BY p.player_id, p.full_name ORDER BY avg DESC NULLS LAST LIMIT 5
                """, (season_type, season))
                return [dict(r) for r in cur.fetchall()]
            return {"points": top5("pts"), "rebounds": top5("reb"),
                    "assists": top5("ast"), "steals": top5("stl"), "blocks": top5("blk")}
    finally:
        conn.close()

# ── Team Stats ────────────────────────────────────────────────────────────────

@app.get("/team/stats")
def get_team_stats(season_type: str = Query("Regular Season"), season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Shooting splits
            cur.execute("""
                SELECT
                    ROUND(AVG(pts)::numeric,1)   AS avg_pts,
                    ROUND(AVG(opp_pts)::numeric,1) AS avg_opp_pts,
                    SUM(CASE WHEN outcome='W' THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN outcome='L' THEN 1 ELSE 0 END) AS losses,
                    COUNT(*) AS gp,
                    ROUND(AVG(CASE WHEN home_away='H' THEN pts END)::numeric,1) AS home_ppg,
                    ROUND(AVG(CASE WHEN home_away='A' THEN pts END)::numeric,1) AS away_ppg,
                    MAX(pts) AS max_pts, MIN(pts) AS min_pts
                FROM games
                WHERE (season_type = %s OR (season_type IS NULL AND %s = 'Regular Season'))
                  AND season = %s
            """, (season_type, season_type, season))
            game_stats = cur.fetchone()

            # True team per-game stats:
            # Percentages use SUM(makes)/SUM(attempts) — the only correct formula.
            # Counting stats (AST/REB/STL/BLK) use SUM / distinct game count.
            cur.execute("""
                SELECT
                    ROUND(SUM(fgm)::numeric  / NULLIF(SUM(fga),  0), 3) AS team_fg_pct,
                    ROUND(SUM(fg3m)::numeric / NULLIF(SUM(fg3a), 0), 3) AS team_fg3_pct,
                    ROUND(SUM(ftm)::numeric  / NULLIF(SUM(fta),  0), 3) AS team_ft_pct,
                    ROUND(SUM(stl)::numeric / NULLIF(COUNT(DISTINCT game_id), 0), 1) AS avg_stl,
                    ROUND(SUM(blk)::numeric / NULLIF(COUNT(DISTINCT game_id), 0), 1) AS avg_blk,
                    ROUND(SUM(ast)::numeric / NULLIF(COUNT(DISTINCT game_id), 0), 1) AS avg_ast,
                    ROUND(SUM(reb)::numeric / NULLIF(COUNT(DISTINCT game_id), 0), 1) AS avg_reb
                FROM player_game_stats
                WHERE (season_type = %s OR season_type IS NULL) AND season = %s
            """, (season_type, season))
            shooting = cur.fetchone()

            # Shot zone breakdown
            cur.execute("""
                SELECT shot_zone,
                    COUNT(*) AS attempts,
                    SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shots WHERE season_type = %s AND season = %s
                GROUP BY shot_zone ORDER BY attempts DESC
            """, (season_type, season))
            zones = cur.fetchall()

            # Win/loss by month
            cur.execute("""
                SELECT
                    TO_CHAR(game_date, 'Mon') AS month,
                    EXTRACT(MONTH FROM game_date) AS month_num,
                    SUM(CASE WHEN outcome='W' THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN outcome='L' THEN 1 ELSE 0 END) AS losses
                FROM games
                WHERE (season_type = %s OR (season_type IS NULL AND %s = 'Regular Season'))
                  AND season = %s
                GROUP BY month, month_num
                ORDER BY CASE WHEN EXTRACT(MONTH FROM game_date) >= 10
                              THEN EXTRACT(MONTH FROM game_date) - 10
                              ELSE EXTRACT(MONTH FROM game_date) + 2 END
            """, (season_type, season_type, season))
            monthly = cur.fetchall()

        gs = dict(game_stats)
        sh = dict(shooting)
        # Point differential from game-level data (more accurate than averaging player +/-)
        try:
            sh["avg_plus_minus"] = round(float(gs["avg_pts"]) - float(gs["avg_opp_pts"]), 1)
        except (TypeError, ValueError):
            sh["avg_plus_minus"] = None

        return {
            "game_stats": gs,
            "shooting":   sh,
            "zones":   [dict(z) for z in zones],
            "monthly": [dict(m) for m in monthly],
        }
    finally:
        conn.close()

@app.get("/team/shot-comparison")
def get_team_shot_comparison(season: str = Query(DEFAULT_SEASON)):
    """Compare shot selection & efficiency by shot type — Regular Season vs Playoffs.
    Per-game frequency is included so the 82-game RS and short playoff run are
    actually comparable (raw attempt counts are not)."""
    season = valid_season(season)
    ZONE_MAP = {
        "Restricted Area":        "At Rim",
        "In The Paint (Non-RA)":  "Paint",
        "Mid-Range":              "Mid-Range",
        "Left Corner 3":          "Corner 3",
        "Right Corner 3":         "Corner 3",
        "Above the Break 3":      "Above-Break 3",
    }
    ORDER = ["At Rim", "Paint", "Mid-Range", "Corner 3", "Above-Break 3"]
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT season_type, COUNT(*) AS n FROM games
                WHERE season_type IN ('Regular Season', 'Playoffs') AND season = %s
                GROUP BY season_type
            """, (season,))
            games = {r["season_type"]: r["n"] for r in cur.fetchall()}

            cur.execute("""
                SELECT season_type, shot_zone,
                       COUNT(*) AS att,
                       SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes
                FROM shots
                WHERE season_type IN ('Regular Season', 'Playoffs') AND season = %s
                GROUP BY season_type, shot_zone
            """, (season,))
            rows = cur.fetchall()

        agg = {}            # (season_type, category) -> [att, makes]
        totals = {}         # season_type -> total tracked attempts (for shot-mix %)
        for r in rows:
            cat = ZONE_MAP.get(r["shot_zone"])
            if not cat:
                continue
            a = agg.setdefault((r["season_type"], cat), [0, 0])
            a[0] += r["att"]
            a[1] += r["makes"]
            totals[r["season_type"]] = totals.get(r["season_type"], 0) + r["att"]

        def pack(season, cat):
            att, makes = agg.get((season, cat), [0, 0])
            g = games.get(season, 0) or 1
            tot = totals.get(season, 0) or 1
            return {
                "att": att, "makes": makes, "misses": att - makes,
                "pct": round(makes / att * 100, 1) if att else 0,
                "per_game": round(att / g, 1),
                "freq": round(att / tot * 100, 1),  # share of all shots — reveals selection
            }

        categories = [
            {"label": cat, "rs": pack("Regular Season", cat), "po": pack("Playoffs", cat)}
            for cat in ORDER
        ]
        return {
            "categories": categories,
            "rs_games": games.get("Regular Season", 0),
            "po_games": games.get("Playoffs", 0),
        }
    finally:
        conn.close()

@app.get("/team/rankings")
def get_team_rankings(season_type: str = Query("Regular Season"), season: str = Query(DEFAULT_SEASON)):
    """Fetch Houston Rockets league rankings for key stats via nba_api."""
    import time as _t
    _t.sleep(0.5)
    season = valid_season(season)
    ROCKETS_ID_NBA = 1610612745
    try:
        df = leaguedashteamstats.LeagueDashTeamStats(
            season=season,
            season_type_all_star=season_type,
            measure_type_detailed_defense="Base",
            per_mode_detailed="PerGame",
        ).get_data_frames()[0]
        rockets = df[df["TEAM_ID"] == ROCKETS_ID_NBA]
        if rockets.empty:
            return {"rankings": {}}
        rankings = {}
        for col, key in [
            ("PTS_RANK",        "pts"),
            ("REB_RANK",        "reb"),
            ("AST_RANK",        "ast"),
            ("STL_RANK",        "stl"),
            ("BLK_RANK",        "blk"),
            ("PLUS_MINUS_RANK", "plus_minus"),
            ("FG_PCT_RANK",     "fg_pct"),
            ("FG3_PCT_RANK",    "fg3_pct"),
            ("FT_PCT_RANK",     "ft_pct"),
        ]:
            if col in rockets.columns:
                try:
                    rankings[key] = int(float(rockets[col].iloc[0]))
                except (TypeError, ValueError):
                    pass
        return {"rankings": rankings}
    except Exception as e:
        return {"rankings": {}, "error": str(e)}

# ── Shot Chart ────────────────────────────────────────────────────────────────

@app.get("/shots/team/summary")
def get_team_shot_summary(season_type: str = Query("Regular Season"), season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT shot_zone, COUNT(*) AS attempts,
                    SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shots WHERE season_type = %s AND season = %s
                GROUP BY shot_zone ORDER BY attempts DESC
            """, (season_type, season))
            zones = cur.fetchall()
        return {"zones": [dict(z) for z in zones]}
    finally:
        conn.close()

@app.get("/shots/{player_id}")
def get_player_shots(
    player_id: int,
    season_type: str = Query("Regular Season"),
    season: str = Query(DEFAULT_SEASON),
    made: bool = Query(None),
):
    season = valid_season(season)
    conn = get_db()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT made, x, y, shot_zone, shot_type, distance, action_type, game_id
                FROM shots WHERE player_id = %s AND season_type = %s AND season = %s
            """
            params = [player_id, season_type, season]
            if made is not None:
                query += " AND made = %s"
                params.append(made)
            cur.execute(query, params)
            shots = cur.fetchall()
            cur.execute("""
                SELECT shot_zone, COUNT(*) AS attempts,
                    SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shots WHERE player_id = %s AND season_type = %s AND season = %s
                GROUP BY shot_zone ORDER BY attempts DESC
            """, [player_id, season_type, season])
            zones = cur.fetchall()
        return {
            "shots": [dict(s) for s in shots],
            "zones": [dict(z) for z in zones],
            "total": len(shots),
            "made":  sum(1 for s in shots if s["made"]),
        }
    finally:
        conn.close()

# ── NBA Player Search & Compare ───────────────────────────────────────────────

@app.get("/nba/search")
def search_nba_players(q: str = Query(..., min_length=2)):
    all_players = nba_players_static.get_players()
    q_lower = q.lower()
    matches = [p for p in all_players if q_lower in p["full_name"].lower()][:10]
    return {"players": matches}

@app.get("/nba/player/{player_id}/stats")
def get_nba_player_stats(player_id: int, season: str = Query(DEFAULT_SEASON)):
    season = valid_season(season)
    try:
        time.sleep(0.6)
        log = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        df = log.get_data_frames()[0]
        if df.empty:
            raise HTTPException(status_code=404, detail="No stats found")
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        info_df = info.get_data_frames()[0]
        name = info_df["DISPLAY_FIRST_LAST"].iloc[0]
        corner = is_cornerstone(name, season)
        star   = is_allstar(name, season)
        player_info = {
            "player_id": player_id,
            "full_name": name,
            "team":      info_df["TEAM_NAME"].iloc[0],
            "position":  info_df["POSITION"].iloc[0],
            "jersey":    info_df["JERSEY"].iloc[0],
            "is_allstar":     star,
            "is_cornerstone": corner,
            "accolade":  "Franchise Cornerstone" if corner else ("All-Star" if star else None),
            "accolades": accolades_mod.get_accolades(name, season),
        }
        averages = {
            "avg_pts":     round(float(df["PTS"].mean()), 1),
            "avg_reb":     round(float(df["REB"].mean()), 1),
            "avg_ast":     round(float(df["AST"].mean()), 1),
            "avg_stl":     round(float(df["STL"].mean()), 1),
            "avg_blk":     round(float(df["BLK"].mean()), 1),
            "avg_min":     round(float(df["MIN"].mean()), 1),
            "avg_fg_pct":  round(float(df["FGM"].sum()  / df["FGA"].sum()),  3) if df["FGA"].sum()  else None,
            "avg_fg3_pct": round(float(df["FG3M"].sum() / df["FG3A"].sum()), 3) if df["FG3A"].sum() else None,
            "avg_ft_pct":  round(float(df["FTM"].sum()  / df["FTA"].sum()),  3) if df["FTA"].sum()  else None,
            "games_played": int(len(df)),
        }

        # Per-36-minute stats, computed from season totals (not averaged per game).
        total_min = float(df["MIN"].sum())
        def _per36(col):
            return round(float(df[col].sum()) / total_min * 36, 1) if total_min > 0 else None
        per36 = {
            "pts": _per36("PTS"), "reb": _per36("REB"), "ast": _per36("AST"),
            "stl": _per36("STL"), "blk": _per36("BLK"), "tov": _per36("TOV"),
        }

        recent = df.head(10)[["GAME_DATE","PTS","REB","AST"]].to_dict("records")
        return {"player": player_info, "averages": averages, "per36": per36, "recent": recent}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/nba/player/{player_id}/shots")
def get_nba_player_shots(player_id: int, season_type: str = Query("Regular Season"),
                         season: str = Query(DEFAULT_SEASON)):
    """Live shot chart for ANY NBA player — pulls from nba_api rather than the
    local Rockets-only shots table, so the Compare page works league-wide.
    Returns the same shape as /shots/{id}."""
    season = valid_season(season)
    try:
        from nba_api.stats.endpoints import shotchartdetail
        time.sleep(0.6)
        df = shotchartdetail.ShotChartDetail(
            team_id=0, player_id=player_id,
            season_nullable=season, season_type_all_star=season_type,
            context_measure_simple="FGA",
        ).get_data_frames()[0]
        if df.empty:
            return {"shots": [], "zones": [], "total": 0, "made": 0}

        shots = [{
            "made":      bool(r["SHOT_MADE_FLAG"]),
            "x":         int(r["LOC_X"]),
            "y":         int(r["LOC_Y"]),
            "shot_zone": r["SHOT_ZONE_BASIC"],
            "shot_type": r["SHOT_TYPE"],
            "distance":  int(r["SHOT_DISTANCE"]),
        } for _, r in df.iterrows()]

        zones = []
        for zone, g in df.groupby("SHOT_ZONE_BASIC"):
            att   = len(g)
            makes = int(g["SHOT_MADE_FLAG"].sum())
            zones.append({"shot_zone": zone, "attempts": att, "makes": makes,
                          "pct": round(makes / att * 100, 1) if att else 0})
        zones.sort(key=lambda z: z["attempts"], reverse=True)

        return {"shots": shots, "zones": zones,
                "total": len(shots), "made": sum(1 for s in shots if s["made"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Live Scores ───────────────────────────────────────────────────────────────

@app.get("/live/scores")
def get_live_scores():
    try:
        board = scoreboard.ScoreBoard()
        data  = board.get_dict()
        games = data.get("scoreboard", {}).get("games", [])
        simplified = []
        for g in games:
            simplified.append({
                "game_id":    g.get("gameId"),
                "status":     g.get("gameStatusText"),
                "home_team":  g["homeTeam"]["teamTricode"],
                "away_team":  g["awayTeam"]["teamTricode"],
                "home_score": g["homeTeam"]["score"],
                "away_score": g["awayTeam"]["score"],
                "period":     g.get("period"),
                "clock":      g.get("gameClock", ""),
            })
        return {"games": simplified, "game_count": len(simplified)}
    except Exception as e:
        return {"games": [], "game_count": 0, "error": str(e)}

# ── Draft Capital ─────────────────────────────────────────────────────────────

@app.get("/draft/assets")
def get_draft_assets():
    """Rockets' curated draft-pick inventory with model-based valuations."""
    import draft
    return draft.get_draft_assets()

# ── Betting Edge Finder ───────────────────────────────────────────────────────

@app.get("/betting/edges")
def get_betting_edges(season: str = Query(DEFAULT_SEASON)):
    """Live value bets — model win prob vs de-vigged sportsbook moneylines."""
    import betting
    try:
        return betting.live_edges(valid_season(season))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Betting engine failed: {e}")

@app.get("/betting/evaluate")
def evaluate_bet(
    home: str = Query(..., description="Home team abbreviation"),
    away: str = Query(..., description="Away team abbreviation"),
    home_odds: int = Query(..., description="Home moneyline (American), e.g. -150"),
    away_odds: int = Query(..., description="Away moneyline (American), e.g. +130"),
    season: str = Query(DEFAULT_SEASON),
):
    """Manual mode — supply moneylines, get the model's edge. No API key needed."""
    import betting
    res = betting.evaluate_matchup(valid_season(season), home, away, home_odds, away_odds)
    if res is None:
        raise HTTPException(status_code=404, detail="Unknown team abbreviation")
    return res

# ── Trade Idea Engine ─────────────────────────────────────────────────────────

@app.get("/trade/ideas")
def get_trade_ideas(season: str = Query(DEFAULT_SEASON)):
    """Suggest realistic trades that address the Rockets' weaknesses (fit-based)."""
    import trade_ideas
    try:
        return trade_ideas.get_trade_ideas(valid_season(season))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trade idea engine failed: {e}")


@app.get("/contracts/cap")
def get_contracts_cap(season: str = Query(DEFAULT_SEASON)):
    """Per-team salary-cap sheet: committed payroll vs the cap / tax / apron lines."""
    import contracts
    return contracts.get_cap_sheet(valid_season(season))


@app.get("/contracts/team/{team}")
def get_contracts_team(team: str, season: str = Query(DEFAULT_SEASON)):
    """One team's curated contracts plus, if they're over the line, the most likely
    cap-relief moves to get back under (especially for second-apron teams)."""
    import contracts, trade_ideas
    season = valid_season(season)
    team = team.upper()
    # League-wide value + real-roster lookups so the relief planner grades contracts
    # (bad/overpaid first, franchise players last) and sheds only players actually on
    # the team (excluding dead money on the cap sheet).
    try:
        values = trade_ideas.get_player_values(season)
        teams_map = trade_ideas.get_player_teams(season)
    except Exception:
        values, teams_map = {}, {}
    vlookup = (lambda n: values.get(n)) if values else None
    roster = [n for n, t in teams_map.items() if t == team] or None
    return {
        "season": season,
        "team": team,
        "status": contracts.team_apron_status(team, season),
        "contracts": contracts.get_team_contracts(team, season),
        "relief_plan": contracts.cap_relief_plan(team, season, value_lookup=vlookup, roster=roster),
    }


@app.get("/team/clutch")
def get_team_clutch(season: str = Query(DEFAULT_SEASON)):
    """Houston's clutch performance — last 5 min, score within 5 (NBA's definition)."""
    import clutch
    try:
        return clutch.get_clutch(valid_season(season))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clutch engine failed: {e}")


@app.get("/team/lineups")
def get_team_lineups(size: int = Query(5, ge=2, le=5), season: str = Query(DEFAULT_SEASON)):
    """Houston's best/worst lineup combinations by net rating (2-, 3-, or 5-man)."""
    import lineups
    try:
        return lineups.get_lineups(valid_season(season), size=size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lineup engine failed: {e}")

# ── Trade Value Algorithm ─────────────────────────────────────────────────────

POSITION_VALUE = {
    "PG":1.10,"SG":1.00,"SF":1.00,"PF":1.05,"C":1.10,
    "G":1.05,"F":1.00,"G-F":1.02,"F-G":1.02,"F-C":1.05,"C-F":1.05,"":1.00,
}

def _age_score(age, is_allstar=False):
    if age is None: return 75
    if age <= 20: raw = 75
    elif age == 21: raw = 80
    elif age == 22: raw = 85
    elif age == 23: raw = 90
    elif age == 24: raw = 95
    elif age in (25, 26, 27): raw = 100
    elif age == 28: raw = 98
    elif age == 29: raw = 93
    elif age == 30: raw = 87
    elif age == 31: raw = 80
    elif age == 32: raw = 72
    elif age == 33: raw = 63
    elif age == 34: raw = 54
    elif age == 35: raw = 45
    elif age == 36: raw = 37
    elif age == 37: raw = 30
    else: raw = max(20, 30 - (age - 37) * 3)
    # Proven All-Stars have demonstrated longevity — don't punish age as harshly
    if is_allstar:
        return max(raw, 55)
    return raw

@app.get("/trade/value/{player_id}")
def get_trade_value(player_id: int, season: str = Query(DEFAULT_SEASON)):
    """Calculate trade value 0-100 for any NBA player using live season stats."""
    import time as _time
    _time.sleep(0.5)
    season = valid_season(season)
    try:
        log  = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        df   = log.get_data_frames()[0]
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        info_df = info.get_data_frames()[0]

        name     = info_df["DISPLAY_FIRST_LAST"].iloc[0]
        position = str(info_df["POSITION"].iloc[0] or "")
        born     = info_df["BIRTHDATE"].iloc[0]

        # Calculate age
        age = None
        if born:
            from datetime import date
            try:
                bdate = date.fromisoformat(str(born)[:10])
                today = date.today()
                age   = today.year - bdate.year - ((today.month, today.day) < (bdate.month, bdate.day))
            except:
                pass

        if not df.empty:
            pts  = float(df["PTS"].mean())
            reb  = float(df["REB"].mean())
            ast  = float(df["AST"].mean())
            stl  = float(df["STL"].mean())
            blk  = float(df["BLK"].mean())
            pm   = float(df["PLUS_MINUS"].mean())
            fgm  = float(df["FGM"].mean())
            fga  = float(df["FGA"].mean())
            fg3m = float(df["FG3M"].mean())
            fta  = float(df["FTA"].mean())
            gp   = int(len(df))
            efg_pct = (fgm + 0.5 * fg3m) / fga if fga > 0 else 0.46
            ts_pct  = pts / (2 * (fga + 0.44 * fta)) if (fga + fta) > 0 else 0.55
        else:
            pts = reb = ast = stl = blk = pm = fga = fta = 0
            efg_pct = 0.46; ts_pct = 0.55; gp = 0

        # Advanced dashboard: ORtg, DRtg, USG% — fall back to league averages on error
        off_rtg = 108.0; def_rtg = 112.0; usg_pct = 0.20
        try:
            import time as _t2; _t2.sleep(0.4)
            adv_df = playerdashboardbygeneralsplits.PlayerDashboardByGeneralSplits(
                player_id=player_id, season=season,
                measure_type_player_dashboard="Advanced",
                per_mode_simple="PerGame",
            ).get_data_frames()[0]
            if not adv_df.empty:
                if "OFF_RATING" in adv_df.columns: off_rtg = float(adv_df["OFF_RATING"].iloc[0])
                if "DEF_RATING" in adv_df.columns: def_rtg = float(adv_df["DEF_RATING"].iloc[0])
                if "USG_PCT"    in adv_df.columns:
                    u = float(adv_df["USG_PCT"].iloc[0])
                    usg_pct = u / 100 if u > 1 else u
        except Exception:
            pass

        # ── Component scores 0–100 ────────────────────────────────────────────
        pts_score  = min(pts / 28.0 * 100, 100)
        reb_score  = min(reb / 12.0 * 100, 100)
        ast_score  = min(ast / 9.0  * 100, 100)
        pm_score   = min(max((pm + 5) / 10 * 100, 0), 100)
        ts_score   = min(max((ts_pct  - 0.45) / 0.20 * 100, 0), 100)
        efg_score  = min(max((efg_pct - 0.40) / 0.22 * 100, 0), 100)
        ortg_score = min(max((off_rtg - 100)  / 20   * 100, 0), 100)
        usg_score  = min(max((usg_pct - 0.15) / 0.20 * 100, 0), 100)
        gp_score   = min(gp / 70.0 * 100, 100)

        # DRtg scale: league avg ≈ 113, elite ≈ 107, poor ≈ 119.
        # 6-point half-range → each point below avg is worth 8.3 pts on 0-100 scale,
        # so Gobert/Wemby (DRtg ~106-107) saturate near 100 and avg defenders score ~50.
        drtg_component = min(max((113 - def_rtg) / 6 * 50 + 50, 0), 100)

        # Combined defense: (STL+BLK avg) 20% + DRtg 80%
        # Heavy DRtg weight so paint defenders like Gobert/Wemby score accurately.
        # STL/BLK still matter at the margin for players at the same DRtg tier.
        def_score = (
            (min(stl / 2.0 * 100, 100) + min(blk / 2.0 * 100, 100)) / 2 * 0.20 +
            drtg_component * 0.80
        )

        is_corner      = is_cornerstone(name, season)
        is_star        = is_allstar(name, season)
        age_s          = _age_score(age, is_allstar=is_star)
        pos_mult       = POSITION_VALUE.get(position.upper().strip(), 1.0)
        recognition_s  = 100 if is_corner else (75 if is_star else 0)

        # ── Weighted composite (weights sum to 1.0) ───────────────────────────
        # def_score now includes DRtg — weight raised from 0.03 to 0.07,
        # the freed 0.04 from the removed standalone drtg term.
        raw = (
            pts_score  * 0.11 + reb_score  * 0.04 + ast_score  * 0.04 +
            def_score  * 0.07 + pm_score   * 0.05 + ts_score   * 0.07 +
            efg_score  * 0.03 + ortg_score * 0.04 +
            usg_score  * 0.03 + gp_score   * 0.06 + age_s      * 0.10 +
            recognition_s * 0.30 + 60      * 0.06
        )

        # Non-cornerstone All-Stars floored pre-mult so position bonus still applies
        if not is_corner and is_star:
            raw = max(raw, 68)

        final = raw * pos_mult

        # Cornerstones guaranteed ≥ 97 post-mult — always "Untradable"
        if is_corner:
            final = max(final, 97)

        final = min(final, 100)

        if final >= 96:   tier = "Elite Cornerstone"
        elif final >= 85: tier = "Franchise Star"
        elif final >= 70: tier = "All-Star Caliber"
        elif final >= 55: tier = "Starter"
        elif final >= 40: tier = "Rotation Player"
        elif final >= 25: tier = "Bench Player"
        else:             tier = "Fringe Roster"

        overall = min(99, max(40, round(final * 0.59 + 40)))

        return {
            "score":          round(final, 1),
            "overall":        overall,
            "tier":           tier,
            "is_allstar":     is_star,
            "is_cornerstone": is_corner,
            "age":            age,
            "breakdown": {
                "scoring":    round(pts_score,  1),
                "defense":    round(def_score,  1),
                "playmaking": round(ast_score,  1),
                "efficiency": round(ts_score,   1),
                "impact":     round(pm_score,   1),
                "durability": round(gp_score,   1),
                "age_value":  round(age_s,      1),
                "pedigree":   round(recognition_s, 1),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Player Advanced Stats ─────────────────────────────────────────────────────

@app.get("/players/{player_id}/advanced")
def get_player_advanced(player_id: int, season_type: str = Query("Regular Season"),
                        season: str = Query(DEFAULT_SEASON)):
    """Fetch advanced stats for a player using nba_api (TS%, eFG%, ORtg, DRtg, USG%, PIE, etc.)."""
    season = valid_season(season)
    import time as _t
    _t.sleep(0.5)

    def norm_pct(val):
        if val is None: return None
        v = float(val)
        return round(v * 100 if v <= 1.0 else v, 1)

    import math as _math

    def _safe_float(val):
        """Return float or None, filtering out NaN/None."""
        if val is None: return None
        try:
            f = float(val)
            return None if _math.isnan(f) or _math.isinf(f) else f
        except (TypeError, ValueError):
            return None

    try:
        log = playergamelog.PlayerGameLog(player_id=player_id, season=season)
        df  = log.get_data_frames()[0]
        _t.sleep(0.4)
        info    = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        info_df = info.get_data_frames()[0]

        name     = info_df["DISPLAY_FIRST_LAST"].iloc[0]
        team     = info_df["TEAM_NAME"].iloc[0]
        position = str(info_df["POSITION"].iloc[0] or "")
        born     = info_df["BIRTHDATE"].iloc[0]

        age = None
        if born:
            from datetime import date
            try:
                bdate = date.fromisoformat(str(born)[:10])
                today = date.today()
                age   = today.year - bdate.year - ((today.month, today.day) < (bdate.month, bdate.day))
            except Exception:
                pass

        if not df.empty:
            gp   = int(len(df))
            pts  = round(float(df["PTS"].mean()), 1)
            fgm  = float(df["FGM"].mean())
            fga  = float(df["FGA"].mean())
            fg3m = float(df["FG3M"].mean())
            fg3a = float(df["FG3A"].mean()) if "FG3A" in df.columns else 0.0
            fta  = float(df["FTA"].mean())
            tov  = round(float(df["TOV"].mean()), 1) if "TOV" in df.columns else None
            pm   = round(float(df["PLUS_MINUS"].mean()), 1)

            ts_pct   = pts / (2 * (fga + 0.44 * fta)) if (fga + fta) > 0 else None
            efg_pct  = (fgm + 0.5 * fg3m) / fga if fga > 0 else None
            fg3_rate = fg3a / fga if fga > 0 else None
            ft_rate  = fta  / fga if fga > 0 else None
        else:
            gp = 0; pts = 0; tov = None; pm = 0
            ts_pct = efg_pct = fg3_rate = ft_rate = None

        # LeagueDashPlayerStats with correct parameter names for nba_api 1.11+
        # (measure_type_detailed_defense / per_mode_detailed, not measure_type_simple)
        _t.sleep(0.6)
        adv = {}
        rankings = {}
        try:
            league_adv = leaguedashplayerstats.LeagueDashPlayerStats(
                season=season,
                season_type_all_star=season_type,
                measure_type_detailed_defense="Advanced",
                per_mode_detailed="PerGame",
            ).get_data_frames()[0]
            row = league_adv[league_adv["PLAYER_ID"] == player_id]
            if not row.empty:
                for col, key in [
                    ("OFF_RATING",      "off_rtg"),  ("DEF_RATING",  "def_rtg"),
                    ("NET_RATING",      "net_rtg"),  ("USG_PCT",     "usg_pct"),
                    ("TS_PCT",          "ts_pct"),   ("EFG_PCT",     "efg_pct"),
                    ("PACE",            "pace"),     ("PIE",         "pie"),
                    ("AST_PCT",         "ast_pct"),  ("AST_TO",      "ast_to"),
                    ("OREB_PCT",        "oreb_pct"), ("DREB_PCT",    "dreb_pct"),
                    ("REB_PCT",         "reb_pct"),
                ]:
                    if col in row.columns:
                        v = _safe_float(row[col].iloc[0])
                        if v is not None:
                            adv[key] = v
                # Rank columns are included in the Advanced response
                for col, key in [
                    ("OFF_RATING_RANK", "off_rtg"), ("DEF_RATING_RANK", "def_rtg"),
                    ("NET_RATING_RANK", "net_rtg"), ("USG_PCT_RANK",    "usg_pct"),
                    ("PIE_RANK",        "pie"),
                ]:
                    if col in row.columns:
                        v = _safe_float(row[col].iloc[0])
                        if v is not None:
                            rankings[col.replace("_RANK","").lower().replace("off_rating","off_rtg")
                                        .replace("def_rating","def_rtg").replace("net_rating","net_rtg")] = int(v)
        except Exception:
            pass

        ts_final  = adv.get("ts_pct",  ts_pct)
        efg_final = adv.get("efg_pct", efg_pct)

        # has_data: False means the player had no stats for this season_type (e.g. missed playoffs)
        has_data = bool(adv) or gp > 0

        return {
            "player_id":    player_id,
            "has_data":     has_data,
            "season_type":  season_type,
            "name":         name,
            "team":         team,
            "position":     position,
            "age":          age,
            "accolades":    accolades_mod.get_accolades(name, season),
            "games_played": gp,
            "plus_minus":   pm,
            "tov":          tov,
            "ts_pct":    norm_pct(ts_final),
            "efg_pct":   norm_pct(efg_final),
            "usg_pct":   norm_pct(adv.get("usg_pct")),
            "pie":       norm_pct(adv.get("pie")),
            "ast_pct":   norm_pct(adv.get("ast_pct")),
            "ast_to":    round(adv["ast_to"], 2) if "ast_to" in adv else None,
            "oreb_pct":  norm_pct(adv.get("oreb_pct")),
            "dreb_pct":  norm_pct(adv.get("dreb_pct")),
            "reb_pct":   norm_pct(adv.get("reb_pct")),
            "fg3_rate":  norm_pct(fg3_rate),
            "ft_rate":   norm_pct(ft_rate),
            "off_rtg":   round(adv["off_rtg"], 1) if "off_rtg" in adv else None,
            "def_rtg":   round(adv["def_rtg"], 1) if "def_rtg" in adv else None,
            "net_rtg":   round(adv["net_rtg"], 1) if "net_rtg" in adv else None,
            "pace":      round(adv["pace"],    1) if "pace"    in adv else None,
            "rankings":  rankings,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))