"""
shot_scraper.py - v2
Pulls Regular Season AND Playoff shot data for all Rockets players.
Skips players already loaded. Retries on timeout.
"""

import time
import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from nba_api.stats.endpoints import shotchartdetail

load_dotenv()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", 5432),
    "dbname":   os.getenv("DB_NAME", "rockets_db"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}

ROCKETS_ID = 1610612745
SEASON     = os.getenv("ROCKETS_SEASON", "2024-25")  # override: ROCKETS_SEASON=2025-26
DELAY      = 2.0

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

def parse_shot_df(df, player_id, season_type):
    df["player_id"]   = player_id
    df["season_type"] = season_type
    df["season"]      = SEASON
    df["made"]        = df["SHOT_MADE_FLAG"].astype(bool)
    df["x"]           = df["LOC_X"]
    df["y"]           = df["LOC_Y"]
    df["shot_zone"]   = df["SHOT_ZONE_BASIC"]
    df["shot_type"]   = df["SHOT_TYPE"]
    df["distance"]    = df["SHOT_DISTANCE"]
    df["action_type"] = df["ACTION_TYPE"]
    df["game_id"]     = df["GAME_ID"]
    return df[["player_id", "game_id", "season_type", "season", "made", "x", "y",
               "shot_zone", "shot_type", "distance", "action_type"]]

def fetch_shots_from_api(player_id, season_type):
    chart = shotchartdetail.ShotChartDetail(
        team_id=ROCKETS_ID,
        player_id=player_id,
        season_nullable=SEASON,
        season_type_all_star=season_type,
        context_measure_simple="FGA",
    )
    return chart.get_data_frames()[0]

def fetch_player_shots(player_id, player_name, season_type):
    print(f"  🎯 {player_name} ({season_type})...")
    time.sleep(DELAY)
    for attempt in range(2):
        try:
            df = fetch_shots_from_api(player_id, season_type)
            if df.empty:
                print(f"    ⚠️  No shots found")
                return pd.DataFrame()
            result = parse_shot_df(df, player_id, season_type)
            print(f"    ✅ {len(result)} shots ({result['made'].sum()} made)")
            return result
        except Exception as e:
            if attempt == 0:
                print(f"    ⚠️  Timeout, retrying in 10s...")
                time.sleep(10)
            else:
                print(f"    ❌ Failed: {e}")
                return pd.DataFrame()

def upsert_shots(conn, df):
    if df.empty:
        return
    player_id   = int(df["player_id"].iloc[0])
    season_type = df["season_type"].iloc[0]
    with conn.cursor() as cur:
        cur.execute("DELETE FROM shots WHERE player_id = %s AND season_type = %s AND season = %s",
                    (player_id, season_type, SEASON))
    rows = [(int(r.player_id), r.game_id, r.season_type, r.season, bool(r.made), int(r.x), int(r.y),
             r.shot_zone, r.shot_type, int(r.distance), r.action_type)
            for r in df.itertuples(index=False)]
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO shots (player_id, game_id, season_type, season, made, x, y, shot_zone, shot_type, distance, action_type)
            VALUES %s
        """, rows)
    conn.commit()

def already_loaded(conn, player_id, season_type):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM shots WHERE player_id = %s AND season_type = %s AND season = %s",
                    (player_id, season_type, SEASON))
        return cur.fetchone()[0] > 0

def main():
    print("🎯 Houston Rockets Shot Chart Scraper v2")
    print("=" * 40)
    conn = get_connection()
    with conn.cursor() as cur:
        # Only players who actually appeared for Houston in this season (avoids empty
        # pulls for ex-Rockets still in the players union table).
        cur.execute("""
            SELECT DISTINCT p.player_id, p.full_name
            FROM players p JOIN player_game_stats s ON p.player_id = s.player_id
            WHERE s.season = %s
            ORDER BY p.full_name
        """, (SEASON,))
        players = cur.fetchall()

    print(f"Found {len(players)} players.\n")

    for season_type in ["Regular Season", "Playoffs"]:
        print(f"\n📅 {season_type}")
        print("-" * 30)
        for player_id, full_name in players:
            if already_loaded(conn, player_id, season_type):
                print(f"  ⏭️  Skipping {full_name} (already loaded)")
                continue
            df = fetch_player_shots(player_id, full_name, season_type)
            upsert_shots(conn, df)

    conn.close()
    print("\n🏁 Done! Re-run to retry any failures.")

if __name__ == "__main__":
    main()
