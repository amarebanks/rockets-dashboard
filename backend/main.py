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
from nba_api.stats.endpoints import playergamelog, commonplayerinfo
from nba_api.stats.static import players as nba_players_static
from nba_api.live.nba.endpoints import scoreboard

load_dotenv()

app = FastAPI(title="Rockets Dashboard API v3", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SEASON = "2024-25"

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

# ── Players ───────────────────────────────────────────────────────────────────

@app.get("/players")
def get_players(season_type: str = Query("Regular Season")):
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
                    ROUND(AVG(s.fg_pct)::numeric, 3)  AS avg_fg_pct,
                    ROUND(AVG(s.fg3_pct)::numeric, 3) AS avg_fg3_pct,
                    ROUND(AVG(s.ft_pct)::numeric, 3)  AS avg_ft_pct,
                    ROUND(AVG(s.plus_minus)::numeric, 1) AS avg_plus_minus,
                    COUNT(s.game_id) AS games_played
                FROM players p
                LEFT JOIN player_game_stats s
                    ON p.player_id = s.player_id
                    AND (s.season_type = %s OR s.season_type IS NULL)
                GROUP BY p.player_id, p.full_name, p.position, p.jersey_num, p.how_acquired
                ORDER BY avg_pts DESC NULLS LAST
            """, (season_type,))
            return {"players": [dict(p) for p in cur.fetchall()]}
    finally:
        conn.close()

@app.get("/players/{player_id}")
def get_player(player_id: int, season_type: str = Query("Regular Season")):
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
                ORDER BY g.game_date DESC
            """, (player_id, season_type))
            game_log = cur.fetchall()
            cur.execute("""
                SELECT
                    ROUND(AVG(pts)::numeric, 1)      AS avg_pts,
                    ROUND(AVG(reb)::numeric, 1)      AS avg_reb,
                    ROUND(AVG(ast)::numeric, 1)      AS avg_ast,
                    ROUND(AVG(stl)::numeric, 1)      AS avg_stl,
                    ROUND(AVG(blk)::numeric, 1)      AS avg_blk,
                    ROUND(AVG(fg_pct)::numeric, 3)   AS avg_fg_pct,
                    ROUND(AVG(fg3_pct)::numeric, 3)  AS avg_fg3_pct,
                    ROUND(AVG(ft_pct)::numeric, 3)   AS avg_ft_pct,
                    ROUND(AVG(plus_minus)::numeric, 1) AS avg_plus_minus,
                    MAX(pts) AS max_pts, MAX(reb) AS max_reb, MAX(ast) AS max_ast,
                    COUNT(*) AS games_played
                FROM player_game_stats
                WHERE player_id = %s AND (season_type = %s OR season_type IS NULL)
            """, (player_id, season_type))
            averages = cur.fetchone()
            cur.execute("""
                SELECT s.pts, s.reb, s.ast, g.game_date, g.matchup, g.outcome
                FROM player_game_stats s
                LEFT JOIN games g ON s.game_id = g.game_id
                WHERE s.player_id = %s AND (s.season_type = %s OR s.season_type IS NULL)
                ORDER BY g.game_date DESC LIMIT 5
            """, (player_id, season_type))
            last5 = cur.fetchall()
        return {
            "player": dict(player),
            "averages": dict(averages),
            "game_log": [dict(g) for g in game_log],
            "last5": [dict(g) for g in last5],
        }
    finally:
        conn.close()

@app.get("/players/{player_id}/stats")
def get_player_stats(player_id: int, season_type: str = Query("Regular Season")):
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
                ORDER BY g.game_date DESC
            """, (player_id, season_type))
            stats = cur.fetchall()
            cur.execute("""
                SELECT ROUND(AVG(pts)::numeric,1) AS avg_pts,
                       ROUND(AVG(reb)::numeric,1) AS avg_reb,
                       ROUND(AVG(ast)::numeric,1) AS avg_ast,
                       ROUND(AVG(fg_pct)::numeric,3) AS avg_fg_pct,
                       COUNT(*) AS games_played
                FROM player_game_stats
                WHERE player_id = %s AND (season_type = %s OR season_type IS NULL)
            """, (player_id, season_type))
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
    limit: int      = 100
):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT game_id, game_date, matchup, outcome, pts, opp_pts, home_away,
                       COALESCE(season_type, 'Regular Season') AS season_type
                FROM games WHERE (season_type = %s OR (season_type IS NULL AND %s = 'Regular Season'))
            """
            params = [season_type, season_type]
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

# ── Season summary ────────────────────────────────────────────────────────────

@app.get("/season/summary")
def get_season_summary(season_type: str = Query("Regular Season")):
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
                WHERE season_type = %s OR (season_type IS NULL AND %s = 'Regular Season')
            """, (season_type, season_type))
            return dict(cur.fetchone())
    finally:
        conn.close()

@app.get("/stats/leaders")
def get_stat_leaders(season_type: str = Query("Regular Season")):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            def top5(stat):
                cur.execute(f"""
                    SELECT p.full_name, p.player_id, ROUND(AVG(s.{stat})::numeric, 1) AS avg
                    FROM player_game_stats s JOIN players p ON s.player_id = p.player_id
                    WHERE s.season_type = %s OR s.season_type IS NULL
                    GROUP BY p.player_id, p.full_name ORDER BY avg DESC NULLS LAST LIMIT 5
                """, (season_type,))
                return [dict(r) for r in cur.fetchall()]
            return {"points": top5("pts"), "rebounds": top5("reb"),
                    "assists": top5("ast"), "steals": top5("stl"), "blocks": top5("blk")}
    finally:
        conn.close()

# ── Team Stats ────────────────────────────────────────────────────────────────

@app.get("/team/stats")
def get_team_stats(season_type: str = Query("Regular Season")):
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
                WHERE season_type = %s OR (season_type IS NULL AND %s = 'Regular Season')
            """, (season_type, season_type))
            game_stats = cur.fetchone()

            # Player shooting splits
            cur.execute("""
                SELECT
                    ROUND(AVG(fg_pct)::numeric,3)  AS team_fg_pct,
                    ROUND(AVG(fg3_pct)::numeric,3) AS team_fg3_pct,
                    ROUND(AVG(ft_pct)::numeric,3)  AS team_ft_pct,
                    ROUND(AVG(stl)::numeric,2)     AS avg_stl,
                    ROUND(AVG(blk)::numeric,2)     AS avg_blk,
                    ROUND(AVG(ast)::numeric,2)     AS avg_ast,
                    ROUND(AVG(reb)::numeric,2)     AS avg_reb,
                    ROUND(AVG(plus_minus)::numeric,2) AS avg_plus_minus
                FROM player_game_stats
                WHERE season_type = %s OR season_type IS NULL
            """, (season_type,))
            shooting = cur.fetchone()

            # Shot zone breakdown
            cur.execute("""
                SELECT shot_zone,
                    COUNT(*) AS attempts,
                    SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shots WHERE season_type = %s
                GROUP BY shot_zone ORDER BY attempts DESC
            """, (season_type,))
            zones = cur.fetchall()

            # Win/loss by month
            cur.execute("""
                SELECT
                    TO_CHAR(game_date, 'Mon') AS month,
                    EXTRACT(MONTH FROM game_date) AS month_num,
                    SUM(CASE WHEN outcome='W' THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN outcome='L' THEN 1 ELSE 0 END) AS losses
                FROM games
                WHERE season_type = %s OR (season_type IS NULL AND %s = 'Regular Season')
                GROUP BY month, month_num ORDER BY month_num
            """, (season_type, season_type))
            monthly = cur.fetchall()

        return {
            "game_stats": dict(game_stats),
            "shooting": dict(shooting),
            "zones": [dict(z) for z in zones],
            "monthly": [dict(m) for m in monthly],
        }
    finally:
        conn.close()

# ── Shot Chart ────────────────────────────────────────────────────────────────

@app.get("/shots/team/summary")
def get_team_shot_summary(season_type: str = Query("Regular Season")):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT shot_zone, COUNT(*) AS attempts,
                    SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shots WHERE season_type = %s
                GROUP BY shot_zone ORDER BY attempts DESC
            """, (season_type,))
            zones = cur.fetchall()
        return {"zones": [dict(z) for z in zones]}
    finally:
        conn.close()

@app.get("/shots/{player_id}")
def get_player_shots(
    player_id: int,
    season_type: str = Query("Regular Season"),
    made: bool = Query(None),
):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT made, x, y, shot_zone, shot_type, distance, action_type, game_id
                FROM shots WHERE player_id = %s AND season_type = %s
            """
            params = [player_id, season_type]
            if made is not None:
                query += " AND made = %s"
                params.append(made)
            cur.execute(query, params)
            shots = cur.fetchall()
            cur.execute("""
                SELECT shot_zone, COUNT(*) AS attempts,
                    SUM(CASE WHEN made THEN 1 ELSE 0 END) AS makes,
                    ROUND(AVG(CASE WHEN made THEN 1.0 ELSE 0.0 END)*100,1) AS pct
                FROM shots WHERE player_id = %s AND season_type = %s
                GROUP BY shot_zone ORDER BY attempts DESC
            """, [player_id, season_type])
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
def get_nba_player_stats(player_id: int):
    try:
        time.sleep(0.6)
        log = playergamelog.PlayerGameLog(player_id=player_id, season=SEASON)
        df = log.get_data_frames()[0]
        if df.empty:
            raise HTTPException(status_code=404, detail="No stats found")
        info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
        info_df = info.get_data_frames()[0]
        player_info = {
            "full_name": info_df["DISPLAY_FIRST_LAST"].iloc[0],
            "team":      info_df["TEAM_NAME"].iloc[0],
            "position":  info_df["POSITION"].iloc[0],
            "jersey":    info_df["JERSEY"].iloc[0],
        }
        averages = {
            "avg_pts":     round(float(df["PTS"].mean()), 1),
            "avg_reb":     round(float(df["REB"].mean()), 1),
            "avg_ast":     round(float(df["AST"].mean()), 1),
            "avg_stl":     round(float(df["STL"].mean()), 1),
            "avg_blk":     round(float(df["BLK"].mean()), 1),
            "avg_fg_pct":  round(float(df["FG_PCT"].mean()), 3),
            "avg_fg3_pct": round(float(df["FG3_PCT"].mean()), 3),
            "avg_ft_pct":  round(float(df["FT_PCT"].mean()), 3),
            "games_played": int(len(df)),
        }
        recent = df.head(10)[["GAME_DATE","PTS","REB","AST"]].to_dict("records")
        return {"player": player_info, "averages": averages, "recent": recent}
    except HTTPException:
        raise
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

# ── Trade Value Algorithm ─────────────────────────────────────────────────────

ALL_STARS_2025 = {
    "Alperen Sengun", "Jalen Green",
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
def get_trade_value(player_id: int):
    """Calculate trade value 0-100 for any NBA player using live season stats."""
    import time as _time
    _time.sleep(0.5)
    try:
        log  = playergamelog.PlayerGameLog(player_id=player_id, season=SEASON)
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

        pts    = float(df["PTS"].mean())    if not df.empty else 0
        reb    = float(df["REB"].mean())    if not df.empty else 0
        ast    = float(df["AST"].mean())    if not df.empty else 0
        fg_pct = float(df["FG_PCT"].mean()) if not df.empty else 0.44
        gp     = int(len(df))

        # Realistic benchmarks — elite players hit 90-100 on each factor
        pts_score = min((pts / 28.0)    * 100, 100)
        reb_score = min((reb / 12.0)    * 100, 100)
        ast_score = min((ast / 9.0)     * 100, 100)
        fg_score  = min((fg_pct / 0.56) * 100, 100)
        gp_score  = min((gp / 70.0)     * 100, 100)
        is_allstar = name in ALL_STARS_2025
        age_s     = _age_score(age, is_allstar=is_allstar)
        allstar_s = 100 if is_allstar else 0
        pos_mult  = POSITION_VALUE.get(position.upper().strip(), 1.0)

        # Weighted composite
        raw = (
            pts_score * 0.22 + reb_score * 0.10 + ast_score * 0.10 +
            fg_score  * 0.08 + gp_score  * 0.08 + age_s     * 0.12 +
            allstar_s * 0.18 + 60        * 0.12
        )
        # All-Star floor: proven stars never score below 68
        if is_allstar:
            raw = max(raw, 68)
        final = min(raw * pos_mult, 100)

        if final >= 85:   tier = "Franchise Star"
        elif final >= 70: tier = "All-Star Caliber"
        elif final >= 55: tier = "Starter"
        elif final >= 40: tier = "Rotation Player"
        elif final >= 25: tier = "Bench Player"
        else:             tier = "Fringe Roster"

        return {
            "score": round(final, 1),
            "tier":  tier,
            "is_allstar": is_allstar,
            "age": age,
            "breakdown": {
                "scoring":    round(pts_score, 1),
                "rebounding": round(reb_score, 1),
                "playmaking": round(ast_score, 1),
                "efficiency": round(fg_score,  1),
                "durability": round(gp_score,  1),
                "age_value":  round(age_s,     1),
                "allstar":    round(allstar_s, 1),
                "position":   round(pos_mult * 100 - 100, 1),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))