import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import {
  TRANSIT_PROVIDERS,
  setTransitProviderColor,
  setTransitProviderDayFilter,
  setTransitProviderHighlight,
  setTransitProviderShowArchived,
  setTransitProviderStopFilter,
  setTransitProviderVisibility,
  transitLayerIds,
  type DayFilter,
} from '../../transit';
import {
  getTransitHighlight,
  setTransitHighlight,
  subscribeTransitHighlight,
} from '../../transit/highlightStore';
import { fitPadding } from '../../lib/chromePadding';

interface TransitLayersOptions {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  exploreActiveRef: MutableRefObject<boolean>;
  mountedTransitIds: MutableRefObject<Set<string>>;
  mountTransitProviderRef: MutableRefObject<((providerId: string) => void) | null>;
  transitVisible: Record<string, boolean>;
  dayFilter: DayFilter;
  hideLowFreq: boolean;
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
  hideLowFreq,
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

  // ---- Transit day filter + low-freq filter (lines, halos, chips, stops, labels).
  // Only applied to providers actually mounted on the map; deferred-mount
  // providers will pick up the current filters when mount runs (via
  // initialDayFilter / initialHideLowFreq read from refs).
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
        setTransitProviderDayFilter(map, provider.id, dayFilter, hideLowFreq);
        setTransitProviderStopFilter(map, provider.id, dayFilter, hideLowFreq);
      }
    };
    apply();
    const onStyledata = () => apply();
    map.on('styledata', onStyledata);
    return () => {
      map.off('styledata', onStyledata);
    };
  }, [exploreActiveRef, mapRef, mountedTransitIds, dayFilter, hideLowFreq, showArchived]);

  // ---- Per-provider color overrides.
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

  // ---- Transit route highlight.
  //
  // One store, many providers. On change we apply the highlight to the
  // owning provider and clear it on every other mounted provider (at most
  // one route highlighted at a time, network-wide). On activation we also
  // fit the map to the union bbox of the highlighted route's features.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = (highlight: ReturnType<typeof getTransitHighlight>) => {
      for (const provider of TRANSIT_PROVIDERS) {
        if (!mountedTransitIds.current.has(provider.id)) continue;
        const L = transitLayerIds(provider.id);
        if (!map.getLayer(L.lineLayer)) continue;
        const routeId =
          highlight && highlight.providerId === provider.id ? highlight.routeId : null;
        setTransitProviderHighlight(map, provider.id, routeId);
      }
      if (!highlight) return;
      const L = transitLayerIds(highlight.providerId);
      if (!map.getSource(L.lineSource)) return;
      const features = map.querySourceFeatures(L.lineSource, {
        sourceLayer: 'transit',
        filter: ['==', ['get', 'route_id'], highlight.routeId],
      });
      if (features.length === 0) return;
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
      if (!isFinite(minLng)) return;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: fitPadding(32), maxZoom: 13, duration: 600 },
      );
    };
    apply(getTransitHighlight());
    return subscribeTransitHighlight(apply);
  }, [mapRef, mountedTransitIds]);

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
