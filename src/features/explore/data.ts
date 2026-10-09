// Data loading + spatial matching for Explore mode. Bus stops and rail
// stations are matched in a worker over one compact index
// (public/transit/explore-index.json); the curated-hike manifest is small and
// stays here. MapLibre's loaded sources aren't queryable off-viewport, which is
// why Explore keeps its own copy of the stops.

import { TRANSIT_PROVIDERS } from '../../transit';
import { loadManifest } from '../curated-hikes';
import type { CuratedManifest } from '../curated-hikes';
import { pointInPolygon, type LonLat } from './geometry';
import { assignLineColors } from './palette';
import type { WorkerRequest, WorkerResponse } from './explore.worker';
import { compareFr, compareFrNumeric } from '../../lib/collate';

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

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let manifest: CuratedManifest | null = null;
let nextId = 0;
const waiting = new Map<number, (r: Extract<WorkerResponse, { kind: 'matched' }>) => void>();

function send(msg: WorkerRequest): void {
  worker!.postMessage(msg);
}

/**
 * Start (once) loading what Explore needs: the stop index, in the worker, and
 * the hike manifest. A failed load is forgotten, so the next attempt retries
 * rather than replaying the failure for the rest of the session.
 */
export function ensureExploreData(): Promise<void> {
  if (ready) return ready;
  if (!worker) {
    worker = new Worker(new URL('./explore.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.kind === 'matched') {
        waiting.get(msg.id)?.(msg);
        waiting.delete(msg.id);
      }
    });
  }
  const w = worker;
  const indexLoaded = new Promise<void>((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.kind === 'loaded') resolve();
      else if (ev.data.kind === 'load-failed') reject(new Error(ev.data.error));
      else return;
      w.removeEventListener('message', onMessage);
    };
    w.addEventListener('message', onMessage);
  });
  send({ kind: 'load', url: `${import.meta.env.BASE_URL}transit/explore-index.json` });
  ready = Promise.all([indexLoaded, loadManifest()])
    .then(([, m]) => {
      manifest = m;
    })
    .catch((err: unknown) => {
      ready = null;
      throw err;
    });
  return ready;
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
  await ensureExploreData();
  const id = ++nextId;
  const found = await new Promise<Extract<WorkerResponse, { kind: 'matched' }>>((resolve) => {
    waiting.set(id, resolve);
    send({ kind: 'match', id, ring: ring.map(([x, y]) => [x, y] as LonLat) });
  });

  // --- Buses, in catalog order.
  const providers: ExploreProviderGroup[] = [];
  const matchedRouteIdsByProvider: Record<string, string[]> = {};
  let totalLines = 0;
  for (const provider of TRANSIT_PROVIDERS) {
    const matched = found.lines[provider.id];
    if (!matched) continue;
    const lines: ExploreBusLine[] = matched
      .map(([routeId, shortName]) => ({ routeId, shortName, color: '#888888' }))
      .sort((a, b) => compareFrNumeric(a.shortName, b.shortName));
    providers.push({
      providerId: provider.id,
      providerLabel: provider.label,
      lineColor: provider.lineColor,
      lines,
    });
    matchedRouteIdsByProvider[provider.id] = lines.map((l) => l.routeId);
    totalLines += lines.length;
  }
  // Give every matched line a distinct colour (across all providers); this
  // replaces the placeholder above.
  assignLineColors(providers);

  // --- Rail stations.
  const stations: ExploreStation[] = found.stations
    .map(([name, commune, lon, lat]) => ({ name, commune, coord: [lon, lat] as LonLat }))
    .sort((a, b) => compareFr(a.name, b.name));

  // --- Curated hikes. Only their places are known (start, finish, nights),
  // not their routes, so a hike matches when one of those falls inside.
  const hikes: ExploreHike[] = [];
  for (const hike of manifest!.hikes) {
    const places: LonLat[] = [hike.start, hike.end];
    for (const d of hike.days) if (d.sleep) places.push(d.sleep.coord);
    if (!places.some((c) => pointInPolygon(c, ring))) continue;
    hikes.push({ id: hike.id, title: hike.title, colour: hike.colour, bbox: hike.bbox });
  }
  hikes.sort((a, b) => compareFr(a.title, b.title));

  return { providers, matchedRouteIdsByProvider, stations, hikes, totalLines };
}
