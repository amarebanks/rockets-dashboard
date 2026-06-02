"""
playoff_scraper.py
------------------
Pulls Rockets 2024-25 Playoff game log and player stats into PostgreSQL.
Adds a season_type column to games and player_game_stats tables.

Run AFTER scraper.py has populated the base tables.
"""

import time
import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from nba_api.stats.endpoints import teamgamelog, playergamelog, boxscoretraditionalv2

load_dotenv()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", 5432),
    "dbname":   os.getenv("DB_NAME", "rockets_db"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

ROCKETS_ID = 1610612745
SEASON     = "2024-25"
DELAY      = 1.5

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def migrate_tables(conn):
    """Add season_type column to games and player_game_stats if not present."""
    with conn.cursor() as cur:
        cur.execute("""
            ALTER TABLE games
            ADD COLUMN IF NOT EXISTS season_type TEXT DEFAULT 'Regular Season';
        """)
        cur.execute("""
            ALTER TABLE player_game_stats
            ADD COLUMN IF NOT EXISTS season_type TEXT DEFAULT 'Regular Season';
        """)
    conn.commit()
    print("✅ Tables migrated.")

def fetch_playoff_games():
    print("🏆 Fetching playoff game log...")
    log = teamgamelog.TeamGameLog(
        team_id=ROCKETS_ID, season=SEASON, season_type_all_star="Playoffs"
    )
    df = log.get_data_frames()[0]
    if df.empty:
        print("  ⚠️  No playoff games found.")
        return pd.DataFrame()

    df["game_date"] = pd.to_datetime(df["GAME_DATE"], format="mixed").dt.date
    df["home_away"] = df["MATCHUP"].apply(lambda m: "H" if "vs." in m else "A")
    df["opp_pts"]   = None
    df["season_type"] = "Playoffs"
    df = df.rename(columns={"Game_ID": "game_id", "MATCHUP": "matchup", "WL": "outcome", "PTS": "pts"})
    return df[["game_id", "game_date", "matchup", "outcome", "pts", "opp_pts", "home_away", "season_type"]]

def fetch_opp_scores(conn, games_df):
    print("🔢 Fetching opponent scores for playoff games...")
    for i, (_, row) in enumerate(games_df.iterrows()):
        time.sleep(DELAY)
        try:
            box = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=row["game_id"])
            team_stats = box.get_data_frames()[1]
            opp_row = team_stats[team_stats["TEAM_ABBREVIATION"] != "HOU"]
            if not opp_row.empty:
                opp_pts = int(opp_row["PTS"].iloc[0])
                with conn.cursor() as cur:
                    cur.execute("UPDATE games SET opp_pts = %s WHERE game_id = %s", (opp_pts, row["game_id"]))
                conn.commit()
                print(f"  [{i+1}/{len(games_df)}] {row['matchup']} → opp: {opp_pts}")
        except Exception as e:
            print(f"  ⚠️  {row['game_id']}: {e}")

def upsert_games(conn, df):
    rows = list(df.itertuples(index=False, name=None))
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO games (game_id, game_date, matchup, outcome, pts, opp_pts, home_away, season_type)
            VALUES %s
            ON CONFLICT (game_id) DO UPDATE SET
                outcome     = EXCLUDED.outcome,
                pts         = EXCLUDED.pts,
                opp_pts     = EXCLUDED.opp_pts,
                season_type = EXCLUDED.season_type
        """, rows)
    conn.commit()
    print(f"  ✅ Upserted {len(rows)} playoff games.")

def fetch_player_stats(player_id, player_name):
    print(f"  📊 {player_name}...")
    time.sleep(DELAY)
    try:
        log = playergamelog.PlayerGameLog(
            player_id=player_id, season=SEASON, season_type_all_star="Playoffs"
        )
        df = log.get_data_frames()[0]
        if df.empty:
            return pd.DataFrame()
        df = df.rename(columns={
            "Game_ID": "game_id", "PTS": "pts", "REB": "reb", "AST": "ast",
            "STL": "stl", "BLK": "blk", "FG_PCT": "fg_pct", "FG3_PCT": "fg3_pct",
            "FT_PCT": "ft_pct", "PLUS_MINUS": "plus_minus", "MIN": "min",
        })
        df["player_id"]   = player_id
        df["season_type"] = "Playoffs"
        cols = ["player_id", "game_id", "season_type", "min", "pts", "reb",
                "ast", "stl", "blk", "fg_pct", "fg3_pct", "ft_pct", "plus_minus"]
        return df[cols]
    except Exception as e:
        print(f"    ⚠️  {player_name}: {e}")
        return pd.DataFrame()

def upsert_player_stats(conn, df):
    if df.empty:
        return
    rows = list(df.itertuples(index=False, name=None))
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO player_game_stats
                (player_id, game_id, season_type, min, pts, reb, ast, stl, blk, fg_pct, fg3_pct, ft_pct, plus_minus)
            VALUES %s
            ON CONFLICT (player_id, game_id) DO UPDATE SET
                pts        = EXCLUDED.pts,
                reb        = EXCLUDED.reb,
                ast        = EXCLUDED.ast,
                season_type = EXCLUDED.season_type
        """, rows)
    conn.commit()

def main():
    print("🏆 Houston Rockets Playoff Scraper")
    print("=" * 40)
    conn = get_connection()

    # 1. Migrate tables
    migrate_tables(conn)

    # 2. Playoff games
    games_df = fetch_playoff_games()
    if games_df.empty:
        print("No playoff games found. Exiting.")
        conn.close()
        return

    upsert_games(conn, games_df)
    fetch_opp_scores(conn, games_df)

    # 3. Player stats
    print("\n📈 Fetching playoff player stats...")
    with conn.cursor() as cur:
        cur.execute("SELECT player_id, full_name FROM players ORDER BY full_name")
        players = cur.fetchall()

    for player_id, full_name in players:
        df = fetch_player_stats(player_id, full_name)
        upsert_player_stats(conn, df)

    conn.close()
    print("\n🏁 Playoff data loaded!")

if __name__ == "__main__":
    main()
