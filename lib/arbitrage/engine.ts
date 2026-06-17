// ---------------------------------------------------------------------------
// Arbitrage engine
//
// Two detectors, both reasoning purely in implied probability after a modeled
// fee haircut:
//
//   TWO-WAY (cross-platform): for one outcome, back YES on the cheapest
//   platform and back NO (lay) on the cheapest platform. YES and NO together
//   cover every state, so if their implied probabilities sum to < 1 the spread
//   is a locked-in profit. This is the realistic prediction-market signal.
//
//   FIELD (back-the-field): back every outcome of a market at its best price
//   across platforms. If the implied probabilities sum to < 1, one of them must
//   win and you profit. Only a *guaranteed* arb when the outcome set is complete
//   — otherwise an unpriced outcome could win, so we flag coverage explicitly.
//
// Stake math for both: with effective decimal odds D_i on mutually exclusive,
// collectively exhaustive outcomes, stake fraction_i = (1/D_i) / S where
// S = Σ(1/D_i). Payout is 1/S for one unit staked, so ROI = 1/S − 1.
// ---------------------------------------------------------------------------

import type {
  ArbOpportunity,
  CanonicalMarket,
  Quote,
  StakeLeg,
} from '../types';
import { applyFee } from '../price';
import { feeFor, MIN_ROI } from '../config';

interface EffQuote {
  q: Quote;
  effDecimal: number;
  effProb: number;
}

function effectiveBacks(quotes: Quote[]): EffQuote[] {
  return quotes
    .filter((q) => q.side === 'back' && isFinite(q.decimalOdds) && q.decimalOdds > 1)
    .map((q) => {
      const effDecimal = applyFee(q.decimalOdds, feeFor(q.source));
      return { q, effDecimal, effProb: 1 / effDecimal };
    });
}
function effectiveLays(quotes: Quote[]): EffQuote[] {
  return quotes
    .filter((q) => q.side === 'lay' && isFinite(q.decimalOdds) && q.decimalOdds > 1)
    .map((q) => {
      const effDecimal = applyFee(q.decimalOdds, feeFor(q.source));
      return { q, effDecimal, effProb: 1 / effDecimal };
    });
}

function cheapest(quotes: EffQuote[]): EffQuote | null {
  if (!quotes.length) return null;
  return quotes.reduce((a, b) => (b.effProb < a.effProb ? b : a));
}

function legFrom(e: EffQuote, stakeFraction: number): StakeLeg {
  return {
    outcomeId: e.q.outcomeId,
    outcomeLabel: e.q.outcomeLabel,
    source: e.q.source,
    sourceLabel: e.q.sourceLabel,
    side: e.q.side,
    decimalOdds: e.effDecimal,
    impliedProb: e.effProb,
    stakeFraction,
    url: e.q.url,
  };
}

function newestTs(legs: StakeLeg[], market: CanonicalMarket): string {
  const all = market.outcomeIds.flatMap((o) => market.quotesByOutcome[o] ?? []);
  const sources = new Set(legs.map((l) => l.source));
  const ts = all.filter((q) => sources.has(q.source)).map((q) => q.ts);
  return ts.sort().at(-1) ?? new Date().toISOString();
}

/** Per-outcome cross-platform back/lay arbitrage. */
export function detectTwoWay(market: CanonicalMarket): ArbOpportunity[] {
  const out: ArbOpportunity[] = [];
  for (const outcomeId of market.outcomeIds) {
    const quotes = market.quotesByOutcome[outcomeId] ?? [];
    const bestBack = cheapest(effectiveBacks(quotes));
    const bestLay = cheapest(effectiveLays(quotes));
    if (!bestBack || !bestLay) continue;
    // Must hedge across two different platforms to be a real arb.
    if (bestBack.q.source === bestLay.q.source) continue;

    const S = bestBack.effProb + bestLay.effProb;
    if (!(S < 1)) continue;
    const roi = 1 / S - 1;
    if (roi < MIN_ROI) continue;

    const legs = [
      legFrom(bestBack, bestBack.effProb / S),
      legFrom(bestLay, bestLay.effProb / S),
    ];
    out.push({
      id: `tw:${market.key}:${outcomeId}`,
      type: 'two_way',
      marketKey: market.key,
      marketTitle: market.title,
      outcomeLabel: market.outcomeLabels[outcomeId] ?? outcomeId,
      bookSum: S,
      roi,
      fullCoverage: true, // YES + NO is always a complete cover for one outcome
      legs,
      ts: newestTs(legs, market),
    });
  }
  return out;
}

/** Whether at least one source prices essentially the whole field. */
function someSourceComplete(market: CanonicalMarket): boolean {
  const bySource = new Map<string, number>();
  for (const outcomeId of market.outcomeIds) {
    for (const e of effectiveBacks(market.quotesByOutcome[outcomeId] ?? [])) {
      bySource.set(e.q.source, (bySource.get(e.q.source) ?? 0) + e.effProb);
    }
  }
  // A source pricing the full field has back-prob sum >= ~0.85 (margin aside).
  for (const sum of bySource.values()) if (sum >= 0.85) return true;
  return false;
}

/** Back-the-field arbitrage across the full outcome set of a market. */
export function detectField(market: CanonicalMarket): ArbOpportunity | null {
  const bests: EffQuote[] = [];
  let covered = 0;
  for (const outcomeId of market.outcomeIds) {
    const best = cheapest(effectiveBacks(market.quotesByOutcome[outcomeId] ?? []));
    if (best) {
      bests.push(best);
      covered++;
    }
  }
  if (covered === 0) return null;

  const S = bests.reduce((acc, e) => acc + e.effProb, 0);
  const allOutcomesCovered = covered === market.outcomeIds.length;
  const fullCoverage =
    allOutcomesCovered &&
    (market.type === 'match_result' || someSourceComplete(market));

  // Only surface if there's a real (or apparent) sub-1 book.
  if (!(S < 1)) return null;
  const roi = 1 / S - 1;
  if (roi < MIN_ROI) return null;

  const legs = bests.map((e) => legFrom(e, e.effProb / S));
  return {
    id: `field:${market.key}`,
    type: 'outright_field',
    marketKey: market.key,
    marketTitle: market.title,
    bookSum: S,
    roi,
    fullCoverage,
    legs,
    ts: newestTs(legs, market),
  };
}

/** Run all detectors over all markets and return opportunities, best ROI first. */
export function findArbs(markets: CanonicalMarket[]): ArbOpportunity[] {
  const arbs: ArbOpportunity[] = [];
  for (const m of markets) {
    const field = detectField(m);
    if (field) arbs.push(field);
    arbs.push(...detectTwoWay(m));
  }
  return arbs.sort((a, b) => {
    // Guaranteed (full coverage) first, then by ROI.
    if (a.fullCoverage !== b.fullCoverage) return a.fullCoverage ? -1 : 1;
    return b.roi - a.roi;
  });
}
