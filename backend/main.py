"""
main.py
-------
FastAPI backend for the Houston Rockets Dashboard.
Serves data from PostgreSQL to the React frontend.

Endpoints:
  GET /                          - health check
  GET /players                   - full roster
  GET /players/{player_id}/stats - per-game stats for one player
  GET /games                     - all games this season
  GET /games/{game_id}           - single game details
  GET /stats/leaders             - top players by pts, reb, ast

Requirements:
  pip install fastapi uvicorn psycopg2-binary python-dotenv

Run:
  uvicorn main:app --reload
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras

load_dotenv()

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Rockets Dashboard API",
    description="Houston Rockets stats powered by NBA data",
    version="1.0.0",
)

# Allow the React frontend to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database connection ───────────────────────────────────────────────────────

def get_db():
    """Return a psycopg2 connection with dict-style rows."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "rockets_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        cursor_factory=psycopg2.extras.RealDictCursor,  # rows as dicts
    )
    return conn


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    """Quick check that the API is running."""
    return {"status": "ok", "message": "Rockets Dashboard API is live 🚀"}


# ── Players ───────────────────────────────────────────────────────────────────

@app.get("/players")
def get_players():
    """Return the full Rockets roster."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    p.player_id,
                    p.full_name,
                    p.position,
                    p.jersey_num,
                    p.how_acquired,
                    ROUND(AVG(s.pts)::numeric, 1)      AS avg_pts,
                    ROUND(AVG(s.reb)::numeric, 1)      AS avg_reb,
                    ROUND(AVG(s.ast)::numeric, 1)      AS avg_ast,
                    ROUND(AVG(s.fg_pct)::numeric, 3)   AS avg_fg_pct,
                    COUNT(s.game_id)                   AS games_played
                FROM players p
                LEFT JOIN player_game_stats s ON p.player_id = s.player_id
                GROUP BY p.player_id, p.full_name, p.position, p.jersey_num, p.how_acquired
                ORDER BY avg_pts DESC NULLS LAST
            """)
            players = cur.fetchall()
        return {"players": [dict(p) for p in players]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/players/{player_id}/stats")
def get_player_stats(player_id: int):
    """Return per-game stats for a single player."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Player info
            cur.execute("SELECT * FROM players WHERE player_id = %s", (player_id,))
            player = cur.fetchone()
            if not player:
                raise HTTPException(status_code=404, detail="Player not found")

            # Per-game stats joined with game info
            cur.execute("""
                SELECT
                    s.game_id,
                    g.game_date,
                    g.matchup,
                    g.outcome,
                    s.min,
                    s.pts,
                    s.reb,
                    s.ast,
                    s.stl,
                    s.blk,
                    s.fg_pct,
                    s.fg3_pct,
                    s.ft_pct,
                    s.plus_minus
                FROM player_game_stats s
                LEFT JOIN games g ON s.game_id = g.game_id
                WHERE s.player_id = %s
                ORDER BY g.game_date DESC
            """, (player_id,))
            stats = cur.fetchall()

            # Season averages
            cur.execute("""
                SELECT
                    ROUND(AVG(pts)::numeric, 1)    AS avg_pts,
                    ROUND(AVG(reb)::numeric, 1)    AS avg_reb,
                    ROUND(AVG(ast)::numeric, 1)    AS avg_ast,
                    ROUND(AVG(stl)::numeric, 1)    AS avg_stl,
                    ROUND(AVG(blk)::numeric, 1)    AS avg_blk,
                    ROUND(AVG(fg_pct)::numeric, 3) AS avg_fg_pct,
                    ROUND(AVG(fg3_pct)::numeric, 3) AS avg_fg3_pct,
                    COUNT(*)                        AS games_played
                FROM player_game_stats
                WHERE player_id = %s
            """, (player_id,))
            averages = cur.fetchone()

        return {
            "player": dict(player),
            "averages": dict(averages),
            "game_log": [dict(s) for s in stats],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Games ─────────────────────────────────────────────────────────────────────

@app.get("/games")
def get_games(limit: int = 82):
    """Return all games this season, most recent first."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    game_id,
                    game_date,
                    matchup,
                    outcome,
                    pts,
                    opp_pts,
                    home_away
                FROM games
                ORDER BY game_date DESC
                LIMIT %s
            """, (limit,))
            games = cur.fetchall()
        return {"games": [dict(g) for g in games]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/games/{game_id}")
def get_game(game_id: str):
    """Return a single game plus every player's box score for that game."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Game info
            cur.execute("SELECT * FROM games WHERE game_id = %s", (game_id,))
            game = cur.fetchone()
            if not game:
                raise HTTPException(status_code=404, detail="Game not found")

            # Box score
            cur.execute("""
                SELECT
                    p.full_name,
                    p.position,
                    p.jersey_num,
                    s.min,
                    s.pts,
                    s.reb,
                    s.ast,
                    s.stl,
                    s.blk,
                    s.fg_pct,
                    s.fg3_pct,
                    s.ft_pct,
                    s.plus_minus
                FROM player_game_stats s
                JOIN players p ON s.player_id = p.player_id
                WHERE s.game_id = %s
                ORDER BY s.pts DESC
            """, (game_id,))
            box_score = cur.fetchall()

        return {
            "game": dict(game),
            "box_score": [dict(row) for row in box_score],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Stat Leaders ──────────────────────────────────────────────────────────────

@app.get("/stats/leaders")
def get_stat_leaders():
    """Return top 5 Rockets players in pts, reb, and ast."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            def top5(stat: str):
                cur.execute(f"""
                    SELECT
                        p.full_name,
                        p.player_id,
                        ROUND(AVG(s.{stat})::numeric, 1) AS avg
                    FROM player_game_stats s
                    JOIN players p ON s.player_id = p.player_id
                    GROUP BY p.player_id, p.full_name
                    ORDER BY avg DESC NULLS LAST
                    LIMIT 5
                """)
                return [dict(r) for r in cur.fetchall()]

            return {
                "points":   top5("pts"),
                "rebounds": top5("reb"),
                "assists":  top5("ast"),
                "steals":   top5("stl"),
                "blocks":   top5("blk"),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── Season summary ────────────────────────────────────────────────────────────

@app.get("/season/summary")
def get_season_summary():
    """Return the Rockets' overall season record and averages."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*)                              AS games_played,
                    SUM(CASE WHEN outcome = 'W' THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN outcome = 'L' THEN 1 ELSE 0 END) AS losses,
                    ROUND(AVG(pts)::numeric, 1)           AS avg_pts_for,
                    ROUND(AVG(opp_pts)::numeric, 1)       AS avg_pts_against,
                    SUM(CASE WHEN home_away = 'H' AND outcome = 'W' THEN 1 ELSE 0 END) AS home_wins,
                    SUM(CASE WHEN home_away = 'A' AND outcome = 'W' THEN 1 ELSE 0 END) AS away_wins
                FROM games
            """)
            summary = cur.fetchone()
        return dict(summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()