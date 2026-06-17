// ---------------------------------------------------------------------------
// Price math
//
// Sources express the same thing in different units. We convert everything to
// an implied probability in [0,1] and a decimal-odds figure so the arbitrage
// engine can reason in one currency.
//
//   decimal odds d  -> implied prob = 1 / d
//   american +150   -> decimal = 1 + 150/100
//   american -120   -> decimal = 1 + 100/120
//   cents 63        -> prob = 0.63 (Kalshi/Polymarket style, 0..100)
//   prob 0.63       -> prob = 0.63 (Polymarket Gamma outcomePrices)
// ---------------------------------------------------------------------------

import type { PriceFormat } from './types';

export function decimalToProb(decimal: number): number {
  if (!isFinite(decimal) || decimal <= 1) return NaN;
  return 1 / decimal;
}

export function probToDecimal(prob: number): number {
  if (!isFinite(prob) || prob <= 0 || prob >= 1) return NaN;
  return 1 / prob;
}

export function americanToDecimal(american: number): number {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

/** Convert any source price into { impliedProb, decimalOdds }. */
export function normalizePrice(
  raw: number,
  format: PriceFormat
): { impliedProb: number; decimalOdds: number } {
  switch (format) {
    case 'decimal': {
      return { impliedProb: decimalToProb(raw), decimalOdds: raw };
    }
    case 'american': {
      const d = americanToDecimal(raw);
      return { impliedProb: decimalToProb(d), decimalOdds: d };
    }
    case 'cents': {
      const prob = raw / 100;
      return { impliedProb: prob, decimalOdds: probToDecimal(prob) };
    }
    case 'prob': {
      return { impliedProb: raw, decimalOdds: probToDecimal(raw) };
    }
    default:
      return { impliedProb: NaN, decimalOdds: NaN };
  }
}

/**
 * Apply a platform fee/commission to a back bet by shrinking the *profit*
 * portion of the decimal odds. This is a deliberate simplification:
 *   - Exchange (Betfair) commission is charged on net winnings.
 *   - Kalshi charges a flat ~$0.02/contract; we approximate it as a small rate.
 *   - Polymarket has no maker fee but you cross the spread — modeled as a rate.
 *
 *   effectiveDecimal = 1 + (decimal - 1) * (1 - feeRate)
 */
export function applyFee(decimalOdds: number, feeRate: number): number {
  if (feeRate <= 0) return decimalOdds;
  return 1 + (decimalOdds - 1) * (1 - feeRate);
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** Pretty decimal odds, e.g. 2.5 -> "2.50". */
export function fmtOdds(d: number): string {
  if (!isFinite(d)) return '—';
  return d.toFixed(2);
}
