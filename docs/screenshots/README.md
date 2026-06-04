# Screenshots

Drop PNG screenshots here using the exact filenames below. The root `README.md`
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

## Automated capture (recommended)

A Playwright script captures all of these in one run at a consistent width.

1. Start the backend (`uvicorn main:app --reload`) and frontend (`npm start`),
   with the database populated.
2. Run:

   ```bash
   cd scripts
   npm install        # installs Playwright + a headless Chromium
   npm run capture
   ```

The script writes every file above into this folder at 1440px wide (2x scale for
crisp, retina-quality PNGs), above-the-fold. Re-run it any time the UI changes.

Overrides via environment variables: `BASE_URL`, `API_URL`, `WIDTH`, `HEIGHT`,
`SCALE`, `SETTLE` (see `scripts/capture-screenshots.js`).

## Manual capture (alternative)

1. Start the backend and frontend.
2. Open each page at a 1440px-wide window for consistent shots.
3. Press `Win + Shift + S`, capture the page, and save with the filename above.
4. Recommended: 1600x1000 or larger, PNG, so the images stay crisp in the README.
