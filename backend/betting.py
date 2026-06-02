"""
betting.py — value-bet finder built on the Elo predictor.

Compares the model's win probability against sportsbook moneyline odds (de-vigged
to a fair price) and surfaces the edge. Two modes:
  • live  — pulls current NBA moneylines from The Odds API (free tier, needs a key)
  • manual — caller supplies the odds; always works, no key required

Set ODDS_API_KEY in the environment (.env) to enable live mode. Get a free key at
https://the-odds-api.com (500 requests/month).
"""

import os
import requests
import elo

ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/basketball_nba/odds"
EDGE_THRESHOLD = 0.03  # model must beat the fair price by 3%+ to flag a value bet


# ── Odds math ────────────────────────────────────────────────────────────────
def american_to_implied(odds):
    """American moneyline → implied win probability (includes the vig)."""
    odds = float(odds)
    return (-odds) / (-odds + 100) if odds < 0 else 100 / (odds + 100)


def american_to_decimal_profit(odds):
    """Net profit per $1 staked (decimal odds minus 1)."""
    odds = float(odds)
    return (100 / -odds) if odds < 0 else (odds / 100)


def implied_to_american(p):
    if p <= 0 or p >= 1:
        return None
    return round(-100 * p / (1 - p)) if p > 0.5 else round(100 * (1 - p) / p)


def _kelly(p, odds):
    """Full-Kelly stake as % of bankroll for win prob p at the given odds."""
    b = american_to_decimal_profit(odds)
    f = (b * p - (1 - p)) / b
    return round(max(0.0, f) * 100, 1)


def _ev_pct(p, odds):
    """Expected value per $100 staked, in %."""
    b = american_to_decimal_profit(odds)
    return round((p * b - (1 - p)) * 100, 1)


def _side(model_p, odds, devig_p):
    """Build a per-team result block."""
    edge = round((model_p - devig_p) * 100, 1)
    return {
        "model_prob":  round(model_p * 100, 1),
        "market_prob": round(devig_p * 100, 1),   # fair (de-vigged) price
        "odds":        int(odds),
        "edge":        edge,
        "ev_pct":      _ev_pct(model_p, odds),
        "kelly_pct":   _kelly(model_p, odds),
        "value":       edge >= EDGE_THRESHOLD * 100,
    }


def evaluate(model_p_home, model_p_away, home_odds, away_odds):
    """Core comparison: model probs vs de-vigged market, for one matchup."""
    imp_h = american_to_implied(home_odds)
    imp_a = american_to_implied(away_odds)
    total = imp_h + imp_a or 1.0
    devig_h, devig_a = imp_h / total, imp_a / total   # remove the bookmaker margin

    home = _side(model_p_home, home_odds, devig_h)
    away = _side(model_p_away, away_odds, devig_a)
    vig_pct = round((total - 1) * 100, 1)

    best = None
    if home["value"] or away["value"]:
        best = "home" if home["edge"] >= away["edge"] else "away"
    return {"home": home, "away": away, "vig_pct": vig_pct, "value_side": best}


# ── Manual mode ──────────────────────────────────────────────────────────────
def evaluate_matchup(season, home_abbr, away_abbr, home_odds, away_odds):
    ratings = elo.get_ratings(season)
    th, ta = ratings.get(home_abbr.upper()), ratings.get(away_abbr.upper())
    if not th or not ta:
        return None
    pred = elo.predict(th, ta, ratings)
    res = evaluate(pred["home_win_prob"] / 100, pred["away_win_prob"] / 100, home_odds, away_odds)
    res["home_team"] = {"abbr": th["abbr"], "name": th["name"], "elo": th["elo"]}
    res["away_team"] = {"abbr": ta["abbr"], "name": ta["name"], "elo": ta["elo"]}
    return res


# ── Live mode ────────────────────────────────────────────────────────────────
def live_edges(season):
    key = os.getenv("ODDS_API_KEY")
    if not key:
        return {"configured": False, "games": [],
                "message": "Add ODDS_API_KEY to your .env to enable live odds (free at the-odds-api.com)."}

    try:
        resp = requests.get(ODDS_API_URL, params={
            "apiKey": key, "regions": "us", "markets": "h2h", "oddsFormat": "american",
        }, timeout=12)
        resp.raise_for_status()
        events = resp.json()
    except Exception as e:
        return {"configured": True, "games": [], "error": str(e)}

    ratings = elo.get_ratings(season)
    name_to_abbr = {t["name"]: t["abbr"] for t in ratings.values()}

    games = []
    for ev in events:
        home_name, away_name = ev.get("home_team"), ev.get("away_team")
        th = ratings.get(name_to_abbr.get(home_name, ""))
        ta = ratings.get(name_to_abbr.get(away_name, ""))
        if not th or not ta:
            continue

        # Consensus implied prob (average across books) + best price per side.
        imp_h, imp_a, best_h, best_a, n = 0.0, 0.0, None, None, 0
        for bk in ev.get("bookmakers", []):
            for mkt in bk.get("markets", []):
                if mkt.get("key") != "h2h":
                    continue
                o = {x["name"]: x["price"] for x in mkt.get("outcomes", [])}
                if home_name not in o or away_name not in o:
                    continue
                imp_h += american_to_implied(o[home_name])
                imp_a += american_to_implied(o[away_name])
                n += 1
                if best_h is None or american_to_implied(o[home_name]) < american_to_implied(best_h):
                    best_h = o[home_name]            # better price = lower implied prob
                if best_a is None or american_to_implied(o[away_name]) < american_to_implied(best_a):
                    best_a = o[away_name]
        if n == 0:
            continue

        pred = elo.predict(th, ta, ratings)
        res = evaluate(pred["home_win_prob"] / 100, pred["away_win_prob"] / 100, best_h, best_a)
        res["home_team"] = {"abbr": th["abbr"], "name": home_name, "elo": th["elo"]}
        res["away_team"] = {"abbr": ta["abbr"], "name": away_name, "elo": ta["elo"]}
        res["commence_time"] = ev.get("commence_time")
        res["books"] = n
        games.append(res)

    # Value bets first, then by kickoff.
    games.sort(key=lambda g: (g["value_side"] is None, -(max(g["home"]["edge"], g["away"]["edge"]))))
    return {"configured": True, "games": games}
