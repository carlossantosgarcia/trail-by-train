import maplibregl from 'maplibre-gl';
import type { MutableRefObject } from 'react';
import {
  TRANSIT_PROVIDERS,
  ensureTransitStops,
  nearestPointOnLine,
  setupTransitProviderOverlay,
  transitLayerIds,
  transitStopHitLayers,
  type DaySelection,
  type TransitLineProperties,
  type TransitStopProperties,
} from '../../transit';
import { setTransitPopupTarget } from '../../transit/popupStore';
import { getTransitHighlight, setTransitHighlight } from '../../transit/highlightStore';
import { claimMapTap } from '../../lib/mapGestures';
import { hydrateLineProps, hydrateStopProps } from './hydrate';
import { HOVER_HALO_LAYER } from './style';

interface TransitMounterOptions {
  mountedTransitIds: MutableRefObject<Set<string>>;
  transitVisibleRef: MutableRefObject<Record<string, boolean>>;
  providerColorsRef: MutableRefObject<Record<string, string | null>>;
  dayFilterRef: MutableRefObject<DaySelection>;
  showArchivedRef: MutableRefObject<boolean>;
  /** Teardowns of mounted provider overlays, run on map unmount. */
  teardownTransit: Array<() => void>;
  /** Event-listener detachers, run on map unmount. */
  offEventListeners: Array<() => void>;
}

// Transit overlays — registered below the hover marker so the hover dot stays
// on top, and below curated/user GPX layers. Each provider gets its own source
// + layer set so toggling one doesn't affect the others.
//
// Providers are mounted lazily: only those whose toggle is on at first paint
// (or toggled on later) pay the fetch + layer cost. Taps are handled once for
// all of them (see attachTransitClicks).
export function createTransitMounter(
  map: maplibregl.Map,
  {
    mountedTransitIds,
    transitVisibleRef,
    providerColorsRef,
    dayFilterRef,
    showArchivedRef,
    teardownTransit,
    offEventListeners,
  }: TransitMounterOptions,
): (providerId: string) => void {
  offEventListeners.push(attachTransitClicks(map, mountedTransitIds));
  return (providerId: string) => {
    if (mountedTransitIds.current.has(providerId)) return;
    const provider = TRANSIT_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;
    const teardown = setupTransitProviderOverlay(map, provider, {
      beforeId: HOVER_HALO_LAYER,
      initialVisible: transitVisibleRef.current[provider.id] ?? false,
      initialColor: providerColorsRef.current[provider.id] ?? provider.lineColor,
      initialDayFilter: dayFilterRef.current,
      initialShowArchived: showArchivedRef.current,
    });
    teardownTransit.push(teardown);
    mountedTransitIds.current.add(provider.id);
  };
}

type Hit =
  | { kind: 'stop'; feature: maplibregl.MapGeoJSONFeature }
  | { kind: 'line'; feature: maplibregl.MapGeoJSONFeature }
  | null;

/**
 * What a tap at `point` lands on, across every network. A stop wins over the
 * line it sits on — its hit circle is small, so a tap beside it still reaches
 * the line — and the focused line wins over the lines it runs along.
 */
function hitAt(map: maplibregl.Map, point: maplibregl.Point, providerIds: Iterable<string>): Hit {
  const stopLayers: string[] = [];
  const lineLayers: string[] = [];
  for (const id of providerIds) {
    for (const l of transitStopHitLayers(id)) if (map.getLayer(l)) stopLayers.push(l);
    const line = transitLayerIds(id).hitLineLayer;
    if (map.getLayer(line)) lineLayers.push(line);
  }
  if (stopLayers.length > 0) {
    const stops = map.queryRenderedFeatures(point, { layers: stopLayers });
    if (stops.length > 0) {
      // Nearest stop to the tap.
      let best = stops[0];
      let bestD = Infinity;
      for (const f of stops) {
        const g = f.geometry as { type: string; coordinates: [number, number] };
        if (g.type !== 'Point') continue;
        const p = map.project(g.coordinates);
        const d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      return { kind: 'stop', feature: best };
    }
  }
  if (lineLayers.length > 0) {
    const lines = map.queryRenderedFeatures(point, { layers: lineLayers });
    if (lines.length > 0) {
      const focus = getTransitHighlight();
      const focused =
        focus &&
        lines.find(
          (f) =>
            (f.properties as { provider_id?: string }).provider_id === focus.providerId &&
            String((f.properties as { route_id?: unknown }).route_id) === focus.routeId,
        );
      return { kind: 'line', feature: focused || lines[0] };
    }
  }
  return null;
}

function providerOf(feature: maplibregl.MapGeoJSONFeature): string {
  // Layer ids are `transit-<provider>-…`; the feature's own provider_id is the
  // same value, but the layer is authoritative for which source answered.
  const fromLayer = /^transit-(.+?)-(?:line|stop|focus-stop)-hit$/.exec(feature.layer.id)?.[1];
  return fromLayer ?? (feature.properties as { provider_id: string }).provider_id;
}

/** One tap handler for every network: stop or line, then its card. */
function attachTransitClicks(
  map: maplibregl.Map,
  mountedTransitIds: MutableRefObject<Set<string>>,
): () => void {
  const onClick = (e: maplibregl.MapMouseEvent) => {
    const hit = hitAt(map, e.point, mountedTransitIds.current);
    if (!hit) return;
    claimMapTap();
    const providerId = providerOf(hit.feature);
    if (hit.kind === 'stop') {
      const geom = hit.feature.geometry as { type: string; coordinates: [number, number] };
      setTransitPopupTarget({
        kind: 'stop',
        providerId,
        props: hydrateStopProps(hit.feature.properties as unknown as TransitStopProperties),
        anchor: geom.type === 'Point' ? geom.coordinates : [e.lngLat.lng, e.lngLat.lat],
      });
      return;
    }
    const props = hydrateLineProps(hit.feature.properties as unknown as TransitLineProperties);
    // Snap the popup anchor to the nearest point on the clicked line so its
    // tail meets the visible line rather than where the wider hit area was hit.
    const anchor = nearestPointOnLine(
      hit.feature.geometry as unknown as Parameters<typeof nearestPointOnLine>[0],
      [e.lngLat.lng, e.lngLat.lat],
    );
    openLine(providerId, props, anchor);
  };
  // Pointer cursor over anything tappable, looked up at most once a frame.
  let frame = 0;
  let last: maplibregl.Point | null = null;
  const onMove = (e: maplibregl.MapMouseEvent) => {
    last = e.point;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!last) return;
      const hit = hitAt(map, last, mountedTransitIds.current);
      const canvas = map.getCanvas();
      if (hit) canvas.style.cursor = 'pointer';
      else if (canvas.style.cursor === 'pointer' && canvas.dataset.transitCursor) {
        canvas.style.cursor = '';
      }
      if (hit) canvas.dataset.transitCursor = '1';
      else delete canvas.dataset.transitCursor;
    });
  };
  map.on('click', onClick);
  map.on('mousemove', onMove);
  return () => {
    map.off('click', onClick);
    map.off('mousemove', onMove);
    if (frame) cancelAnimationFrame(frame);
  };
}

/** Open a line's card and focus it on the map. */
function openLine(providerId: string, props: TransitLineProperties, anchor: [number, number]) {
  setTransitPopupTarget({ kind: 'line', providerId, props, anchor });
  const current = getTransitHighlight();
  if (current?.providerId !== providerId || current.routeId !== props.route_id) {
    setTransitHighlight({ providerId, routeId: props.route_id });
  }
}

function findLine(
  map: maplibregl.Map,
  providerId: string,
  routeId: string,
): maplibregl.MapGeoJSONFeature | undefined {
  const L = transitLayerIds(providerId);
  if (!map.getSource(L.lineSource)) return undefined;
  // One feature per route_id (its shapes dissolved), so any match carries the
  // card; the one nearest the view centre gives the best anchor.
  return map.querySourceFeatures(L.lineSource, {
    sourceLayer: 'transit',
    filter: ['==', ['to-string', ['get', 'route_id']], routeId],
  })[0];
}

/**
 * `transit:open-line` → that line's card, focused. Sent by a stop card's line
 * rows and by the focus bar. Without an anchor the card points at the line
 * where it is nearest the centre of the view.
 */
export function attachOpenLineListener(map: maplibregl.Map): () => void {
  const onOpenLine = (e: Event) => {
    const detail = (
      e as CustomEvent<{ providerId: string; routeId: string; anchor?: [number, number] }>
    ).detail;
    const open = (feature: maplibregl.MapGeoJSONFeature) => {
      const c = map.getCenter();
      const anchor =
        detail.anchor ??
        nearestPointOnLine(
          feature.geometry as unknown as Parameters<typeof nearestPointOnLine>[0],
          [c.lng, c.lat],
        );
      openLine(
        detail.providerId,
        hydrateLineProps(feature.properties as unknown as TransitLineProperties),
        anchor,
      );
    };
    const feature = findLine(map, detail.providerId, detail.routeId);
    if (feature) {
      open(feature);
      return;
    }
    // Not in any loaded tile: frame it, and open the card once it has drawn.
    // Framing waits on the line's extent, so the first idle may come before
    // the move: look again after each one, a few times.
    setTransitHighlight({ providerId: detail.providerId, routeId: detail.routeId, fit: true });
    let tries = 0;
    const onIdle = () => {
      const f = findLine(map, detail.providerId, detail.routeId);
      if (f) open(f);
      else if (++tries < 5) map.once('idle', onIdle);
    };
    map.once('idle', onIdle);
  };
  window.addEventListener('transit:open-line', onOpenLine);
  return () => window.removeEventListener('transit:open-line', onOpenLine);
}

/** Below this zoom a stop shown from a list is zoomed to, so it reads among its neighbours. */
const SHOW_STOP_ZOOM = 14;

/**
 * `transit:open-stop` → bring that stop into view and open its card, keeping
 * the line focused. Sent by the stop list of a line card, which knows the
 * stop's id and position but not the properties its card is built from: those
 * come from the stops source once the map has moved there.
 */
export function attachOpenStopListener(map: maplibregl.Map): () => void {
  const onOpenStop = (e: Event) => {
    const { providerId, routeId, stopId, lngLat } = (
      e as CustomEvent<{
        providerId: string;
        routeId: string;
        stopId: string;
        lngLat: [number, number];
      }>
    ).detail;
    const current = getTransitHighlight();
    if (current?.providerId !== providerId || current.routeId !== routeId) {
      setTransitHighlight({ providerId, routeId });
    }
    ensureTransitStops(map, providerId);
    // On a phone the stop's card covers the lower half: show the stop above it.
    const phone = window.matchMedia('(max-width: 768px)').matches;
    map.easeTo({
      center: lngLat,
      zoom: Math.max(map.getZoom(), SHOW_STOP_ZOOM),
      ...(phone
        ? { padding: { top: 0, right: 0, left: 0, bottom: window.innerHeight * 0.5 } }
        : {}),
      duration: 600,
    });
    map.once('idle', () => {
      const source = transitLayerIds(providerId).stopSource;
      if (!map.getSource(source)) return;
      const feature = map.querySourceFeatures(source, {
        filter: ['==', ['get', 'stop_id'], stopId],
      })[0];
      if (!feature) return;
      setTransitPopupTarget({
        kind: 'stop',
        providerId,
        props: hydrateStopProps(feature.properties as unknown as TransitStopProperties),
        anchor: lngLat,
      });
    });
  };
  window.addEventListener('transit:open-stop', onOpenStop);
  return () => window.removeEventListener('transit:open-stop', onOpenStop);
}
