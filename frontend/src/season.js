// Central season state for the whole dashboard. The selected season is persisted
// in localStorage and injected into every axios request as a `?season=` param
// (see App.js), so individual pages don't need to thread it through each call.
import axios from "axios";

const KEY = "rockets_season";
export const SEASONS = ["2025-26", "2024-25"];

export function getSeason() {
  const s = localStorage.getItem(KEY);
  return SEASONS.includes(s) ? s : SEASONS[0];
}

export function setSeason(s) {
  if (SEASONS.includes(s)) localStorage.setItem(KEY, s);
}

// Display form, e.g. "2024-25" -> "2024–25" (en dash).
export function seasonLabel(s = getSeason()) {
  return String(s).replace("-", "–");
}

// Apply the current season as a default query param on all axios requests.
export function applySeasonParam() {
  axios.defaults.params = { ...(axios.defaults.params || {}), season: getSeason() };
}
