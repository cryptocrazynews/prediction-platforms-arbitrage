'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketsPayload } from '@/lib/types';
import { ArbCard } from '@/components/ArbCard';
import { MarketBoard } from '@/components/MarketBoard';

export default function Page() {
  const [data, setData] = useState<MarketsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setData((await res.json()) as MarketsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const arbs = data?.arbs ?? [];
  const guaranteed = arbs.filter((a) => a.fullCoverage);
  const partial = arbs.filter((a) => !a.fullCoverage);

  // Demo mode = the mock source is active and no live source returned data.
  const liveOk = (data?.sourcesUsed ?? []).some((s) => s.source !== 'mock' && s.ok);
  const isDemo = (data?.sourcesUsed ?? []).some((s) => s.source === 'mock' && s.ok) && !liveOk;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="eyebrow text-gold">FIFA World Cup 2026 · Arbitrage Terminal</div>
          <h1 className="font-display text-[30px] sm:text-[38px] font-bold tracking-tight text-chalk mt-1">
            Where the markets disagree
          </h1>
          <p className="text-muted text-[14px] mt-1 max-w-xl">
            Live prices from prediction markets, exchanges and sportsbooks, normalized to one
            scale, scanned for locked-in pricing gaps.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          className="chip"
          style={{ color: 'var(--chalk)', cursor: 'pointer' }}
          aria-label="Refresh data"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* Status bar */}
      <section className="flex flex-wrap items-center gap-2.5 mt-4">
        {data?.sourcesUsed.map((s) => (
          <span key={s.source} className="chip" title={s.note ?? ''}>
            <span className={`dot ${s.ok ? 'ok' : 'bad'}`} />
            {s.label}
          </span>
        ))}
        {data && (
          <span className="chip tabnum">
            updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
        )}
      </section>

      {/* Demo-mode banner: live sources unreachable, showing sample data. */}
      {isDemo && (
        <div
          className="panel p-4 mt-4 flex items-start gap-3"
          style={{
            borderColor: 'var(--amber)',
            background: 'color-mix(in oklab, var(--amber) 8%, var(--panel))',
          }}
        >
          <span className="dot" style={{ background: 'var(--amber)', marginTop: 6 }} />
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--amber)' }}>
            <strong>展示資料(非即時)。</strong> 目前三個即時來源都連不上,以下顯示的是內建範例資料,
            這些「套利機會」是為了示範而設計的數字,<strong>不是真實市場的可下注機會</strong>。
            接上至少一個即時來源(例如設定 The Odds API 金鑰)後,這條訊息會自動消失。
          </p>
        </div>
      )}

      {error && (
        <div className="panel p-4 mt-5" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Couldn&apos;t load market data: {error}. The refresh button retries.
        </div>
      )}

      {/* Hero: opportunities */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[16px] font-semibold text-chalk">
            Opportunities
            <span className="text-muted font-normal"> · after modeled fees</span>
          </h2>
          <span className="eyebrow">
            {guaranteed.length} guaranteed · {partial.length} partial
          </span>
        </div>

        {arbs.length === 0 && !loading && (
          <div className="panel p-6 mt-3 text-muted text-[14px]">
            No arbitrage windows right now. Markets are aligned within the modeled fees — the
            board below shows the current best prices per platform.
          </div>
        )}

        <div className="grid gap-4 mt-3 sm:grid-cols-2">
          {[...guaranteed, ...partial].map((a) => (
            <ArbCard key={a.id} arb={a} />
          ))}
        </div>
      </section>

      {/* Odds boards */}
      <section className="mt-9">
        <h2 className="font-display text-[16px] font-semibold text-chalk mb-3">Odds board</h2>
        <div className="grid gap-5">
          {data?.markets.map((m) => (
            <MarketBoard key={m.key} market={m} />
          ))}
        </div>
      </section>

      {/* Methodology / disclaimer */}
      <footer className="mt-10 border-t border-line pt-5 text-[12.5px] text-muted leading-relaxed">
        <p className="mb-2">
          <span className="text-ink">How it reads.</span> Every price is converted to an implied
          probability. A two-way window backs an outcome on the cheapest platform and buys its NO
          on another; a field window backs every outcome at its best price. When the probabilities
          sum below 1 after modeled fees, the gap is the edge. &quot;Partial&quot; means not every
          outcome was priced, so it isn&apos;t a guaranteed lock.
        </p>
        <p>
          Data only — no orders are placed. Prices move and liquidity is finite, so a displayed
          window may close before it can be filled. This is not betting or investment advice.
        </p>
      </footer>
    </main>
  );
}
