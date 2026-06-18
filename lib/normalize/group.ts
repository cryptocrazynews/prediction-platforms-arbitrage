// ---------------------------------------------------------------------------
// Grouping: raw Quote[] -> CanonicalMarket[]
// ---------------------------------------------------------------------------

import type { CanonicalMarket, Quote } from '../types';
import { WC_WINNER_KEY, TOURNAMENT } from '../config';
import { teamName } from '../teams';

/** Build the single outright-winner market from all winner quotes. */
export function buildWinnerMarket(quotes: Quote[]): CanonicalMarket | null {
  if (!quotes.length) return null;
  const quotesByOutcome: Record<string, Quote[]> = {};
  const labels: Record<string, string> = {};
  for (const q of quotes) {
    (quotesByOutcome[q.outcomeId] ||= []).push(q);
    labels[q.outcomeId] ||= q.outcomeLabel || teamName(q.outcomeId);
  }
  // Order outcomes by their best (lowest) back implied prob = favourites first.
  const outcomeIds = Object.keys(quotesByOutcome).sort((a, b) => {
    const pa = bestBackProb(quotesByOutcome[a]);
    const pb = bestBackProb(quotesByOutcome[b]);
    return pb - pa; // favourites (highest implied probability) first
  });
  return {
    key: WC_WINNER_KEY,
    type: 'outright_winner',
    title: `${TOURNAMENT} — Winner`,
    outcomeIds,
    outcomeLabels: labels,
    quotesByOutcome,
  };
}

/** Merge match markets that may arrive from several sources, keyed by market key. */
export function mergeMatchMarkets(lists: CanonicalMarket[][]): CanonicalMarket[] {
  const byKey = new Map<string, CanonicalMarket>();
  for (const list of lists) {
    for (const m of list) {
      const existing = byKey.get(m.key);
      if (!existing) {
        byKey.set(m.key, {
          ...m,
          quotesByOutcome: { ...m.quotesByOutcome },
          outcomeLabels: { ...m.outcomeLabels },
        });
        continue;
      }
      for (const oid of m.outcomeIds) {
        if (!existing.outcomeIds.includes(oid)) existing.outcomeIds.push(oid);
        existing.outcomeLabels[oid] ||= m.outcomeLabels[oid];
        existing.quotesByOutcome[oid] = [
          ...(existing.quotesByOutcome[oid] ?? []),
          ...(m.quotesByOutcome[oid] ?? []),
        ];
      }
    }
  }
  return [...byKey.values()];
}

function bestBackProb(quotes: Quote[]): number {
  const backs = quotes.filter((q) => q.side === 'back' && isFinite(q.impliedProb));
  if (!backs.length) return 1;
  return Math.min(...backs.map((q) => q.impliedProb));
}
