// ---------------------------------------------------------------------------
// The Odds API adapter — sportsbook aggregator (API key, free tier available)
//   https://the-odds-api.com  sport_key: soccer_fifa_world_cup
//
// Returns decimal odds per bookmaker. Each bookmaker becomes its own source so
// the engine can back the best price per outcome across books. Sportsbooks
// only expose BACK prices for outright markets (you can't lay a single team),
// so we emit back quotes only.
// ---------------------------------------------------------------------------

import type { Quote } from '../types';
import { normalizePrice } from '../price';
import { resolveTeam } from '../teams';
import { env } from '../config';

const SPORT = 'soccer_fifa_world_cup';
const HOST = 'https://api.the-odds-api.com';

interface OddsApiOutcome {
  name: string;
  price: number; // decimal
}
interface OddsApiMarket {
  key: string; // 'outrights' | 'h2h' | ...
  last_update?: string;
  outcomes: OddsApiOutcome[];
}
interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsApiMarket[];
}
interface OddsApiEvent {
  id: string;
  sport_title?: string;
  bookmakers?: OddsApiBookmaker[];
}

export async function fetchOddsApiWinner(): Promise<Quote[]> {
  if (!env.oddsApiKey) return []; // no key -> skip silently

  const url =
    `${HOST}/v4/sports/${SPORT}/odds` +
    `?regions=${encodeURIComponent(env.oddsApiRegions)}` +
    `&markets=outrights&oddsFormat=decimal&apiKey=${env.oddsApiKey}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`The Odds API ${res.status}`);
  const events = (await res.json()) as OddsApiEvent[];

  const quotes: Quote[] = [];
  for (const ev of events) {
    for (const bk of ev.bookmakers ?? []) {
      const market = bk.markets.find((m) => m.key === 'outrights');
      if (!market) continue;
      const ts = market.last_update ?? bk.last_update ?? new Date().toISOString();
      for (const oc of market.outcomes) {
        const team = resolveTeam(oc.name);
        if (!team || !(oc.price > 1)) continue;
        const p = normalizePrice(oc.price, 'decimal');
        quotes.push({
          source: bk.key,
          sourceLabel: bk.title,
          sourceKind: bk.key.includes('betfair') ? 'exchange' : 'sportsbook',
          outcomeId: team.id,
          outcomeLabel: team.name,
          side: 'back',
          impliedProb: p.impliedProb,
          decimalOdds: p.decimalOdds,
          rawPrice: oc.price,
          rawFormat: 'decimal',
          liquidity: null,
          ts,
        });
      }
    }
  }
  return quotes;
}
