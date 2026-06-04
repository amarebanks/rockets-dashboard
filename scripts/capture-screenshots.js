/**
 * capture-screenshots.js - auto-capture above-the-fold screenshots of every page
 * for the README gallery.
 *
 * Prerequisites: the backend (http://127.0.0.1:8000) and frontend
 * (http://localhost:3000) must both be running with the database populated.
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   npm run capture
 *
 * Optional overrides (environment variables):
 *   BASE_URL   frontend origin   (default http://localhost:3000)
 *   API_URL    backend origin    (default http://127.0.0.1:8000)
 *   WIDTH      viewport width    (default 1440)
 *   HEIGHT     viewport height   (default 900)
 *   SCALE      device scale      (default 2 - retina-crisp PNGs)
 *   SETTLE     ms to wait after  (default 3000 - lets charts/live stats render)
 *              network goes idle
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://127.0.0.1:8000";
const WIDTH = parseInt(process.env.WIDTH || "1440", 10);
const HEIGHT = parseInt(process.env.HEIGHT || "900", 10);
const SCALE = parseFloat(process.env.SCALE || "2");
const SETTLE = parseInt(process.env.SETTLE || "3000", 10);

const OUT_DIR = path.join(__dirname, "..", "docs", "screenshots");

// route -> output filename. player-profile is resolved at runtime to a real id.
const PAGES = [
  { file: "dashboard.png",      route: "/" },
  { file: "players.png",        route: "/players" },
  { file: "player-profile.png", route: null },   // filled in below
  { file: "compare.png",        route: "/compare" },
  { file: "team.png",           route: "/team" },
  { file: "trade-machine.png",  route: "/trade" },
  { file: "builder.png",        route: "/build" },
  { file: "caps.png",           route: "/caps" },
  { file: "draft.png",          route: "/draft" },
  { file: "forecast.png",       route: "/forecast" },
  { file: "live.png",           route: "/live" },
];

async function resolvePlayerRoute() {
  // Grab a real player id so the profile page has live data to render.
  try {
    const res = await fetch(`${API_URL}/players`);
    const data = await res.json();
    const players = data.players || [];
    // Prefer a marquee name if present, else the first roster entry.
    const star =
      players.find((p) => /sengun|durant|thompson|green/i.test(p.full_name || "")) ||
      players[0];
    if (star && star.player_id) return `/player/${star.player_id}`;
  } catch (err) {
    console.warn(`  ! could not reach ${API_URL}/players - skipping player profile`);
  }
  return null;
}

async function main() {
  const playerRoute = await resolvePlayerRoute();
  const pages = PAGES.map((p) =>
    p.file === "player-profile.png" ? { ...p, route: playerRoute } : p
  );

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme: "dark",
  });
  const page = await context.newPage();

  for (const { file, route } of pages) {
    if (!route) {
      console.log(`- skip   ${file} (no route resolved)`);
      continue;
    }
    const url = `${BASE_URL}${route}`;
    process.stdout.write(`- shoot  ${file.padEnd(20)} ${url} ... `);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch {
      // networkidle can time out on pages that poll; fall back to DOM-ready.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    }
    await page.waitForTimeout(SETTLE);          // let charts/live stats settle
    await page.evaluate(() => window.scrollTo(0, 0));
    const out = path.join(OUT_DIR, file);
    await page.screenshot({ path: out });        // viewport only = above-the-fold
    console.log("done");
  }

  await browser.close();
  console.log(`\nSaved ${pages.filter((p) => p.route).length} screenshots to docs/screenshots/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
