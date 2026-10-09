// Shapes of the bundled place index (public/data/place-index.json) and of a
// query result.
//
// The two record shapes are not a storage detail — they are the whole reason
// selection behaves differently. A `point` has a coordinate, so a circle
// around it means something and it can seed Explore. An `extent` is a line or
// a track: its bbox centre can easily lie nowhere near the thing itself (the
// centre of a 400 km GR's bbox is a field in the middle of France), so those
// are framed and revealed instead of being handed to Explore.

/** Kinds carrying a single coordinate. These seed the Explore radius panel. */
export type PointKind = 'sommet' | 'col' | 'lac' | 'glacier' | 'commune' | 'gare' | 'lieu';

/** Kinds carrying a bounding box. These are framed, never given to Explore. */
export type ExtentKind = 'bus' | 'rando' | 'gr';

export type PlaceKind = PointKind | ExtentKind;

const POINT_KINDS: ReadonlySet<string> = new Set<PointKind>([
  'sommet',
  'col',
  'lac',
  'glacier',
  'commune',
  'gare',
  'lieu',
]);

export interface PointResult {
  shape: 'point';
  kind: PointKind;
  name: string;
  /** [lon, lat]. */
  coord: [number, number];
  /** Altitude for a summit, department for a commune, commune for a gare. */
  detail: string | null;
  /**
   * The alias the query actually matched, when it was not the primary name.
   * Shown in the row so "Barre des Écrins" visibly explains a result titled
   * "Les Écrins", instead of looking like a mismatch.
   */
  via: string | null;
  score: number;
}

export interface ExtentResult {
  shape: 'extent';
  kind: ExtentKind;
  name: string;
  bbox: [number, number, number, number];
  /** Line's long name, hike's duration, GR's name. */
  detail: string | null;
  /** Provider label, hike source, GR length. */
  sub: string | null;
  /** route_id / hike id / GR ref — what the reveal handler needs to find it. */
  id: string;
  /** provider_id for a bus line, colour for a hike. */
  extra: string | null;
  /** See `PointResult.via`. */
  via: string | null;
  score: number;
}

export type SearchResult = PointResult | ExtentResult;

export function isPointResult(r: SearchResult): r is PointResult {
  return r.shape === 'point';
}

export function isPointKind(kind: string): kind is PointKind {
  return POINT_KINDS.has(kind);
}

/** Plural headings for the result groups. */
export const KIND_LABEL: Record<PlaceKind, string> = {
  sommet: 'Sommets',
  col: 'Cols',
  lac: 'Lacs',
  glacier: 'Glaciers',
  commune: 'Communes',
  // Hamlets, localities and ski resorts — the places that are not communes in
  // their own right (L'Alpe-d'Huez, Val Thorens) but are what people search.
  lieu: 'Lieux-dits & stations',
  gare: 'Gares',
  bus: 'Lignes de bus',
  rando: 'Randonnées',
  gr: 'GR',
};

/** Raw index file, as written by scripts/search/build-index.mjs. */
export interface PlaceIndexFile {
  version: number;
  generatedAt: string;
  counts: Record<string, number>;
  /** [name, lon, lat, kind, detail, rank, aliases] */
  places: [string, number, number, PointKind, string | null, number, string[] | null][];
  /** [name, kind, minLon, minLat, maxLon, maxLat, [detail, sub], id, extra, aliases] */
  features: [
    string,
    ExtentKind,
    number,
    number,
    number,
    number,
    [string | null, string | null],
    string,
    string | null,
    string[] | null,
  ][];
}
