// ---------------------------------------------------------------------------
// Mock adapter — realistic demo data, no network required.
//
// Used when USE_MOCK=1, when no live source returns data, or as a fallback so
// the dashboard is never empty. The numbers are hand-tuned to contain:
//   1. A genuine cross-platform TWO-WAY arb on the outright winner
//      (back YES on one platform + back NO on another, summing < 1).
//   2. A fully-covered 3-way MATCH arb (back all of home/draw/away across books
//      so implied probabilities sum < 1).
//   3. Favourites whose best back prices sum to ~1.02 — correctly NOT flagged
//      as a field arb, because the rest of the 48-team field is unpriced here.
// ---------------------------------------------------------------------------

import type { CanonicalMarket, Quote } from '../types';
import { normalizePrice } from '../price';
import { WC_WINNER_KEY } from '../config';

const NOW = () => new Date().toISOString();

interface SrcMeta {
  source: string;
  label: string;
  kind: Quote['sourceKind'];
}
const POLY: SrcMeta = { source: 'polymarket', label: 'Polymarket', kind: 'prediction_market' };
const KALSHI: SrcMeta = { source: 'kalshi', label: 'Kalshi', kind: 'prediction_market' };
const PIN: SrcMeta = { source: 'pinnacle', label: 'Pinnacle', kind: 'sportsbook' };
const BETF: SrcMeta = { source: 'betfair_ex_eu', label: 'Betfair', kind: 'exchange' };

function back(s: SrcMeta, id: string, label: string, raw: number, fmt: Quote['rawFormat']): Quote {
  const { impliedProb, decimalOdds } = normalizePrice(raw, fmt);
  return {
    source: s.source, sourceLabel: s.label, sourceKind: s.kind,
    outcomeId: id, outcomeLabel: label, side: 'back',
    impliedProb, decimalOdds, rawPrice: raw, rawFormat: fmt, liquidity: null, ts: NOW(),
  };
}
function lay(s: SrcMeta, id: string, label: string, raw: number, fmt: Quote['rawFormat']): Quote {
  const { impliedProb, decimalOdds } = normalizePrice(raw, fmt);
  return {
    source: s.source, sourceLabel: s.label, sourceKind: s.kind,
    outcomeId: id, outcomeLabel: label, side: 'lay',
    impliedProb, decimalOdds, rawPrice: raw, rawFormat: fmt, liquidity: null, ts: NOW(),
  };
}

export function mockWinnerQuotes(): Quote[] {
  return [
    // --- Spain: headline TWO-WAY arb (back YES 0.22 + back NO 0.75 = 0.97) ---
    back(POLY, 'ESP', 'Spain', 0.22, 'prob'),
    lay(KALSHI, 'ESP', 'Spain', 75, 'cents'),
    back(KALSHI, 'ESP', 'Spain', 0.235, 'prob'),
    back(PIN, 'ESP', 'Spain', 4.5, 'decimal'),
    back(BETF, 'ESP', 'Spain', 4.6, 'decimal'),

    // --- England: a second TWO-WAY arb (back 0.12 + NO 0.85 = 0.97) ---
    back(KALSHI, 'ENG', 'England', 0.12, 'prob'),
    lay(POLY, 'ENG', 'England', 0.85, 'prob'),
    back(POLY, 'ENG', 'England', 0.14, 'prob'),
    back(PIN, 'ENG', 'England', 7.0, 'decimal'),
    back(BETF, 'ENG', 'England', 7.2, 'decimal'),

    // --- Argentina: NEAR-MISS -> best back ~0.116 + NO 0.90 = ~1.02, not flagged
    back(POLY, 'ARG', 'Argentina', 0.165, 'prob'),
    lay(KALSHI, 'ARG', 'Argentina', 90, 'cents'),
    back(PIN, 'ARG', 'Argentina', 8.5, 'decimal'),
    back(BETF, 'ARG', 'Argentina', 8.8, 'decimal'),

    // --- Remaining favourites: back-only, to populate the comparison board ---
    back(POLY, 'FRA', 'France', 0.205, 'prob'),
    back(KALSHI, 'FRA', 'France', 0.198, 'prob'),
    back(PIN, 'FRA', 'France', 5.0, 'decimal'),
    back(BETF, 'FRA', 'France', 5.2, 'decimal'),

    back(POLY, 'BRA', 'Brazil', 0.13, 'prob'),
    back(KALSHI, 'BRA', 'Brazil', 0.135, 'prob'),
    back(PIN, 'BRA', 'Brazil', 7.5, 'decimal'),
    back(BETF, 'BRA', 'Brazil', 8.0, 'decimal'),

    back(PIN, 'POR', 'Portugal', 11, 'decimal'),
    back(BETF, 'POR', 'Portugal', 12, 'decimal'),
    back(PIN, 'GER', 'Germany', 13, 'decimal'),
    back(BETF, 'GER', 'Germany', 14, 'decimal'),
    back(PIN, 'NED', 'Netherlands', 15, 'decimal'),
    back(BETF, 'NED', 'Netherlands', 16, 'decimal'),
    back(POLY, 'USA', 'United States', 0.037, 'prob'),
    back(PIN, 'USA', 'United States', 27, 'decimal'),
    back(BETF, 'USA', 'United States', 28, 'decimal'),
  ];
}

export function mockMatchMarkets(): CanonicalMarket[] {
  const kickoff = new Date(Date.now() + 6 * 3600_000).toISOString();
  const key = 'wc2026:match:BRA-MAR';
  // Fully-covered 3-way arb: best Brazil 2.15 (Pinnacle) + Draw 3.55 (Pinnacle)
  // + Morocco 4.60 (Betfair) -> implied 0.465+0.282+0.217 = 0.964 < 1.
  const quotes: Quote[] = [
    back(PIN, 'BRA', 'Brazil', 2.15, 'decimal'),
    back(BETF, 'BRA', 'Brazil', 2.05, 'decimal'),
    back(PIN, 'DRAW', 'Draw', 3.55, 'decimal'),
    back(BETF, 'DRAW', 'Draw', 3.4, 'decimal'),
    back(PIN, 'MAR', 'Morocco', 3.9, 'decimal'),
    back(BETF, 'MAR', 'Morocco', 4.6, 'decimal'),
  ];
  const quotesByOutcome: Record<string, Quote[]> = {};
  for (const q of quotes) (quotesByOutcome[q.outcomeId] ||= []).push(q);
  return [
    {
      key,
      type: 'match_result',
      title: 'Brazil vs Morocco — Match Result',
      outcomeIds: ['BRA', 'DRAW', 'MAR'],
      outcomeLabels: { BRA: 'Brazil', DRAW: 'Draw', MAR: 'Morocco' },
      quotesByOutcome,
      commenceTime: kickoff,
    },
  ];
}

export const MOCK_WINNER_KEY = WC_WINNER_KEY;
