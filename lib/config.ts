// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const TOURNAMENT = 'FIFA World Cup 2026';
export const WC_WINNER_KEY = 'wc2026:winner';

/** Cache TTL for aggregated data, in seconds. */
export const CACHE_TTL_SECONDS = 60;

/**
 * Modeled effective fee/spread per source, as a fraction of profit.
 * These are deliberately conservative defaults so the arb engine doesn't flag
 * windows that vanish once real costs are paid. Tune to taste.
 */
export const SOURCE_FEES: Record<string, number> = {
  polymarket: 0.01, // no maker fee, but you cross the spread
  kalshi: 0.02, // ~$0.02/contract on a ~$0.5 price ≈ a few %
  pinnacle: 0.0, // sharp book, margin already in the price
  betfair_ex_eu: 0.02, // exchange commission on winnings
  default: 0.01,
};

export function feeFor(source: string): number {
  return SOURCE_FEES[source] ?? SOURCE_FEES.default;
}

/** Minimum ROI (after fees) for a window to be surfaced as an opportunity. */
export const MIN_ROI = 0.001; // 0.1%

export const env = {
  oddsApiKey: process.env.ODDS_API_KEY ?? '',
  oddsApiRegions: process.env.ODDS_API_REGIONS ?? 'eu',
  /** Set USE_MOCK=1 to force demo data even when keys are present. */
  forceMock: process.env.USE_MOCK === '1',
  cronSecret: process.env.CRON_SECRET ?? '',
};
