# World Cup 2026 — Prediction Market Arbitrage Dashboard

Aggregates World Cup markets from **prediction markets, betting exchanges and
sportsbooks**, normalizes their prices to one scale, and surfaces **cross-platform
arbitrage windows**. Built with Next.js (App Router) for one-click Vercel deploys.

> **MVP scope (by design):** data aggregation, normalization, arbitrage analysis
> and dashboard display only. No order placement, no login/trading, no wallet
> connection. It reads public market data and shows you the math.

---

## What it does

1. **Collects** outright-winner markets from each source (adapter per platform).
2. **Normalizes** every price — decimal odds, American odds, cents, raw
   probability — into a single implied probability, and resolves team names
   (`"United States" / "USA" / "US"` -> `USA`) so the same outcome lines up
   across platforms.
3. **Detects arbitrage** with two engines:
   - **Two-way (cross-platform):** back an outcome on the cheapest platform and
     buy its NO on another. If `P(yes) + P(no) < 1` after fees, it's locked in.
   - **Back-the-field:** back every outcome at its best price. If the implied
     probabilities sum below 1, one must win and you profit — but only a
     *guaranteed* lock when every outcome is priced (flagged as coverage).
4. **Displays** opportunities (with stake splits and ROI) plus a full odds board
   highlighting the best price per outcome.

## Data sources

| Source | Auth | Notes |
| --- | --- | --- |
| **Polymarket** | none | Public Gamma API. Prices are probabilities (0-1); YES + NO per binary market. |
| **Kalshi** | none (reads) | Public market data. Prices in cents (1-99); YES + NO. |
| **Sportsbooks / Betfair** | API key | Via The Odds API (`soccer_fifa_world_cup`). Decimal odds, back only. |

The app runs with **zero keys** using built-in demo data, which contains a real
two-way arb and a fully-covered 3-way match arb so you can see every feature work.

## Architecture

```
app/
  page.tsx                  Dashboard (client): status, arb hero, odds board
  api/markets/route.ts      GET aggregated markets + arbs (cached 60s)
  api/cron/refresh/route.ts Cache warmer for Vercel Cron
lib/
  types.ts                  Canonical data model (Quote, CanonicalMarket, ArbOpportunity)
  price.ts                  Price-format conversions + fee model
  teams.ts                  Canonical team registry + alias resolution
  config.ts                 Env, fees, thresholds
  adapters/                 One file per source (polymarket, kalshi, oddsapi, mock)
  normalize/group.ts        Quotes -> CanonicalMarket
  arbitrage/engine.ts       Two-way + field detectors, stake math
  aggregate.ts              Orchestrates adapters -> markets -> arbs (+ caching, fallback)
components/                 ArbCard (stake split), MarketBoard (odds grid)
```

Every adapter normalizes into the same `Quote` shape, so the engine and UI never
know which platform a number came from. Adding a source = adding one adapter.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add ODDS_API_KEY for sportsbook data
npm run dev                  # http://localhost:3000
```

Without keys you'll see demo data. Set `USE_MOCK=1` to force it.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (it auto-detects Next.js — no build config needed).
3. Add environment variables (`ODDS_API_KEY`, optionally `CRON_SECRET`) in
   Project -> Settings -> Environment Variables.
4. Deploy. `vercel.json` registers a cron that warms the cache every 15 minutes
   (adjust per your Vercel plan's cron limits).

## Fee model

Arbitrage that ignores costs is fiction, so each source has a modeled fee
(`lib/config.ts -> SOURCE_FEES`) applied to the profit portion of its odds before
detection. Defaults are conservative; tune them to your actual costs.

## Extending it

- **Add a source:** create `lib/adapters/<name>.ts` returning `Quote[]`, register
  it in `lib/aggregate.ts`. Team resolution and the engine handle the rest.
- **Add match markets live:** wire The Odds API `markets=h2h` into an adapter
  that emits pre-grouped `CanonicalMarket`s (the mock shows the exact shape).
- **Persist history:** swap the in-memory cache in `aggregate.ts` for Vercel KV
  to track how windows open and close over time.
- **Liquidity-aware sizing:** the `Quote.liquidity` field is plumbed through;
  cap stake legs by available size for executable numbers.

## Caveats

Displayed windows can close before they're fillable; liquidity is finite and
prices move. Many platforms restrict access by jurisdiction and have terms
governing automated access — review them. This project is a research/analysis
tool. It is **not** betting or investment advice.
