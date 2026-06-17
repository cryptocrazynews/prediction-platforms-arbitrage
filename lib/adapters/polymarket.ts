// ---------------------------------------------------------------------------
// Polymarket adapter — public Gamma API (no auth)
//   https://gamma-api.polymarket.com
//
// Polymarket prices binary outcome tokens between $0 and $1 (a probability).
// For an outright "Will <Team> win the World Cup?" market, `outcomePrices`
// holds [YES, NO] as strings. We emit a BACK quote (buy YES on the team) and a
// LAY quote (buy NO = bet against the team).
//
// Polymarket groups related markets under an "event". We look up the World Cup
// winner event by tag/slug, then walk its child markets.
// ---------------------------------------------------------------------------

import type { Quote } from '../types';
import { normalizePrice } from '../price';
import { resolveTeam } from '../teams';

const GAMMA = 'https://gamma-api.polymarket.com';

interface GammaMarket {
  question?: string;
  groupItemTitle?: string;
  slug?: string;
  outcomes?: string; // JSON string array, e.g. '["Yes","No"]'
  outcomePrices?: string; // JSON string array, e.g. '["0.12","0.88"]'
  liquidityNum?: number;
  liquidity?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
  updatedAt?: string;
}

interface GammaEvent {
  title?: string;
  slug?: string;
  markets?: GammaMarket[];
}

function parseJsonArray(s?: string): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function fetchPolymarketWinner(): Promise<Quote[]> {
  // Discover the World Cup winner event. The slug changes between editions, so
  // we search rather than hard-coding it.
  const searchUrl = `${GAMMA}/events?closed=false&limit=40&search=world%20cup%20winner`;
  const res = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Polymarket events ${res.status}`);
  const events = (await res.json()) as GammaEvent[];

  const event = events.find(
    (e) =>
      /world cup/i.test(e.title ?? '') &&
      /winner|win the/i.test(e.title ?? `${e.slug}`)
  );
  if (!event?.markets?.length) return [];

  const quotes: Quote[] = [];
  for (const m of event.markets) {
    if (m.closed || m.acceptingOrders === false) continue;
    const outcomes = parseJsonArray(m.outcomes); // ["Yes","No"]
    const prices = parseJsonArray(m.outcomePrices).map(Number); // [yes, no]
    if (outcomes.length < 2 || prices.length < 2) continue;

    // The team this binary market is about — from the per-market title.
    const teamLabel = m.groupItemTitle || m.question || '';
    const team = resolveTeam(teamLabel);
    if (!team) continue;

    const yesIdx = outcomes.findIndex((o) => /yes/i.test(o));
    const noIdx = outcomes.findIndex((o) => /no/i.test(o));
    if (yesIdx === -1 || noIdx === -1) continue;

    const yesProb = prices[yesIdx];
    const noProb = prices[noIdx];
    if (!(yesProb > 0 && yesProb < 1)) continue;

    const ts = m.updatedAt ?? new Date().toISOString();
    const url = m.slug ? `https://polymarket.com/event/${event.slug}` : undefined;
    const liq = m.liquidityNum ?? (m.liquidity ? Number(m.liquidity) : null);

    const yes = normalizePrice(yesProb, 'prob');
    quotes.push({
      source: 'polymarket',
      sourceLabel: 'Polymarket',
      sourceKind: 'prediction_market',
      outcomeId: team.id,
      outcomeLabel: team.name,
      side: 'back',
      impliedProb: yes.impliedProb,
      decimalOdds: yes.decimalOdds,
      rawPrice: yesProb,
      rawFormat: 'prob',
      liquidity: liq,
      url,
      ts,
    });

    if (noProb > 0 && noProb < 1) {
      const no = normalizePrice(noProb, 'prob');
      quotes.push({
        source: 'polymarket',
        sourceLabel: 'Polymarket',
        sourceKind: 'prediction_market',
        outcomeId: team.id,
        outcomeLabel: team.name,
        side: 'lay',
        impliedProb: no.impliedProb,
        decimalOdds: no.decimalOdds,
        rawPrice: noProb,
        rawFormat: 'prob',
        liquidity: liq,
        url,
        ts,
      });
    }
  }
  return quotes;
}
