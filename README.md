# 🚀 Houston Rockets Stats Dashboard

A full-stack data pipeline and analytics dashboard for the Houston Rockets 2024–25 NBA season. Built with Python, FastAPI, PostgreSQL, and React.

![Dashboard Preview](https://img.shields.io/badge/Status-Live-brightgreen) ![Python](https://img.shields.io/badge/Python-3.13-blue) ![React](https://img.shields.io/badge/React-18-61DAFB) ![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791)

---

## 📸 Features

- **Season Summary** — wins, losses, win percentage, points for/against, home vs away record
- **Points Per Game Chart** — interactive line chart tracking scoring trends across the last 20 games
- **Stat Leaders** — top 5 Rockets players in points, rebounds, assists, steals, and blocks
- **Roster Table** — full roster with season averages (GP, PTS, REB, AST, FG%)
- **Recent Games** — last 10 game results with score and opponent

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Data Source | `nba_api` Python library |
| Database | PostgreSQL |
| Backend | FastAPI + psycopg2 |
| Frontend | React + Recharts + Axios |
| Styling | Custom CSS with Google Fonts |

---

## 🏗️ Architecture

```
rockets-dashboard/
├── backend/
│   ├── scraper.py      # Pulls data from NBA API → PostgreSQL
│   ├── main.py         # FastAPI REST API (6 endpoints)
│   └── .env            # Database credentials (not committed)
└── frontend/
    └── src/
        └── App.js      # React dashboard (single page)
```

### Data Flow

```
NBA API → scraper.py → PostgreSQL → FastAPI → React Dashboard
```

### Database Schema

**players** — roster info (player_id, full_name, position, jersey_num)

**games** — game-by-game results (game_id, game_date, matchup, outcome, pts, opp_pts)

**player_game_stats** — individual stats per game (pts, reb, ast, stl, blk, fg_pct, plus_minus)

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/players` | Full roster with season averages |
| GET | `/players/{id}/stats` | Per-game stats for one player |
| GET | `/games` | All 82 games this season |
| GET | `/games/{id}` | Single game box score |
| GET | `/stats/leaders` | Top 5 in pts, reb, ast, stl, blk |
| GET | `/season/summary` | Overall record and scoring averages |

Interactive API docs available at `http://localhost:8000/docs`

---

## 🚀 Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 18+

### 1. Clone the repo

```bash
git clone https://github.com/amarebanks/rockets-dashboard.git
cd rockets-dashboard
```

### 2. Set up the database

```bash
psql -U postgres
CREATE DATABASE rockets_db;
\q
```

### 3. Configure environment variables

Create a `.env` file in the `backend` folder:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rockets_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 4. Install Python dependencies & run the scraper

```bash
cd backend
pip install nba_api pandas psycopg2-binary python-dotenv fastapi uvicorn
python scraper.py
```

### 5. Start the API

```bash
python -m uvicorn main:app --reload
```

API runs at `http://localhost:8000`

### 6. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm start
```

Dashboard runs at `http://localhost:3000`

---

## 📊 Data

All stats are sourced from the official NBA Stats API via the `nba_api` Python library. The scraper pulls:

- Current Rockets roster (18 players)
- Full 82-game regular season log
- Per-game stats for every player on the roster

Re-run `scraper.py` at any time to refresh the data.

---

## 👤 Author

**Amare Banks**

- GitHub: [@amarebanks](https://github.com/amarebanks)
