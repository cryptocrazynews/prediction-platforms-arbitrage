'use client';

import type { CanonicalMarket, Quote } from '@/lib/types';
import { fmtOdds, pct } from '@/lib/price';

function backQuotes(q: Quote[]): Quote[] {
  return q.filter((x) => x.side === 'back' && isFinite(x.decimalOdds));
}

export function MarketBoard({ market }: { market: CanonicalMarket }) {
  // Outright winner can list ~48 teams, most parked at the price floor. Show
  // only the top outcomes (already sorted favourites-first) to keep it useful.
  const MAX_ROWS = 20;
  const isWinner = market.type === 'outright_winner';
  const visibleOutcomes =
    isWinner && market.outcomeIds.length > MAX_ROWS
      ? market.outcomeIds.slice(0, MAX_ROWS)
      : market.outcomeIds;
  const hiddenCount = market.outcomeIds.length - visibleOutcomes.length;

  // Collect the back-quoting sources present anywhere in this market.
  const sourceOrder: { source: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const oid of market.outcomeIds) {
    for (const q of backQuotes(market.quotesByOutcome[oid] ?? [])) {
      if (!seen.has(q.source)) {
        seen.add(q.source);
        sourceOrder.push({ source: q.source, label: q.sourceLabel });
      }
    }
  }

  return (
    <div className="panel overflow-x-auto">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="font-display text-[15px] font-semibold text-chalk">{market.title}</h3>
        {market.commenceTime && (
          <span className="eyebrow">
            kickoff {new Date(market.commenceTime).toLocaleString()}
          </span>
        )}
      </div>
      <table className="board mt-3">
        <thead>
          <tr>
            <th>Outcome</th>
            {sourceOrder.map((s) => (
              <th key={s.source}>{s.label}</th>
            ))}
            <th>Best</th>
            <th>Implied</th>
          </tr>
        </thead>
        <tbody>
          {visibleOutcomes.map((oid) => {
            const backs = backQuotes(market.quotesByOutcome[oid] ?? []);
            const bySource = new Map<string, Quote>();
            for (const q of backs) {
              const cur = bySource.get(q.source);
              if (!cur || q.decimalOdds > cur.decimalOdds) bySource.set(q.source, q);
            }
            const best = backs.reduce<Quote | null>(
              (a, b) => (!a || b.decimalOdds > a.decimalOdds ? b : a),
              null
            );
            const hasLay = (market.quotesByOutcome[oid] ?? []).some((q) => q.side === 'lay');
            return (
              <tr key={oid}>
                <td className="text-ink">
                  {market.outcomeLabels[oid] ?? oid}
                  {hasLay && (
                    <span className="ml-2 text-[10px] text-muted tabnum">NO available</span>
                  )}
                </td>
                {sourceOrder.map((s) => {
                  const q = bySource.get(s.source);
                  const isBest = q && best && q.source === best.source && q.decimalOdds === best.decimalOdds;
                  return (
                    <td key={s.source} className={`tabnum ${isBest ? 'cell-best' : q ? '' : 'cell-empty'}`}>
                      {q ? fmtOdds(q.decimalOdds) : '—'}
                    </td>
                  );
                })}
                <td className="tabnum cell-best">{best ? fmtOdds(best.decimalOdds) : '—'}</td>
                <td className="tabnum text-muted">{best ? pct(best.impliedProb, 1) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <div className="px-4 py-2.5 text-[11.5px] text-muted">
          + {hiddenCount} more longshots hidden (parked near the price floor)
        </div>
      )}
    </div>
  );
}
