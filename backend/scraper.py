"""
rockets_scraper.py
------------------
Pulls Houston Rockets data from the NBA API and saves it to PostgreSQL.

Tables created:
  - players         : current roster info
  - games           : game-by-game results this season
  - player_game_stats : individual player stats per game

Requirements:
  pip install nba_api pandas psycopg2-binary python-dotenv
"""

import time
import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

from nba_api.stats.static import teams, players
from nba_api.stats.endpoints import (
    teamgamelog,
    commonteamroster,
    playergamelog,
)

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()  # reads from a .env file in the same folder

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", 5432),
    "dbname":   os.getenv("DB_NAME", "rockets_db"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

ROCKETS_ID = 1610612745   # Houston Rockets permanent NBA team ID
SEASON     = "2024-25"
DELAY      = 1.0           # seconds between API calls (avoid rate-limiting)

# ── Database helpers ──────────────────────────────────────────────────────────

def get_connection():
    """Return a live psycopg2 connection."""
    return psycopg2.connect(**DB_CONFIG)


def create_tables(conn):
    """Create all tables if they don't already exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS players (
                player_id   INTEGER PRIMARY KEY,
                full_name   TEXT    NOT NULL,
                position    TEXT,
                jersey_num  TEXT,
                how_acquired TEXT
            );

            CREATE TABLE IF NOT EXISTS games (
                game_id     TEXT PRIMARY KEY,
                game_date   DATE NOT NULL,
                matchup     TEXT,
                outcome     CHAR(1),          -- 'W' or 'L'
                pts         INTEGER,
                opp_pts     INTEGER,
                home_away   CHAR(1)           -- 'H' or 'A'
            );

            CREATE TABLE IF NOT EXISTS player_game_stats (
                id          SERIAL PRIMARY KEY,
                player_id   INTEGER REFERENCES players(player_id),
                game_id     TEXT,
                min         TEXT,
                pts         INTEGER,
                reb         INTEGER,
                ast         INTEGER,
                stl         INTEGER,
                blk         INTEGER,
                fg_pct      NUMERIC(5,3),
                fg3_pct     NUMERIC(5,3),
                ft_pct      NUMERIC(5,3),
                plus_minus  INTEGER,
                UNIQUE (player_id, game_id)
            );
        """)
    conn.commit()
    print("✅ Tables ready.")


# ── Scraping helpers ──────────────────────────────────────────────────────────

def fetch_roster() -> pd.DataFrame:
    """Return the current Rockets roster as a DataFrame."""
    print("📋 Fetching roster...")
    roster = commonteamroster.CommonTeamRoster(
        team_id=ROCKETS_ID, season=SEASON
    )
    df = roster.get_data_frames()[0]
    # Rename to match our schema
    df = df.rename(columns={
        "PLAYER_ID":    "player_id",
        "PLAYER":       "full_name",
        "POSITION":     "position",
        "NUM":          "jersey_num",
        "HOW_ACQUIRED": "how_acquired",
    })
    return df[["player_id", "full_name", "position", "jersey_num", "how_acquired"]]


def fetch_game_log() -> pd.DataFrame:
    """Return Rockets game-by-game results for the season."""
    print("🏀 Fetching team game log...")
    log = teamgamelog.TeamGameLog(team_id=ROCKETS_ID, season=SEASON)
    df  = log.get_data_frames()[0]

    df["game_date"] = pd.to_datetime(df["GAME_DATE"], format="mixed").dt.date
    df["home_away"] = df["MATCHUP"].apply(lambda m: "H" if "vs." in m else "A")

    # safely calculate opp_pts if column exists
    if "PLUS_MINUS" in df.columns:
        df["opp_pts"] = df["PTS"] - df["PLUS_MINUS"]
    else:
        df["opp_pts"] = None

    df = df.rename(columns={
        "Game_ID":  "game_id",
        "MATCHUP":  "matchup",
        "WL":       "outcome",
        "PTS":      "pts",
    })
    return df[["game_id", "game_date", "matchup", "outcome", "pts", "opp_pts", "home_away"]]


def fetch_player_stats(player_id: int, player_name: str) -> pd.DataFrame:
    """Return per-game stats for one player this season."""
    print(f"  📊 Fetching stats for {player_name}...")
    time.sleep(DELAY)  # be polite to the NBA API
    try:
        log = playergamelog.PlayerGameLog(
            player_id=player_id, season=SEASON
        )
        df = log.get_data_frames()[0]
        if df.empty:
            return pd.DataFrame()

        df = df.rename(columns={
            "Game_ID":   "game_id",
            "PTS":       "pts",
            "REB":       "reb",
            "AST":       "ast",
            "STL":       "stl",
            "BLK":       "blk",
            "FG_PCT":    "fg_pct",
            "FG3_PCT":   "fg3_pct",
            "FT_PCT":    "ft_pct",
            "PLUS_MINUS":"plus_minus",
            "MIN":       "min",
        })
        df["player_id"] = player_id
        cols = ["player_id", "game_id", "min", "pts", "reb", "ast",
                "stl", "blk", "fg_pct", "fg3_pct", "ft_pct", "plus_minus"]
        return df[cols]

    except Exception as e:
        print(f"  ⚠️  Could not fetch stats for {player_name}: {e}")
        return pd.DataFrame()


# ── Database writers ──────────────────────────────────────────────────────────

def upsert_players(conn, df: pd.DataFrame):
    rows = list(df.itertuples(index=False, name=None))
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO players (player_id, full_name, position, jersey_num, how_acquired)
            VALUES %s
            ON CONFLICT (player_id) DO UPDATE SET
                full_name    = EXCLUDED.full_name,
                position     = EXCLUDED.position,
                jersey_num   = EXCLUDED.jersey_num,
                how_acquired = EXCLUDED.how_acquired
        """, rows)
    conn.commit()
    print(f"  ✅ Upserted {len(rows)} players.")


def upsert_games(conn, df: pd.DataFrame):
    rows = list(df.itertuples(index=False, name=None))
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO games (game_id, game_date, matchup, outcome, pts, opp_pts, home_away)
            VALUES %s
            ON CONFLICT (game_id) DO UPDATE SET
                outcome   = EXCLUDED.outcome,
                pts       = EXCLUDED.pts,
                opp_pts   = EXCLUDED.opp_pts
        """, rows)
    conn.commit()
    print(f"  ✅ Upserted {len(rows)} games.")


def upsert_player_game_stats(conn, df: pd.DataFrame):
    if df.empty:
        return
    rows = list(df.itertuples(index=False, name=None))
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO player_game_stats
                (player_id, game_id, min, pts, reb, ast, stl, blk,
                 fg_pct, fg3_pct, ft_pct, plus_minus)
            VALUES %s
            ON CONFLICT (player_id, game_id) DO UPDATE SET
                pts        = EXCLUDED.pts,
                reb        = EXCLUDED.reb,
                ast        = EXCLUDED.ast,
                plus_minus = EXCLUDED.plus_minus
        """, rows)
    conn.commit()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("🚀 Houston Rockets Data Scraper")
    print("=" * 40)

    conn = get_connection()
    create_tables(conn)

    # 1. Roster
    roster_df = fetch_roster()
    upsert_players(conn, roster_df)

    # 2. Team game log
    games_df = fetch_game_log()
    upsert_games(conn, games_df)

    # 3. Player stats (loop over every player on the roster)
    print("\n📈 Fetching individual player stats...")
    for _, row in roster_df.iterrows():
        stats_df = fetch_player_stats(row["player_id"], row["full_name"])
        upsert_player_game_stats(conn, stats_df)

    conn.close()
    print("\n🏁 Done! Your database is populated and ready.")
    print("Next step: build the FastAPI backend to serve this data.")


if __name__ == "__main__":
    main()
