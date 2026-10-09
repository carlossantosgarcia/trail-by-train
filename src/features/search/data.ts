// Loading and querying the bundled place index.
//
// The index is fetched once, lazily — on first use of the search field, not at
// app start — so ~900 KB (gzipped) never competes with the map's first paint.
// Every name is accent-folded at load, which is the only preprocessing the
// query needs: a linear scan over ~49k folded strings answers in single-digit
// milliseconds, so there is no trie, no worker, and no debounce.

import {
  isPointKind,
  type ExtentResult,
  type PlaceIndexFile,
  type PointResult,
  type SearchResult,
} from './types';

/**
 * Canonical form for matching: strip diacritics, lowercase, and turn the
 * separators French place names are full of into spaces. That last step is
 * what makes `saint mar` find `Saint-Martin-de-Clelles` and `l abergement`
 * find `L'Abergement-Clémenciat`, since word-boundary matching then works on
 * plain spaces.
 */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-'’./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface FoldedPoint {
  folded: string;
  /** Folded aliases paired with the original text, for the `via` label. */
  aliases: [string, string][];
  result: Omit<PointResult, 'score' | 'via'>;
  rank: number;
}

interface FoldedExtent {
  folded: string;
  aliases: [string, string][];
  result: Omit<ExtentResult, 'score' | 'via'>;
  rank: number;
}

interface LoadedIndex {
  points: FoldedPoint[];
  extents: FoldedExtent[];
  generatedAt: string;
}

let cached: LoadedIndex | null = null;
let pending: Promise<LoadedIndex> | null = null;

function indexUrl(): string {
  return `${import.meta.env.BASE_URL}data/place-index.json`;
}

export function ensureIndexLoaded(): Promise<LoadedIndex> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const resp = await fetch(indexUrl(), { credentials: 'same-origin' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const file = (await resp.json()) as PlaceIndexFile;

    const foldAliases = (aliases: string[] | null): [string, string][] =>
      aliases ? aliases.map((a) => [fold(a), a] as [string, string]) : [];

    const points: FoldedPoint[] = [];
    for (const [name, lon, lat, kind, detail, rank, aliases] of file.places) {
      if (!isPointKind(kind)) continue;
      points.push({
        folded: fold(name),
        aliases: foldAliases(aliases),
        rank,
        result: { shape: 'point', kind, name, coord: [lon, lat], detail },
      });
    }

    const extents: FoldedExtent[] = [];
    for (const [
      name,
      kind,
      minLon,
      minLat,
      maxLon,
      maxLat,
      pair,
      id,
      extra,
      aliases,
    ] of file.features) {
      extents.push({
        folded: fold(name),
        aliases: foldAliases(aliases),
        rank: 0,
        result: {
          shape: 'extent',
          kind,
          name,
          bbox: [minLon, minLat, maxLon, maxLat],
          detail: pair?.[0] ?? null,
          sub: pair?.[1] ?? null,
          id,
          extra,
        },
      });
    }

    cached = { points, extents, generatedAt: file.generatedAt };
    pending = null;
    return cached;
  })();
  return pending;
}

// ---- Scoring.
//
// Match quality dominates, kind breaks ties between equally good matches, and
// size breaks ties within a kind. The bands are far apart so a weight can
// never promote a mid-word match over a prefix match.

const SCORE_EXACT = 400;
const SCORE_PREFIX = 300;
const SCORE_WORD = 200;
const SCORE_SUBSTRING = 100;

/** Which kinds a user most often means when several match equally well. */
const KIND_WEIGHT: Record<string, number> = {
  commune: 9,
  sommet: 8,
  gare: 7,
  // Below communes: a locality and a commune of the same name are usually the
  // same place, and the commune is the better-attested record of it.
  lieu: 7,
  col: 6,
  bus: 5,
  rando: 5,
  gr: 5,
  lac: 4,
  glacier: 3,
};

/**
 * Below this length a query only matches at the start of the name or of a
 * word in it, never mid-word.
 *
 * Relevance and cost point the same way here. "le" appears inside thousands of
 * French place names, so a mid-word match on two letters tells you nothing —
 * and scoring every one of those hits made that single query take 190 ms,
 * which is felt as lag when it runs on each keystroke.
 */
const MIN_SUBSTRING_QUERY = 4;

function matchScore(folded: string, q: string): number {
  if (folded === q) return SCORE_EXACT;
  if (folded.startsWith(q)) return SCORE_PREFIX;
  const at = folded.indexOf(q);
  if (at < 0) return 0;
  if (folded[at - 1] === ' ') return SCORE_WORD;
  return q.length < MIN_SUBSTRING_QUERY ? 0 : SCORE_SUBSTRING;
}

/**
 * A match on an alias counts, but never as much as the same match on the
 * primary name.
 *
 * The size matters. At 40 the penalty was too small: a bus line whose long
 * name begins "ALPE D'HUEZ- LIGNE LAC BESSON" prefix-matched "alpe d huez"
 * and outranked the resort itself, which only matches at a word boundary
 * inside "L'Alpe-d'Huez". Set above the 100-point gap between quality bands,
 * any primary-name match outranks any weaker alias match, while an exact
 * alias hit — "Barre des Écrins", "Ligne 62" — still comfortably wins its
 * query.
 */
const ALIAS_PENALTY = 110;

/** Best match across the primary name and any aliases, with what matched. */
function bestMatch(
  folded: string,
  aliases: readonly [string, string][],
  q: string,
): { score: number; via: string | null } {
  let score = matchScore(folded, q);
  let via: string | null = null;
  for (const [foldedAlias, original] of aliases) {
    const s = matchScore(foldedAlias, q) - ALIAS_PENALTY;
    if (s > score) {
      score = s;
      via = original;
    }
  }
  return { score: score > 0 ? score : 0, via: score > 0 ? via : null };
}

/**
 * Size tiebreak. Population is log-scaled so Grenoble (158k) beats a hamlet
 * without a megacity swamping the match-quality bands; summit altitude is
 * scaled to a comparable ceiling.
 */
function rankBonus(kind: string, rank: number): number {
  if (!rank) return 0;
  if (kind === 'commune' || kind === 'lieu') return Math.min(30, Math.log10(rank + 1) * 6);
  if (kind === 'sommet' || kind === 'col') return Math.min(20, rank / 250);
  return 0;
}

/** Minimum query length. One character matches half the index. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Cap per kind, so one crowded group cannot bury the others. At 6, "Die"
 * filled the visible list with communes and left the Gares heading peeking
 * in at the bottom, its rows (Die station first) below the fold.
 */
const PER_KIND_CAP = 4;

/** Overall cap — enough to find the thing, short enough to stay a dropdown. */
const TOTAL_CAP = 24;

export function queryIndex(index: LoadedIndex, raw: string): SearchResult[] {
  const q = fold(raw);
  if (q.length < MIN_QUERY_LENGTH) return [];

  // Candidates are gathered as parallel arrays, not as result objects.
  // A broad query still matches a lot — "le" hits ~16k records — and building
  // a spread object for every one of them, then sorting those objects with a
  // locale-aware tie-break, was most of the cost of a keystroke. Only the two
  // dozen that survive the caps are ever materialised.
  const cand: (FoldedPoint | FoldedExtent)[] = [];
  const cScore: number[] = [];
  const cVia: (string | null)[] = [];

  for (const entry of index.points) {
    const m = bestMatch(entry.folded, entry.aliases, q);
    if (!m.score) continue;
    cand.push(entry);
    cScore.push(
      m.score + (KIND_WEIGHT[entry.result.kind] ?? 0) + rankBonus(entry.result.kind, entry.rank),
    );
    cVia.push(m.via);
  }
  for (const entry of index.extents) {
    const m = bestMatch(entry.folded, entry.aliases, q);
    if (!m.score) continue;
    cand.push(entry);
    cScore.push(m.score + (KIND_WEIGHT[entry.result.kind] ?? 0));
    cVia.push(m.via);
  }

  // Rank on score alone: a numeric comparator over an index array, with no
  // string work at all.
  const order = new Array<number>(cand.length);
  for (let i = 0; i < order.length; i++) order[i] = i;
  order.sort((a, b) => cScore[b] - cScore[a]);

  const perKind: Record<string, number> = {};
  const out: SearchResult[] = [];
  for (const i of order) {
    const entry = cand[i];
    const kind = entry.result.kind;
    const n = perKind[kind] ?? 0;
    if (n >= PER_KIND_CAP) continue;
    perKind[kind] = n + 1;
    out.push({ ...entry.result, via: cVia[i], score: cScore[i] } as SearchResult);
    if (out.length >= TOTAL_CAP) break;
  }

  // Alphabetical tie-break, now over a couple of dozen rows rather than
  // thousands. Which equal-scoring rows made the cut is decided by index
  // order, which is stable across runs.
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
  return out;
}

/**
 * Group results by kind, ordering the groups by their best hit rather than by
 * a fixed list — so a query that clearly means a summit leads with Sommets,
 * and one that means a town leads with Communes.
 */
export function groupByKind(results: SearchResult[]): { kind: string; items: SearchResult[] }[] {
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = groups.get(r.kind);
    if (list) list.push(r);
    else groups.set(r.kind, [r]);
  }
  return Array.from(groups.entries())
    .map(([kind, items]) => ({ kind, items }))
    .sort((a, b) => b.items[0].score - a.items[0].score);
}
