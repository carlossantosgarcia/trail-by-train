import maplibregl from 'maplibre-gl';
import type { MutableRefObject } from 'react';
import {
  TRANSIT_PROVIDERS,
  nearestPointOnLine,
  setupTransitProviderOverlay,
  transitLayerIds,
  type DayFilter,
  type TransitLineProperties,
  type TransitStopProperties,
} from '../../transit';
import { setTransitPopupTarget } from '../../transit/popupStore';
import { hydrateLineProps, hydrateStopProps } from './hydrate';
import { HOVER_HALO_LAYER } from './style';

interface TransitMounterOptions {
  mountedTransitIds: MutableRefObject<Set<string>>;
  transitVisibleRef: MutableRefObject<Record<string, boolean>>;
  providerColorsRef: MutableRefObject<Record<string, string | null>>;
  dayFilterRef: MutableRefObject<DayFilter>;
  hideLowFreqRef: MutableRefObject<boolean>;
  showArchivedRef: MutableRefObject<boolean>;
  /** Teardowns of mounted provider overlays, run on map unmount. */
  teardownTransit: Array<() => void>;
  /** Event-listener detachers, run on map unmount. */
  offEventListeners: Array<() => void>;
}

// Transit overlays — registered below the hover marker so the
// hover dot stays on top, and below curated/user GPX layers. Each
// provider gets its own source + layer set so toggling one
// doesn't affect the others. Layer ordering (D10): chips on top
// of stops on top of lines on top of halo — achieved here by
// adding them in that order with the same `beforeId`.
//
// Providers are mounted lazily: only those whose toggle is on at
// first paint (or toggled on later) pay the GeoJSON fetch + layer
// cost. The mount function is reused for both initial mount and
// first toggle-on, then cached in mountedTransitIds.
export function createTransitMounter(
  map: maplibregl.Map,
  {
    mountedTransitIds,
    transitVisibleRef,
    providerColorsRef,
    dayFilterRef,
    hideLowFreqRef,
    showArchivedRef,
    teardownTransit,
    offEventListeners,
  }: TransitMounterOptions,
): (providerId: string) => void {
  return (providerId: string) => {
    if (mountedTransitIds.current.has(providerId)) return;
    const provider = TRANSIT_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return;
    const teardown = setupTransitProviderOverlay(map, provider, {
      beforeId: HOVER_HALO_LAYER,
      initialVisible: transitVisibleRef.current[provider.id] ?? false,
      initialColor: providerColorsRef.current[provider.id] ?? provider.lineColor,
      initialDayFilter: dayFilterRef.current,
      initialHideLowFreq: hideLowFreqRef.current,
      initialShowArchived: showArchivedRef.current,
    });
    teardownTransit.push(teardown);
    const L = transitLayerIds(provider.id);
    const onLineClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties as unknown as TransitLineProperties;
      // Snap the popup anchor to the nearest point on the clicked line
      // so its tail meets the visible line rather than floating where
      // the fattened hit-area was clicked.
      const anchor = nearestPointOnLine(
        feature.geometry as unknown as Parameters<typeof nearestPointOnLine>[0],
        [e.lngLat.lng, e.lngLat.lat],
      );
      setTransitPopupTarget({
        kind: 'line',
        providerId: provider.id,
        props: hydrateLineProps(props),
        anchor,
      });
    };
    const onStopClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties as unknown as TransitStopProperties;
      const geom = feature.geometry as { type: 'Point'; coordinates: [number, number] };
      const anchor: [number, number] =
        geom?.type === 'Point' ? geom.coordinates : [e.lngLat.lng, e.lngLat.lat];
      setTransitPopupTarget({
        kind: 'stop',
        providerId: provider.id,
        props: hydrateStopProps(props),
        anchor,
      });
    };
    const clickableLineLayers = [L.hitLineLayer];
    const clickableStopLayers = [L.hitStopLayer, L.stopLabelLayer];
    for (const id of clickableLineLayers) map.on('click', id, onLineClick);
    for (const id of clickableStopLayers) map.on('click', id, onStopClick);
    const onEnterLine = () => (map.getCanvas().style.cursor = 'pointer');
    const onLeaveLine = () => (map.getCanvas().style.cursor = '');
    for (const id of clickableLineLayers) {
      map.on('mouseenter', id, onEnterLine);
      map.on('mouseleave', id, onLeaveLine);
    }
    for (const id of clickableStopLayers) {
      map.on('mouseenter', id, onEnterLine);
      map.on('mouseleave', id, onLeaveLine);
    }
    offEventListeners.push(() => {
      for (const id of clickableLineLayers) {
        map.off('click', id, onLineClick);
        map.off('mouseenter', id, onEnterLine);
        map.off('mouseleave', id, onLeaveLine);
      }
      for (const id of clickableStopLayers) {
        map.off('click', id, onStopClick);
        map.off('mouseenter', id, onEnterLine);
        map.off('mouseleave', id, onLeaveLine);
      }
    });
    mountedTransitIds.current.add(provider.id);
  };
}

/** Stop-popup chip click → open the corresponding line popup. Returns the detach function. */
export function attachOpenLineListener(map: maplibregl.Map): () => void {
  const onOpenLine = (e: Event) => {
    const detail = (
      e as CustomEvent<{
        providerId: string;
        routeId: string;
        anchor: [number, number];
      }>
    ).detail;
    const L = transitLayerIds(detail.providerId);
    const source = map.getSource(L.lineSource) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    // Query rendered features for the route; if not currently in
    // viewport (zoomed out), fall back to querying the source data.
    // Vector source: one feature per route_id (geometry is the dissolved
    // union of the route's shapes), so a single match carries the popup.
    const features = map.querySourceFeatures(L.lineSource, {
      sourceLayer: 'transit',
      filter: ['==', ['get', 'route_id'], detail.routeId],
    });
    const feature = features[0];
    if (!feature) return;
    setTransitPopupTarget({
      kind: 'line',
      providerId: detail.providerId,
      props: hydrateLineProps(feature.properties as unknown as TransitLineProperties),
      anchor: detail.anchor,
    });
  };
  window.addEventListener('transit:open-line', onOpenLine);
  return () => window.removeEventListener('transit:open-line', onOpenLine);
}
