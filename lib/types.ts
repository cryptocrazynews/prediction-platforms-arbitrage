// ---------------------------------------------------------------------------
// Canonical data model
//
// Every external source (Polymarket, Kalshi, sportsbooks via The Odds API, ...)
// is normalized into these shapes. The arbitrage engine and the UI only ever
// see canonical data — they never know which platform a number came from beyond
// the `source` label.
// ---------------------------------------------------------------------------

/** The kind of market we are comparing across platforms. */
export type MarketType =
  | 'outright_winner' // who lifts the trophy (N teams)
  | 'match_result'; // single match 1X2 (home / draw / away)

/** How a source originally expressed its price, before normalization. */
export type PriceFormat = 'decimal' | 'american' | 'cents' | 'prob';

/** A single side of a single market on a single platform. */
export interface Quote {
  /** Platform key, e.g. 'polymarket', 'kalshi', 'pinnacle', 'betfair_ex_eu'. */
  source: string;
  /** Human label of the platform shown in the UI. */
  sourceLabel: string;
  /** Whether the platform is a prediction market, an exchange, or a sportsbook. */
  sourceKind: 'prediction_market' | 'exchange' | 'sportsbook';

  /** Canonical outcome id this quote is about, e.g. 'BRA' or 'DRAW'. */
  outcomeId: string;
  /** Display label for the outcome, e.g. 'Brazil'. */
  outcomeLabel: string;

  /**
   * Side of the bet.
   *  - 'back' = buy the outcome / bet it happens (YES)
   *  - 'lay'  = bet against the outcome (NO). Only prediction markets and
   *            exchanges expose a directly tradable NO/lay price.
   */
  side: 'back' | 'lay';

  /** Implied probability in [0,1], derived from the raw price. */
  impliedProb: number;
  /** Decimal odds (total return per unit staked), = roughly 1 / impliedProb. */
  decimalOdds: number;

  /** The untouched price as the source reported it (for debugging / display). */
  rawPrice: number;
  rawFormat: PriceFormat;

  /** Best available size at this price, in the source's units (USDC, contracts, ...). */
  liquidity?: number | null;
  /** Direct link to the market on the platform, if known. */
  url?: string;
  /** ISO timestamp of when the source last updated this price. */
  ts: string;
}

/**
 * All quotes for one logical market, grouped by canonical outcome.
 * `key` is stable across platforms, e.g. 'wc2026:winner' or
 * 'wc2026:match:2026-06-20:BRA-MAR'.
 */
export interface CanonicalMarket {
  key: string;
  type: MarketType;
  title: string;
  /** Canonical outcome ids that make up this market (the full set). */
  outcomeIds: string[];
  /** Display labels keyed by outcome id. */
  outcomeLabels: Record<string, string>;
  /** outcomeId -> every quote we collected for it. */
  quotesByOutcome: Record<string, Quote[]>;
  /** For match markets: kickoff time. */
  commenceTime?: string;
}

// ---------------------------------------------------------------------------
// Arbitrage results
// ---------------------------------------------------------------------------

export interface StakeLeg {
  outcomeId: string;
  outcomeLabel: string;
  source: string;
  sourceLabel: string;
  side: 'back' | 'lay';
  decimalOdds: number;
  impliedProb: number;
  /** Fraction of total bankroll to put on this leg (sums to 1 across legs). */
  stakeFraction: number;
  url?: string;
}

export type ArbType = 'outright_field' | 'two_way';

export interface ArbOpportunity {
  id: string;
  type: ArbType;
  marketKey: string;
  marketTitle: string;
  /** For two_way arbs, which outcome this is about. */
  outcomeLabel?: string;
  /**
   * Sum of best implied probabilities (the "book sum"). Below 1.0 means a
   * guaranteed-profit window after the modeled fees.
   */
  bookSum: number;
  /** Guaranteed return on total stake, as a fraction. 0.03 = 3%. */
  roi: number;
  /** Whether every outcome in the market had a usable price (field arbs only). */
  fullCoverage: boolean;
  legs: StakeLeg[];
  /** Newest timestamp among the legs. */
  ts: string;
}

export interface MarketsPayload {
  generatedAt: string;
  tournament: string;
  sourcesUsed: { source: string; label: string; ok: boolean; note?: string }[];
  markets: CanonicalMarket[];
  arbs: ArbOpportunity[];
}
