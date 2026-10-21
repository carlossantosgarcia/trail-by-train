import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import {
  TRANSIT_PROVIDERS,
  setTransitProviderColor,
  setTransitProviderDayFilter,
  setTransitProviderHighlight,
  setTransitProviderShowArchived,
  setTransitProviderVisibility,
  transitLayerIds,
  type DaySelection,
} from '../../transit';
import {
  getTransitHighlight,
  setTransitHighlight,
  subscribeTransitHighlight,
} from '../../transit/highlightStore';
import { fitPadding } from '../../lib/chromePadding';
import { lineColor, setNetworkColors } from '../../transit/lineColors';
import { loadLineStops } from '../../transit/lineStops';

interface TransitLayersOptions {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  exploreActiveRef: MutableRefObject<boolean>;
  mountedTransitIds: MutableRefObject<Set<string>>;
  mountTransitProviderRef: MutableRefObject<((providerId: string) => void) | null>;
  transitVisible: Record<string, boolean>;
  dayFilter: DaySelection;
  showArchived: boolean;
  providerColors: Record<string, string | null>;
}

/** Visibility, filters, colours and route highlight for every bus provider. */
export function useTransitLayers({
  mapRef,
  exploreActiveRef,
  mountedTransitIds,
  mountTransitProviderRef,
  transitVisible,
  dayFilter,
  showArchived,
  providerColors,
}: TransitLayersOptions): void {
  // ---- Transit overlay visibility (one effect for all providers; iterates
  // the registry and applies the latest state). Mounts a provider lazily
  // the first time it becomes visible; subsequent on/off only flip
  // MapLibre visibility on the already-mounted layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = (): boolean => {
      if (exploreActiveRef.current) return true;
      const mount = mountTransitProviderRef.current;
      if (!mount) return false;
      for (const provider of TRANSIT_PROVIDERS) {
        const wantVisible = transitVisible[provider.id] ?? false;
        if (wantVisible && !mountedTransitIds.current.has(provider.id)) {
          mount(provider.id);
        }
        if (mountedTransitIds.current.has(provider.id)) {
          setTransitProviderVisibility(map, provider.id, wantVisible);
        }
      }
      return true;
    };
    if (apply()) return;
    const onStyledata = () => {
      if (apply()) map.off('styledata', onStyledata);
    };
    map.on('styledata', onStyledata);
    return () => {
      map.off('styledata', onStyledata);
    };
  }, [exploreActiveRef, mapRef, mountTransitProviderRef, mountedTransitIds, transitVisible]);

  // ---- Transit day filter (lines, halos, chips, stops, labels).
  // Only applied to providers actually mounted on the map; deferred-mount
  // providers will pick up the current filters when mount runs (via
  // initialDayFilter read from a ref).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (exploreActiveRef.current) return;
      for (const provider of TRANSIT_PROVIDERS) {
        if (!mountedTransitIds.current.has(provider.id)) continue;
        const L = transitLayerIds(provider.id);
        if (!map.getLayer(L.lineLayer)) continue;
        setTransitProviderShowArchived(map, provider.id, showArchived);
        setTransitProviderDayFilter(map, provider.id, dayFilter);
      }
    };
    apply();
    const onStyledata = () => apply();
    map.on('styledata', onStyledata);
    return () => {
      map.off('styledata', onStyledata);
    };
  }, [exploreActiveRef, mapRef, mountedTransitIds, dayFilter, showArchived]);

  // ---- Per-provider color overrides. Registered first, so cards and chips
  // ask the same place the map is painted from.
  useEffect(() => setNetworkColors(providerColors), [providerColors]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (exploreActiveRef.current) return;
      for (const provider of TRANSIT_PROVIDERS) {
        if (!mountedTransitIds.current.has(provider.id)) continue;
        const L = transitLayerIds(provider.id);
        if (!map.getLayer(L.lineLayer)) continue;
        const color = providerColors[provider.id] ?? provider.lineColor;
        setTransitProviderColor(map, provider.id, color);
      }
    };
    apply();
    const onStyledata = () => apply();
    map.on('styledata', onStyledata);
    return () => {
      map.off('styledata', onStyledata);
    };
  }, [exploreActiveRef, mapRef, mountedTransitIds, providerColors]);

  // ---- Focused route.
  //
  // One store, many networks. The owning network draws the route bold with its
  // stops; every other mounted network steps back too, so the focused line is
  // the one thing in colour. Framing the route is asked for separately
  // (`transit:fit-line`): tapping a line focuses it where it is.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = (highlight: ReturnType<typeof getTransitHighlight>) => {
      for (const provider of TRANSIT_PROVIDERS) {
        if (!mountedTransitIds.current.has(provider.id)) continue;
        const L = transitLayerIds(provider.id);
        if (!map.getLayer(L.lineLayer)) continue;
        const own = highlight && highlight.providerId === provider.id;
        setTransitProviderHighlight(map, provider.id, own ? highlight.routeId : null, {
          anyFocus: !!highlight,
          color: own ? lineColor(provider.id, highlight.routeId) : null,
        });
      }
      if (highlight?.fit) fitRoute(map, highlight.providerId, highlight.routeId);
    };
    apply(getTransitHighlight());
    return subscribeTransitHighlight(apply);
  }, [mapRef, mountedTransitIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onFit = (e: Event) => {
      const { providerId, routeId } = (e as CustomEvent<{ providerId: string; routeId: string }>)
        .detail;
      fitRoute(map, providerId, routeId);
    };
    window.addEventListener('transit:fit-line', onFit);
    return () => window.removeEventListener('transit:fit-line', onFit);
  }, [mapRef]);

  // ---- Clear highlight when its provider is toggled off.
  useEffect(() => {
    if (exploreActiveRef.current) return;
    const current = getTransitHighlight();
    if (!current) return;
    if (transitVisible[current.providerId] === false) {
      setTransitHighlight(null);
    }
  }, [exploreActiveRef, transitVisible]);
}

type Bounds = [number, number, number, number];

/** The extent of a route from the tiles loaded so far. */
function loadedBounds(map: maplibregl.Map, providerId: string, routeId: string): Bounds | null {
  const L = transitLayerIds(providerId);
  if (!map.getSource(L.lineSource)) return null;
  const features = map.querySourceFeatures(L.lineSource, {
    sourceLayer: 'transit',
    filter: ['==', ['to-string', ['get', 'route_id']], routeId],
  });
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const visit = (lng: number, lat: number) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  };
  for (const f of features) {
    const g = f.geometry as { type: string; coordinates: unknown };
    if (g.type === 'LineString') {
      for (const c of g.coordinates as [number, number][]) visit(c[0], c[1]);
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates as [number, number][][]) {
        for (const c of line) visit(c[0], c[1]);
      }
    }
  }
  return isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

function fitBounds(map: maplibregl.Map, [w, s, e, n]: Bounds): void {
  const padding = fitPadding(32);
  // The focus bar naming the line hangs below the toolbar on a phone: keep
  // the line clear of it too.
  const bar = document.querySelector('[data-map-chrome="focus"]')?.getBoundingClientRect();
  const top = map.getContainer().getBoundingClientRect().top;
  if (bar && bar.height > 0) padding.top = Math.max(padding.top, bar.bottom - top + 16);
  map.fitBounds(
    [
      [w, s],
      [e, n],
    ],
    { padding, maxZoom: 13, duration: 600 },
  );
}

const contains = (outer: Bounds, inner: Bounds) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

/**
 * Frame the whole route. Its extent comes from line-stops.json; data without
 * that file only has the tiles on screen, which hold just the part of the line
 * in view — so frame that, and frame again as each move loads more of it.
 */
function fitRoute(map: maplibregl.Map, providerId: string, routeId: string): void {
  // A frame later, so chrome that the same tap shows or hides (the card
  // closing, the focus bar appearing) is in place before it is measured.
  const ready = Promise.all([
    loadLineStops(providerId, routeId),
    new Promise((resolve) => requestAnimationFrame(resolve)),
  ]).then(([stops]) => stops);
  void ready.then((stops) => {
    if (stops?.bbox) {
      fitBounds(map, stops.bbox);
      return;
    }
    let framed: Bounds | null = null;
    let rounds = 0;
    const step = () => {
      const b = loadedBounds(map, providerId, routeId);
      if (!b || (framed && contains(framed, b))) return;
      framed = b;
      fitBounds(map, b);
      if (++rounds < 6) map.once('idle', step);
    };
    step();
  });
}
