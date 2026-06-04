# Screenshots

Drop PNG screenshots here using the exact filenames below — the root `README.md`
references each one, so the moment a file exists it renders automatically.

| Filename | Page to capture | Route |
|---|---|---|
| `dashboard.png` | Season overview (hero shot) | `/` |
| `players.png` | Roster browser with OVR ratings | `/players` |
| `player-profile.png` | Player profile: advanced stats, shot chart, radar | `/player/:id` |
| `compare.png` | Two-player comparison | `/compare` |
| `team.png` | Team hub: shooting splits / lineups / clutch | `/team` |
| `trade-machine.png` | Cap-legal Trade Machine | `/trade` |
| `builder.png` | Championship Builder trade ideas | `/build` |
| `caps.png` | Salary cap and contracts, with relief plan | `/caps` |
| `draft.png` | Draft capital and pick ownership | `/draft` |
| `forecast.png` | Game predictor / betting edge | `/forecast` |
| `live.png` | Live NBA scoreboard | `/live` |

## How to capture (Windows)

1. Start the backend (`uvicorn main:app --reload`) and frontend (`npm start`).
2. Open each page in the browser at a 1440px-wide window for consistent shots.
3. Press `Win + Shift + S`, capture the page, and save with the filename above.
4. Recommended: 1600x1000 or larger, PNG, so the images stay crisp in the README.
