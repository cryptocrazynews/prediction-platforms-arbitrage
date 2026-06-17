// ---------------------------------------------------------------------------
// Entity resolution for teams
//
// Different platforms name the same nation differently:
//   "United States" / "USA" / "US"  ->  USA
//   "Korea Republic" / "South Korea" -> KOR
//
// Matching the same real-world outcome across platforms is the hard part of
// any arbitrage aggregator. For an MVP we use a curated registry of the World
// Cup field plus an alias map, with a normalize() fallback for fuzzy matches.
// ---------------------------------------------------------------------------

export interface Team {
  id: string; // canonical 3-letter code
  name: string; // display name
  aliases: string[]; // lowercased strings seen in the wild
}

// 2026 expanded 48-team field is large; we register the realistic title
// contenders plus common opponents. Unknown teams still resolve via slugging,
// they just won't get a pretty display name.
export const TEAMS: Team[] = [
  { id: 'ARG', name: 'Argentina', aliases: ['argentina'] },
  { id: 'BRA', name: 'Brazil', aliases: ['brazil', 'brasil'] },
  { id: 'FRA', name: 'France', aliases: ['france'] },
  { id: 'ESP', name: 'Spain', aliases: ['spain', 'españa', 'espana'] },
  { id: 'ENG', name: 'England', aliases: ['england'] },
  { id: 'POR', name: 'Portugal', aliases: ['portugal'] },
  { id: 'GER', name: 'Germany', aliases: ['germany', 'deutschland'] },
  { id: 'NED', name: 'Netherlands', aliases: ['netherlands', 'holland', 'the netherlands'] },
  { id: 'BEL', name: 'Belgium', aliases: ['belgium'] },
  { id: 'ITA', name: 'Italy', aliases: ['italy', 'italia'] },
  { id: 'URU', name: 'Uruguay', aliases: ['uruguay'] },
  { id: 'CRO', name: 'Croatia', aliases: ['croatia'] },
  { id: 'USA', name: 'United States', aliases: ['united states', 'usa', 'us', 'united states of america'] },
  { id: 'MEX', name: 'Mexico', aliases: ['mexico', 'méxico'] },
  { id: 'JPN', name: 'Japan', aliases: ['japan'] },
  { id: 'KOR', name: 'South Korea', aliases: ['south korea', 'korea republic', 'korea', 'republic of korea'] },
  { id: 'MAR', name: 'Morocco', aliases: ['morocco', 'maroc'] },
  { id: 'SEN', name: 'Senegal', aliases: ['senegal'] },
  { id: 'COL', name: 'Colombia', aliases: ['colombia'] },
  { id: 'PAR', name: 'Paraguay', aliases: ['paraguay'] },
  { id: 'CAN', name: 'Canada', aliases: ['canada'] },
];

// Special non-team outcome used by match 1X2 markets.
export const DRAW_OUTCOME = { id: 'DRAW', name: 'Draw' };

const ALIAS_TO_ID = new Map<string, string>();
for (const t of TEAMS) {
  ALIAS_TO_ID.set(t.name.toLowerCase(), t.id);
  for (const a of t.aliases) ALIAS_TO_ID.set(a, t.id);
}
const ID_TO_NAME = new Map<string, string>(TEAMS.map((t) => [t.id, t.name]));
ID_TO_NAME.set(DRAW_OUTCOME.id, DRAW_OUTCOME.name);

function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bto win.*$/i, '')
    .replace(/\bwins?\b.*$/i, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolve a free-text outcome label to a canonical id.
 * Returns null if it can't be confidently matched (caller may skip it).
 */
export function resolveTeam(label: string): { id: string; name: string } | null {
  if (!label) return null;
  const raw = label.toLowerCase().trim();
  if (raw === 'draw' || raw === 'tie' || raw === 'the draw') {
    return { id: DRAW_OUTCOME.id, name: DRAW_OUTCOME.name };
  }

  // 1) exact alias hit
  if (ALIAS_TO_ID.has(raw)) {
    const id = ALIAS_TO_ID.get(raw)!;
    return { id, name: ID_TO_NAME.get(id)! };
  }

  // 2) cleaned alias hit ("Will Brazil win the World Cup?" -> "brazil")
  const c = clean(label);
  if (ALIAS_TO_ID.has(c)) {
    const id = ALIAS_TO_ID.get(c)!;
    return { id, name: ID_TO_NAME.get(id)! };
  }

  // 3) substring scan — pick the longest alias contained in the label
  let best: { id: string; len: number } | null = null;
  for (const [alias, id] of ALIAS_TO_ID) {
    if (c.includes(alias) && (!best || alias.length > best.len)) {
      best = { id, len: alias.length };
    }
  }
  if (best) return { id: best.id, name: ID_TO_NAME.get(best.id)! };

  // 4) unknown team — slug it so it still groups consistently across sources
  const slug = c.toUpperCase().replace(/\s+/g, '_').slice(0, 12);
  if (!slug) return null;
  return { id: `X_${slug}`, name: label.trim() };
}

export function teamName(id: string): string {
  return ID_TO_NAME.get(id) ?? id.replace(/^X_/, '').replace(/_/g, ' ');
}
