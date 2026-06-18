// ---------------------------------------------------------------------------
// Kalshi adapter — public market data, NO auth required for reads.
//
//   Base URL: https://api.elections.kalshi.com/trade-api/v2
//   (Despite the "elections" subdomain, this host serves ALL Kalshi markets.
//    The old api.kalshi.com host is why this adapter previously returned red.)
//
// World Cup 2026 winner market:
//   series  = KXMENWORLDCUP
//   event   = KXMENWORLDCUP-26
//   markets = KXMENWORLDCUP-26-<TEAM>  (one YES/NO contract per nation)
//
// Prices: the current API reports dollar strings in [0,1] via *_dollars fields
// (e.g. yes_ask_dollars="0.1780" = 17.8c = prob 0.178). Older responses used
// integer cents (yes_ask). We handle both.
//   yes_ask -> price to BUY YES  (back the team)
//   no_ask  -> price to BUY NO   (lay / bet against the team)
// ---------------------------------------------------------------------------

import type { Quote } from '../types';
import { normalizePrice } from '../price';
import { resolveTeam } from '../teams';

// Primary + fallback hosts (both serve public market data).
const HOSTS = [
  'https://api.elections.kalshi.com/trade-api/v2',
  'https://external-api.kalshi.com/trade-api/v2',
];

const SERIES_TICKER = 'KXMENWORLDCUP';
const EVENT_TICKER = 'KXMENWORLDCUP-26';

interface KalshiMarket {
  ticker?: string;
  title?: string;
  yes_sub_title?: string;
  subtitle?: string;
  status?: string;
  // current API: dollar strings in [0,1]
  yes_ask_dollars?: string;
  no_ask_dollars?: string;
  liquidity_dollars?: string;
  // legacy: integer cents
  yes_ask?: number;
  no_ask?: number;
  liquidity?: number;
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch all World Cup winner markets, trying each host until one responds. */
async function fetchMarkets(): Promise<KalshiMarket[]> {
  for (const host of HOSTS) {
    // Preferred: list every market in the series (covers all 48 nations).
    const bySeries = await getJson(
      `${host}/markets?series_ticker=${SERIES_TICKER}&status=open&limit=400`
    );
    if (bySeries?.markets?.length) return bySeries.markets as KalshiMarket[];

    // Fallback: pull the event with nested markets.
    const byEvent = await getJson(
      `${host}/events/${EVENT_TICKER}?with_nested_markets=true`
    );
    const evMarkets = byEvent?.markets ?? byEvent?.event?.markets;
    if (evMarkets?.length) return evMarkets as KalshiMarket[];
  }
  return [];
}

/** Parse a price that may be a dollar string (0..1) or integer cents (1..99). */
function priceToProb(
  dollars?: string,
  cents?: number
): { impliedProb: number; decimalOdds: number; raw: number; fmt: 'prob' | 'cents' } | null {
  if (typeof dollars === 'string' && dollars.length) {
    const v = Number(dollars);
    if (v > 0 && v < 1) return { ...normalizePrice(v, 'prob'), raw: v, fmt: 'prob' };
  }
  if (typeof cents === 'number' && cents > 0 && cents < 100) {
    return { ...normalizePrice(cents, 'cents'), raw: cents, fmt: 'cents' };
  }
  return null;
}

export async function fetchKalshiWinner(): Promise<Quote[]> {
  const markets = await fetchMarkets();
  const quotes: Quote[] = [];

  for (const m of markets) {
    if (m.status && m.status !== 'active' && m.status !== 'open') continue;
    const label = m.yes_sub_title || m.subtitle || m.title || '';
    const team = resolveTeam(label);
    if (!team) continue;

    const ts = new Date().toISOString();
    const url = m.ticker ? `https://kalshi.com/markets/${m.ticker}` : undefined;
    const liquidity =
      m.liquidity_dollars != null ? Number(m.liquidity_dollars) : m.liquidity ?? null;

    const yes = priceToProb(m.yes_ask_dollars, m.yes_ask);
    if (yes) {
      quotes.push({
        source: 'kalshi',
        sourceLabel: 'Kalshi',
        sourceKind: 'prediction_market',
        outcomeId: team.id,
        outcomeLabel: team.name,
        side: 'back',
        impliedProb: yes.impliedProb,
        decimalOdds: yes.decimalOdds,
        rawPrice: yes.raw,
        rawFormat: yes.fmt,
        liquidity,
        url,
        ts,
      });
    }

    const no = priceToProb(m.no_ask_dollars, m.no_ask);
    if (no) {
      quotes.push({
        source: 'kalshi',
        sourceLabel: 'Kalshi',
        sourceKind: 'prediction_market',
        outcomeId: team.id,
        outcomeLabel: team.name,
        side: 'lay',
        impliedProb: no.impliedProb,
        decimalOdds: no.decimalOdds,
        rawPrice: no.raw,
        rawFormat: no.fmt,
        liquidity,
        url,
        ts,
      });
    }
  }
  return quotes;
}
