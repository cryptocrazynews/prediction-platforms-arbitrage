// ---------------------------------------------------------------------------
// Kalshi adapter — public market data (no auth for reads)
//   https://api.kalshi.com/trade-api/v2
//
// Kalshi prices are in cents (1..99). For a YES/NO event contract:
//   yes_ask = price to buy YES (back the outcome)
//   no_ask  = price to buy NO  (lay / bet against)
// YES + NO asks sum to ~100 plus the spread.
//
// World Cup winner contracts live under an event series. We resolve the event
// by ticker prefix, then read each market's order book best asks.
// ---------------------------------------------------------------------------

import type { Quote } from '../types';
import { normalizePrice } from '../price';
import { resolveTeam } from '../teams';

const BASE = 'https://api.kalshi.com/trade-api/v2';

interface KalshiMarket {
  ticker?: string;
  title?: string;
  yes_sub_title?: string;
  subtitle?: string;
  yes_ask?: number; // cents
  no_ask?: number; // cents
  last_price?: number; // cents
  liquidity?: number;
  status?: string;
  close_time?: string;
}

interface KalshiEventResponse {
  markets?: KalshiMarket[];
}

/** Try a couple of likely event tickers for the World Cup winner market. */
const CANDIDATE_EVENT_TICKERS = ['KXWORLDCUP', 'WORLDCUPWINNER', 'KXWCWINNER'];

async function fetchEventMarkets(eventTicker: string): Promise<KalshiMarket[]> {
  const url = `${BASE}/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as KalshiEventResponse & { event?: { markets?: KalshiMarket[] } };
  return data.markets ?? data.event?.markets ?? [];
}

export async function fetchKalshiWinner(): Promise<Quote[]> {
  let markets: KalshiMarket[] = [];
  for (const t of CANDIDATE_EVENT_TICKERS) {
    markets = await fetchEventMarkets(t);
    if (markets.length) break;
  }

  // Fallback: search markets endpoint for World Cup winner contracts.
  if (!markets.length) {
    const url = `${BASE}/markets?status=open&limit=200`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 60 } });
    if (res.ok) {
      const data = (await res.json()) as { markets?: KalshiMarket[] };
      markets = (data.markets ?? []).filter((m) =>
        /world cup/i.test(`${m.title} ${m.ticker}`) && /win/i.test(`${m.title} ${m.ticker}`)
      );
    }
  }

  const quotes: Quote[] = [];
  for (const m of markets) {
    if (m.status && m.status !== 'active' && m.status !== 'open') continue;
    const label = m.yes_sub_title || m.subtitle || m.title || '';
    const team = resolveTeam(label);
    if (!team) continue;

    const ts = new Date().toISOString();
    if (typeof m.yes_ask === 'number' && m.yes_ask > 0 && m.yes_ask < 100) {
      const yes = normalizePrice(m.yes_ask, 'cents');
      quotes.push({
        source: 'kalshi',
        sourceLabel: 'Kalshi',
        sourceKind: 'prediction_market',
        outcomeId: team.id,
        outcomeLabel: team.name,
        side: 'back',
        impliedProb: yes.impliedProb,
        decimalOdds: yes.decimalOdds,
        rawPrice: m.yes_ask,
        rawFormat: 'cents',
        liquidity: m.liquidity ?? null,
        url: m.ticker ? `https://kalshi.com/markets/${m.ticker}` : undefined,
        ts,
      });
    }
    if (typeof m.no_ask === 'number' && m.no_ask > 0 && m.no_ask < 100) {
      const no = normalizePrice(m.no_ask, 'cents');
      quotes.push({
        source: 'kalshi',
        sourceLabel: 'Kalshi',
        sourceKind: 'prediction_market',
        outcomeId: team.id,
        outcomeLabel: team.name,
        side: 'lay',
        impliedProb: no.impliedProb,
        decimalOdds: no.decimalOdds,
        rawPrice: m.no_ask,
        rawFormat: 'cents',
        liquidity: m.liquidity ?? null,
        url: m.ticker ? `https://kalshi.com/markets/${m.ticker}` : undefined,
        ts,
      });
    }
  }
  return quotes;
}
