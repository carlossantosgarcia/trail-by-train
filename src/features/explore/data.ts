// Data loading + spatial matching for Explore mode. On first use we fetch,
// in parallel and cache for the session, the raw GeoJSON we need to run
// point-in-polygon queries: every provider's stops, all rail stations, and
// the curated hike tracks (MapLibre's loaded sources aren't fully queryable
// off-viewport, so we fetch the source JSON directly).

import type { FeatureCollection, Feature, Point } from 'geojson';
import { TRANSIT_PROVIDERS } from '../../transit';
import type { TransitStopProperties } from '../../transit';
import { loadManifest } from '../curated-hikes';
import type { CuratedManifest } from '../curated-hikes';
import { pointInPolygon, type LonLat } from './geometry';
import { assignLineColors } from './palette';

export interface ExploreBusLine {
  routeId: string;
  shortName: string;
  /** Distinct per-line colour assigned from the Carto Bold palette (set by
   * `assignLineColors`); used for both the map line and the panel chip. */
  color: string;
}

export interface ExploreProviderGroup {
  providerId: string;
  providerLabel: string;
  lineColor: string;
  lines: ExploreBusLine[];
}

export interface ExploreStation {
  name: string;
  commune: string | null;
  coord: LonLat;
}

export interface ExploreHike {
  id: string;
  title: string;
  colour: string;
  bbox: [number, number, number, number];
}

export interface ExploreResults {
  providers: ExploreProviderGroup[];
  /** Matched route_ids per provider, for filtering the map's line layers. */
  matchedRouteIdsByProvider: Record<string, string[]>;
  stations: ExploreStation[];
  hikes: ExploreHike[];
  totalLines: number;
}

interface ExploreData {
  stopsByProvider: Record<string, FeatureCollection<Point, TransitStopProperties>>;
  stations: FeatureCollection<Point, { name?: string; commune?: string }>;
  manifest: CuratedManifest;
}

let pending: Promise<ExploreData> | null = null;
let cached: ExploreData | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { credentials: 'same-origin' });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return (await resp.json()) as T;
}

/** Fetch (once) and cache every dataset Explore needs. */
export function ensureExploreData(): Promise<ExploreData> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const stationsUrl = `${import.meta.env.BASE_URL}rail-stations.geojson`;
    const [stopsEntries, stations, manifest] = await Promise.all([
      Promise.all(
        TRANSIT_PROVIDERS.map(async (p) => {
          const fc = await fetchJson<FeatureCollection<Point, TransitStopProperties>>(
            p.stopsGeoJsonUrl,
          );
          return [p.id, fc] as const;
        }),
      ),
      fetchJson<FeatureCollection<Point, { name?: string; commune?: string }>>(stationsUrl),
      loadManifest(),
    ]);
    cached = {
      stopsByProvider: Object.fromEntries(stopsEntries),
      stations,
      manifest,
    };
    pending = null;
    return cached;
  })();
  return pending;
}

function coordOf(feature: Feature<Point, unknown>): LonLat {
  const c = feature.geometry.coordinates;
  return [c[0], c[1]];
}

/**
 * Match a drawn region against all datasets:
 *  - buses: any line served by a stop inside the ring (across all providers,
 *    ignoring the app's day / low-frequency / provider toggles);
 *  - trains: rail stations whose point is inside the ring;
 *  - hikes: curated hikes starting, ending or spending a night inside the ring
 *    (GR excluded).
 */
export async function computeResults(ring: readonly LonLat[]): Promise<ExploreResults> {
  const data = await ensureExploreData();

  // --- Buses.
  const providers: ExploreProviderGroup[] = [];
  const matchedRouteIdsByProvider: Record<string, string[]> = {};
  let totalLines = 0;
  for (const provider of TRANSIT_PROVIDERS) {
    const fc = data.stopsByProvider[provider.id];
    if (!fc) continue;
    const seen = new Map<string, ExploreBusLine>();
    for (const feature of fc.features) {
      if (feature.geometry?.type !== 'Point') continue;
      if (!pointInPolygon(coordOf(feature), ring)) continue;
      const serving = feature.properties?.serving_lines ?? [];
      for (const line of serving) {
        if (seen.has(line.route_id)) continue;
        seen.set(line.route_id, {
          routeId: line.route_id,
          shortName: line.short_name,
          color: '#888888', // replaced by assignLineColors below
        });
      }
    }
    if (seen.size === 0) continue;
    const lines = Array.from(seen.values()).sort((a, b) =>
      a.shortName.localeCompare(b.shortName, 'fr', { numeric: true }),
    );
    providers.push({
      providerId: provider.id,
      providerLabel: provider.label,
      lineColor: provider.lineColor,
      lines,
    });
    matchedRouteIdsByProvider[provider.id] = lines.map((l) => l.routeId);
    totalLines += lines.length;
  }
  // Give every matched line a distinct colour (across all providers).
  assignLineColors(providers);

  // --- Rail stations.
  const stations: ExploreStation[] = [];
  for (const feature of data.stations.features) {
    if (feature.geometry?.type !== 'Point') continue;
    const coord = coordOf(feature);
    if (!pointInPolygon(coord, ring)) continue;
    stations.push({
      name: feature.properties?.name ?? 'Gare',
      commune: feature.properties?.commune ?? null,
      coord,
    });
  }
  stations.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  // --- Curated hikes. Only their places are known (start, finish, nights),
  // not their routes, so a hike matches when one of those falls inside.
  const hikes: ExploreHike[] = [];
  for (const hike of data.manifest.hikes) {
    const places: LonLat[] = [hike.start, hike.end];
    for (const d of hike.days) if (d.sleep) places.push(d.sleep.coord);
    if (!places.some((c) => pointInPolygon(c, ring))) continue;
    hikes.push({ id: hike.id, title: hike.title, colour: hike.colour, bbox: hike.bbox });
  }
  hikes.sort((a, b) => a.title.localeCompare(b.title, 'fr'));

  return { providers, matchedRouteIdsByProvider, stations, hikes, totalLines };
}
