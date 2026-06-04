"""
scraper.py - Houston Rockets complete data pipeline
----------------------------------------------------
Uses box scores as the primary stat source so that every player who appeared
in any game is captured, not just the current roster.

Tables:
  players           - player info (id, name, position, jersey, how_acquired)
  games             - team game log with opponent scores
  player_game_stats - per-player per-game stats with raw shot counts

Run: python scraper.py
"""

import time
import os
import math
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

from nba_api.stats.endpoints import (
    teamgamelog,
    commonteamroster,
    boxscoretraditionalv2,
)

load_dotenv()

ROCKETS_ID  = 1610612745
ROCKETS_ABV = "HOU"
SEASON      = os.getenv("ROCKETS_SEASON", "2024-25")  # override: ROCKETS_SEASON=2025-26
DELAY       = 1.0  # seconds between API calls

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", 5432),
    "dbname":   os.getenv("DB_NAME", "rockets_db"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

# Database

def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def create_tables(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS players (
                player_id    INTEGER PRIMARY KEY,
                full_name    TEXT NOT NULL,
                position     TEXT,
                jersey_num   TEXT,
                how_acquired TEXT
            );

            CREATE TABLE IF NOT EXISTS games (
                game_id    TEXT PRIMARY KEY,
                game_date  DATE NOT NULL,
                matchup    TEXT,
                outcome    CHAR(1),
                pts        INTEGER,
                opp_pts    INTEGER,
                home_away  CHAR(1),
                season_type TEXT,
                season      TEXT
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
                fgm         INTEGER,
                fga         INTEGER,
                fg3m        INTEGER,
                fg3a        INTEGER,
                ftm         INTEGER,
                fta         INTEGER,
                fg_pct      NUMERIC(5,3),
                fg3_pct     NUMERIC(5,3),
                ft_pct      NUMERIC(5,3),
                plus_minus  INTEGER,
                season_type TEXT,
                season      TEXT,
                UNIQUE (player_id, game_id)
            );
        """)
        # Migrate any existing tables that are missing columns
        migrations = [
            ("games",             "season_type", "TEXT"),
            ("games",             "opp_pts",     "INTEGER"),
            ("games",             "season",      "TEXT"),
            ("player_game_stats", "fgm",         "INTEGER"),
            ("player_game_stats", "fga",         "INTEGER"),
            ("player_game_stats", "fg3m",        "INTEGER"),
            ("player_game_stats", "fg3a",        "INTEGER"),
            ("player_game_stats", "ftm",         "INTEGER"),
            ("player_game_stats", "fta",         "INTEGER"),
            ("player_game_stats", "season_type", "TEXT"),
            ("player_game_stats", "season",      "TEXT"),
        ]
        for table, col, dtype in migrations:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {dtype}")
    conn.commit()
    print("Tables ready.")


# Scrapers

def fetch_roster():
    print("Fetching current roster...")
    df = commonteamroster.CommonTeamRoster(team_id=ROCKETS_ID, season=SEASON).get_data_frames()[0]
    df = df.rename(columns={
        "PLAYER_ID":    "player_id",
        "PLAYER":       "full_name",
        "POSITION":     "position",
        "NUM":          "jersey_num",
        "HOW_ACQUIRED": "how_acquired",
    })
    return df[["player_id", "full_name", "position", "jersey_num", "how_acquired"]]


def fetch_game_log(season_type="Regular Season"):
    print(f"Fetching {season_type} game log...")
    log = teamgamelog.TeamGameLog(
        team_id=ROCKETS_ID, season=SEASON, season_type_all_star=season_type
    )
    df = log.get_data_frames()[0]
    if df.empty:
        return pd.DataFrame()
    df["game_date"] = pd.to_datetime(df["GAME_DATE"], format="mixed").dt.date
    df["home_away"] = df["MATCHUP"].apply(lambda m: "H" if "vs." in m else "A")
    df["season_type"] = season_type
    df = df.rename(columns={"Game_ID": "game_id", "MATCHUP": "matchup", "WL": "outcome", "PTS": "pts"})
    df["opp_pts"] = None
    return df[["game_id", "game_date", "matchup", "outcome", "pts", "opp_pts", "home_away", "season_type"]]


def fetch_all_from_boxscores(conn, games_df, season_type="Regular Season"):
    """
    For each game fetch the box score and extract:
      - Opponent final score
      - Stats for EVERY Rockets player who appeared (not just current roster)

    This is the complete, accurate approach - individual player game logs would
    miss anyone traded away mid-season.
    """
    total = len(games_df)
    print(f"Fetching box scores for {total} {season_type} games...")

    for i, (_, row) in enumerate(games_df.iterrows()):
        time.sleep(DELAY)
        try:
            box        = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=row["game_id"])
            player_df  = box.get_data_frames()[0]   # all players both teams
            team_df    = box.get_data_frames()[1]    # team totals

            # Opponent score
            opp = team_df[team_df["TEAM_ABBREVIATION"] != ROCKETS_ABV]
            if not opp.empty:
                opp_pts = int(opp["PTS"].iloc[0])
                with conn.cursor() as cur:
                    cur.execute("UPDATE games SET opp_pts=%s WHERE game_id=%s",
                                (opp_pts, row["game_id"]))
                conn.commit()

            # Houston players
            hou = player_df[player_df["TEAM_ABBREVIATION"] == ROCKETS_ABV].copy()

            # Ensure all players exist in the players table before inserting stats
            for _, p in hou.iterrows():
                _ensure_player(conn, int(p["PLAYER_ID"]), str(p["PLAYER_NAME"]))

            _upsert_boxscore_stats(conn, hou, row["game_id"], season_type)

            opp_pts_str = str(opp_pts) if not opp.empty else "?"
            print(f"  [{i+1}/{total}] {row['matchup']}  "
                  f"opp:{opp_pts_str}  players:{len(hou)}")

        except Exception as e:
            print(f"  [!] {row.get('matchup', row['game_id'])}: {e}")


# Database helpers

def _ensure_player(conn, player_id, full_name, position=None, jersey_num=None, how_acquired=None):
    """Insert player if new; update name/position only if those fields aren't already set."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO players (player_id, full_name, position, jersey_num, how_acquired)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (player_id) DO UPDATE SET
                full_name    = EXCLUDED.full_name,
                position     = COALESCE(players.position,    EXCLUDED.position),
                jersey_num   = COALESCE(players.jersey_num,  EXCLUDED.jersey_num),
                how_acquired = COALESCE(players.how_acquired, EXCLUDED.how_acquired)
        """, (player_id, full_name, position, jersey_num, how_acquired))
    conn.commit()


def _safe_int(v):
    try:
        f = float(v)
        return None if math.isnan(f) else int(f)
    except (TypeError, ValueError):
        return None


def _safe_float(v):
    try:
        f = float(v)
        return None if math.isnan(f) else round(f, 3)
    except (TypeError, ValueError):
        return None


def _upsert_boxscore_stats(conn, hou_df, game_id, season_type):
    """Upsert stats for all Rockets players from a single game's box score."""
    rows = []
    for _, p in hou_df.iterrows():
        # Skip DNP rows (MIN is null/empty)
        raw_min = str(p.get("MIN", "") or "").strip()
        if not raw_min or raw_min in ("0:00", "0", "nan"):
            continue

        rows.append((
            int(p["PLAYER_ID"]), game_id, raw_min,
            _safe_int(p.get("PTS")),  _safe_int(p.get("REB")),  _safe_int(p.get("AST")),
            _safe_int(p.get("STL")),  _safe_int(p.get("BLK")),
            _safe_int(p.get("FGM")),  _safe_int(p.get("FGA")),
            _safe_int(p.get("FG3M")), _safe_int(p.get("FG3A")),
            _safe_int(p.get("FTM")),  _safe_int(p.get("FTA")),
            _safe_float(p.get("FG_PCT")), _safe_float(p.get("FG3_PCT")), _safe_float(p.get("FT_PCT")),
            _safe_int(p.get("PLUS_MINUS")), season_type, SEASON,
        ))

    if not rows:
        return

    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO player_game_stats
                (player_id, game_id, min, pts, reb, ast, stl, blk,
                 fgm, fga, fg3m, fg3a, ftm, fta,
                 fg_pct, fg3_pct, ft_pct, plus_minus, season_type, season)
            VALUES %s
            ON CONFLICT (player_id, game_id) DO UPDATE SET
                min        = EXCLUDED.min,
                pts        = EXCLUDED.pts,        reb        = EXCLUDED.reb,
                ast        = EXCLUDED.ast,        stl        = EXCLUDED.stl,
                blk        = EXCLUDED.blk,        fgm        = EXCLUDED.fgm,
                fga        = EXCLUDED.fga,        fg3m       = EXCLUDED.fg3m,
                fg3a       = EXCLUDED.fg3a,       ftm        = EXCLUDED.ftm,
                fta        = EXCLUDED.fta,        fg_pct     = EXCLUDED.fg_pct,
                fg3_pct    = EXCLUDED.fg3_pct,    ft_pct     = EXCLUDED.ft_pct,
                plus_minus = EXCLUDED.plus_minus, season_type= EXCLUDED.season_type,
                season     = EXCLUDED.season
        """, rows)
    conn.commit()


def upsert_players(conn, df):
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
    print(f"  Upserted {len(rows)} current roster players.")


def upsert_games(conn, df, season_type):
    df = df.copy()
    df["season_type"] = season_type
    df["season"] = SEASON
    rows = list(df[["game_id", "game_date", "matchup", "outcome",
                    "pts", "opp_pts", "home_away", "season_type", "season"]].itertuples(index=False, name=None))
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO games (game_id, game_date, matchup, outcome, pts, opp_pts, home_away, season_type, season)
            VALUES %s
            ON CONFLICT (game_id) DO UPDATE SET
                outcome     = EXCLUDED.outcome,
                pts         = EXCLUDED.pts,
                season_type = EXCLUDED.season_type,
                season      = EXCLUDED.season
        """, rows)
    conn.commit()
    print(f"  Upserted {len(rows)} {season_type} games.")


# Main

def cleanup_orphaned_stats(conn):
    """
    Remove player_game_stats rows whose game_id is not in the games table.
    These come from the old scraper approach (individual player game logs) which
    included games a player played for a previous team before being traded to Houston.
    """
    with conn.cursor() as cur:
        cur.execute("""
            DELETE FROM player_game_stats
            WHERE game_id NOT IN (SELECT game_id FROM games)
        """)
        deleted = cur.rowcount
    conn.commit()
    if deleted:
        print(f"  Cleaned up {deleted} orphaned rows (previous-team games).")


def main():
    print("Houston Rockets Data Scraper - 2024-25")
    print("=" * 45)
    print("Strategy: box scores capture ALL players, including traded/waived players.")
    print()

    conn = get_connection()
    create_tables(conn)

    # 1. Current roster (for position/jersey metadata)
    roster_df = fetch_roster()
    upsert_players(conn, roster_df)

    # 2. Purge any rows from players' previous teams (left by old scraper approach)
    print("Cleaning up orphaned stats...")
    cleanup_orphaned_stats(conn)

    # 3. Regular Season
    print()
    rs_games = fetch_game_log("Regular Season")
    if not rs_games.empty:
        upsert_games(conn, rs_games, "Regular Season")
        time.sleep(1)
        fetch_all_from_boxscores(conn, rs_games, "Regular Season")

    # 3. Playoffs
    print()
    po_games = fetch_game_log("Playoffs")
    if not po_games.empty:
        upsert_games(conn, po_games, "Playoffs")
        time.sleep(1)
        fetch_all_from_boxscores(conn, po_games, "Playoffs")
    else:
        print("  No playoff games found.")

    conn.close()
    print()
    print("Done! Database fully populated with all-player stats.")


if __name__ == "__main__":
    main()
