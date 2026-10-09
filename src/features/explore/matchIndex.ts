// Point-in-polygon matching over explore-index.json (built by
// scripts/transit/build-explore-index.mjs). Pure, so it runs in the Explore
// worker and in tests alike.

import { pointInPolygon, type LonLat } from './geometry';

export interface ExploreIndex {
  version: number;
  /** Per provider: its lines as [route_id, short_name], and its stops as
   * [lon·1e5, lat·1e5, ...indexes into `lines`]. */
  providers: { id: string; lines: [string, string][]; stops: number[][] }[];
  /** [lon·1e5, lat·1e5, name, commune]. */
  stations: [number, number, string, string | null][];
}

export interface IndexMatch {
  /** Per provider, the [route_id, short_name] of every line with a stop inside. */
  lines: Record<string, [string, string][]>;
  /** [name, commune, lon, lat] of every station inside. */
  stations: [string, string | null, number, number][];
}

/** Every line with a stop inside `ringDeg`, and every station inside it. */
export function matchIndex(index: ExploreIndex, ringDeg: readonly LonLat[]): IndexMatch {
  // Stops are stored as integers of 1e-5°; scale the ring rather than every stop.
  const ring: LonLat[] = ringDeg.map(([x, y]) => [x * 1e5, y * 1e5]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const inside = (x: number, y: number) =>
    x >= minX && x <= maxX && y >= minY && y <= maxY && pointInPolygon([x, y], ring);

  const lines: Record<string, [string, string][]> = {};
  for (const p of index.providers) {
    const hit = new Set<number>();
    for (const s of p.stops) {
      if (!inside(s[0], s[1])) continue;
      for (let i = 2; i < s.length; i++) hit.add(s[i]);
    }
    if (hit.size) lines[p.id] = [...hit].map((i) => p.lines[i]);
  }
  const stations: [string, string | null, number, number][] = [];
  for (const [x, y, name, commune] of index.stations) {
    if (inside(x, y)) stations.push([name, commune, x / 1e5, y / 1e5]);
  }
  return { lines, stations };
}
