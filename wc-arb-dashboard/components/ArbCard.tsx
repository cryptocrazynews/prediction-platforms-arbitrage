'use client';

import type { ArbOpportunity } from '@/lib/types';
import { fmtOdds, pct } from '@/lib/price';

const LEG_COLORS = ['var(--signal)', 'var(--gold)', '#5BB8FF', '#C792EA', '#FF9F6B'];

export function ArbCard({ arb }: { arb: ArbOpportunity }) {
  const guaranteed = arb.fullCoverage;
  const kind = arb.type === 'two_way' ? 'Cross-platform two-way' : 'Back-the-field';
  const title =
    arb.type === 'two_way'
      ? `${arb.outcomeLabel} — to win`
      : arb.marketTitle.replace(/ — .*/, '');

  return (
    <article className={`arb-card ${guaranteed ? 'guaranteed' : 'partial'} p-5`}>
      <span className="scan" aria-hidden />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{kind}</div>
          <h3 className="font-display text-[19px] font-semibold mt-1 text-chalk">{title}</h3>
          <div className="text-[12px] text-muted mt-0.5">{arb.marketTitle}</div>
        </div>
        <div className="text-right">
          <div
            className="edge-figure text-[34px]"
            style={{ color: guaranteed ? 'var(--signal)' : 'var(--amber)' }}
          >
            {pct(arb.roi, 2)}
          </div>
          <div className="eyebrow mt-1">guaranteed ROI</div>
        </div>
      </div>

      {/* stake split */}
      <div className="mt-4">
        <div className="split">
          {arb.legs.map((l, i) => (
            <span
              key={l.outcomeId + l.source}
              style={{
                width: `${l.stakeFraction * 100}%`,
                background: LEG_COLORS[i % LEG_COLORS.length],
              }}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-1.5">
          {arb.legs.map((l, i) => (
            <div
              key={l.outcomeId + l.source + l.side}
              className="flex items-center justify-between text-[13px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="dot"
                  style={{ background: LEG_COLORS[i % LEG_COLORS.length] }}
                />
                <span className="text-ink truncate">
                  <span className="text-muted">{l.side === 'back' ? 'Back' : 'Lay'} </span>
                  {l.outcomeLabel}
                  <span className="text-muted"> · {l.sourceLabel}</span>
                </span>
              </div>
              <div className="tabnum text-muted shrink-0">
                <span className="text-chalk">{fmtOdds(l.decimalOdds)}</span>
                <span className="mx-2">·</span>
                stake {pct(l.stakeFraction, 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11.5px] text-muted">
        <span className="tabnum">book sum {arb.bookSum.toFixed(4)}</span>
        {guaranteed ? (
          <span className="chip" style={{ color: 'var(--signal)', borderColor: 'var(--signal)' }}>
            <span className="dot ok" /> full coverage
          </span>
        ) : (
          <span className="chip" style={{ color: 'var(--amber)', borderColor: 'var(--amber)' }}>
            partial — not guaranteed
          </span>
        )}
      </div>
    </article>
  );
}
