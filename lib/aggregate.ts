// ---------------------------------------------------------------------------
// Aggregation orchestrator
//
// Runs every adapter in parallel, tolerates individual failures, builds the
// canonical markets, runs the arbitrage engine, and caches the result. If no
// live source yields data (e.g. local dev without keys, or all APIs down) it
// falls back to mock data so the dashboard is always populated.
// ---------------------------------------------------------------------------

import type { CanonicalMarket, MarketsPayload, Quote } from './types';
import { TOURNAMENT, CACHE_TTL_SECONDS, env } from './config';
import { fetchPolymarketWinner } from './adapters/polymarket';
import { fetchKalshiWinner } from './adapters/kalshi';
// import { fetchOddsApiWinner } from './adapters/oddsapi'; // disabled (needs API key)
import { mockWinnerQuotes, mockMatchMarkets } from './adapters/mock';
import { buildWinnerMarket, mergeMatchMarkets } from './normalize/group';
import { findArbs } from './arbitrage/engine';

type SourceStatus = MarketsPayload['sourcesUsed'][number];

interface CacheEntry {
  at: number;
  payload: MarketsPayload;
}
let CACHE: CacheEntry | null = null;

interface NamedAdapter {
  source: string;
  label: string;
  run: () => Promise<Quote[]>;
}

const WINNER_ADAPTERS: NamedAdapter[] = [
  { source: 'polymarket', label: 'Polymarket', run: fetchPolymarketWinner },
  { source: 'kalshi', label: 'Kalshi', run: fetchKalshiWinner },
  // The Odds API (sportsbooks) is disabled because it requires an API key.
  // To re-enable: add ODDS_API_KEY in env and uncomment the line below.
  // { source: 'theoddsapi', label: 'Sportsbooks (The Odds API)', run: fetchOddsApiWinner },
];

async function runAdapters(): Promise<{
  winnerQuotes: Quote[];
  matchMarkets: CanonicalMarket[];
  statuses: SourceStatus[];
}> {
  const statuses: SourceStatus[] = [];
  let winnerQuotes: Quote[] = [];

  if (!env.forceMock) {
    const results = await Promise.allSettled(WINNER_ADAPTERS.map((a) => a.run()));
    results.forEach((r, i) => {
      const a = WINNER_ADAPTERS[i];
      if (r.status === 'fulfilled') {
        const n = r.value.length;
        winnerQuotes.push(...r.value);
        statuses.push({
          source: a.source,
          label: a.label,
          ok: n > 0,
          note: n > 0 ? `${n} quotes` : 'no World Cup markets found',
        });
      } else {
        statuses.push({
          source: a.source,
          label: a.label,
          ok: false,
          note: String(r.reason?.message ?? r.reason).slice(0, 120),
        });
      }
    });
  }

  // Fallback to demo data if nothing live came back.
  let matchMarkets: CanonicalMarket[] = [];
  if (winnerQuotes.length === 0) {
    winnerQuotes = mockWinnerQuotes();
    matchMarkets = mockMatchMarkets();
    statuses.push({
      source: 'mock',
      label: 'Demo data',
      ok: true,
      note: env.forceMock ? 'USE_MOCK=1' : 'no live data — showing demo',
    });
  } else {
    // Live winner data present; match markets aren't wired to live sources in
    // the MVP, so include demo matches only when explicitly mocking.
    if (env.forceMock) matchMarkets = mockMatchMarkets();
  }

  return { winnerQuotes, matchMarkets, statuses };
}

export async function buildPayload(force = false): Promise<MarketsPayload> {
  if (!force && CACHE && Date.now() - CACHE.at < CACHE_TTL_SECONDS * 1000) {
    return CACHE.payload;
  }

  const { winnerQuotes, matchMarkets, statuses } = await runAdapters();

  const markets: CanonicalMarket[] = [];
  const winner = buildWinnerMarket(winnerQuotes);
  if (winner) markets.push(winner);
  markets.push(...mergeMatchMarkets([matchMarkets]));

  const arbs = findArbs(markets);

  const payload: MarketsPayload = {
    generatedAt: new Date().toISOString(),
    tournament: TOURNAMENT,
    sourcesUsed: statuses,
    markets,
    arbs,
  };
  CACHE = { at: Date.now(), payload };
  return payload;
}
