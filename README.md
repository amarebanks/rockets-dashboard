# Houston Rockets Dashboard

A full-stack analytics dashboard for the Houston Rockets 2024–25 season. Built with FastAPI, PostgreSQL, and React.

## Features

- **Dashboard** — Season overview: wins/losses, scoring trend, stat leaders, recent games
- **Players** — Full roster browser with player cards, position filter, sort, and 2K-style OVR rating
- **Player Profile** — Season averages with league rankings, advanced stats (Off/Def Rtg, TS%, eFG%, USG%, PIE), shot chart, game-by-game trend, skill radar
- **Game Log** — Full season game log with box scores, filters, and outcome breakdown
- **Team Stats** — Shooting splits, zone breakdown, monthly win/loss chart
- **Compare** — Side-by-side comparison of any two NBA players
- **Live Scores** — Real-time NBA scoreboard
- **Trade Analyzer** — Custom algorithm scoring players 0–100 (Trade Value) and 40–99 (2K-style OVR) with draft pick values, tier system, and historical trade reference

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, psycopg2 |
| Data | nba_api (NBA Stats API) |
| Database | PostgreSQL |
| Frontend | React 19, Recharts, Axios |

## Project Structure

```
rockets-dashboard/
├── backend/
│   ├── main.py          # FastAPI app — all API endpoints
│   ├── scraper.py       # Data pipeline — populates PostgreSQL from NBA API
│   ├── .env             # Local secrets — not committed (see .env.example)
│   └── .env.example     # Environment variable template
├── frontend/
│   └── src/
│       ├── App.js
│       ├── pages/
│       └── components/
└── README.md
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### 1. Database

```sql
CREATE DATABASE rockets_db;
```

### 2. Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate   Mac/Linux: source venv/bin/activate
pip install fastapi uvicorn psycopg2-binary python-dotenv nba_api pandas
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rockets_db
DB_USER=postgres
DB_PASSWORD=your_password_here
```

Populate the database (takes ~10 minutes):

```bash
python scraper.py
```

Start the API:

```bash
uvicorn main:app --reload
```

API runs at `http://127.0.0.1:8000`. Docs at `/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/players` | Rockets roster with season averages |
| GET | `/players/overalls` | 2K-style OVR for each Rockets player (DB-only, fast) |
| GET | `/players/{id}` | Player detail + full game log |
| GET | `/players/{id}/advanced` | Off/Def Rtg, TS%, eFG%, USG%, PIE, league rankings |
| GET | `/games` | Team game log |
| GET | `/games/{id}` | Box score |
| GET | `/season/summary` | Win/loss record and scoring averages |
| GET | `/stats/leaders` | Top 5 per stat category |
| GET | `/team/stats` | Shooting splits, zone breakdown, monthly record |
| GET | `/shots/{player_id}` | Shot chart data |
| GET | `/nba/search` | Search any NBA player by name |
| GET | `/nba/player/{id}/stats` | Live stats for any NBA player |
| GET | `/trade/value/{id}` | Trade Value (0–100) + OVR (40–99) for any NBA player |
| GET | `/live/scores` | Today's NBA scoreboard |

## Trade Value Algorithm

Players receive a **Trade Value (0–100)** and a **2K-style Overall (40–99)** computed from:

PPG · RPG · APG · STL · BLK · Plus/Minus · TS% · eFG% · Off Rating · Def Rating · USG% · Games Played · Age · Position · Recognition Tier

| Overall | Trade Value | Tier |
|---|---|---|
| 97–99 | 96–100 | Elite Cornerstone |
| 90–96 | 85–95 | Franchise Star |
| 81–89 | 70–84 | All-Star Caliber |
| 72–80 | 55–69 | Starter |
| 64–71 | 40–54 | Rotation Player |
| 55–63 | 25–39 | Bench Player |
| 40–54 | 0–24 | Fringe Roster |

## Notes

- No API keys required — all NBA data is fetched via the public `nba_api` library.
- The NBA Stats API rate-limits requests; the backend adds delays between calls automatically.
- Shot chart data is only available for Regular Season in the current database schema.
- Advanced stats load live from the NBA API on each player profile visit (~2–3 seconds).
