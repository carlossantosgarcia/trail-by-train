// Imperative MapLibre helpers for Explore mode. Kept out of Map.tsx so the
// component only wires events; all the layer bookkeeping lives here.

import type maplibregl from 'maplibre-gl';
import {
  transitLayerIds,
  setTransitProviderDayFilter,
  setTransitProviderStopFilter,
  setTransitProviderHighlight,
  setTransitProviderColor,
  getProvider,
  TRANSIT_LINE_WIDTH,
  type DayFilter,
} from '../../transit';
import type { LonLat } from './geometry';
import type { ExploreResults, ExploreBusLine } from './data';
import { textColorFor, CONTRAST_DARK } from '../../lib/colorContrast';

/** Opacity the basemap is dimmed to so matched lines read as the foreground. */
const BASE_DIM_OPACITY = 0.35;
/** Bolder line width for matched lines while a region is active. */
const EXPLORE_LINE_WIDTH = 4;
/** Vector source-layer name of the transit line tiles (see transitOverlay). */
const TRANSIT_SOURCE_LAYER = 'transit';

const REGION_SOURCE = 'explore-region';
const REGION_FILL = 'explore-region-fill';
const REGION_LINE = 'explore-region-line';

function numbersLayerId(providerId: string): string {
  return `explore-numbers-${providerId}`;
}

/** MapLibre `match` expression mapping route_id -> its assigned palette colour. */
function lineColorExpr(lines: ExploreBusLine[]): unknown {
  const pairs: unknown[] = [];
  for (const l of lines) pairs.push(l.routeId, l.color);
  return ['match', ['to-string', ['get', 'route_id']], ...pairs, '#888888'];
}

/**
 * MapLibre `match` expression mapping route_id -> a legible route-number text
 * colour, chosen from that line's pill colour so numbers stay readable on the
 * darker palette entries. Mirrors `lineColorExpr`.
 */
function textColorExpr(lines: ExploreBusLine[]): unknown {
  const pairs: unknown[] = [];
  for (const l of lines) pairs.push(l.routeId, textColorFor(l.color));
  return ['match', ['to-string', ['get', 'route_id']], ...pairs, CONTRAST_DARK];
}

function regionFeature(points: readonly LonLat[], closed: boolean) {
  const coords = points.map((p) => [p[0], p[1]]);
  if (closed && coords.length > 0) coords.push(coords[0]);
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: closed
      ? { type: 'Polygon' as const, coordinates: [coords] }
      : { type: 'LineString' as const, coordinates: coords },
  };
}

/** Draw (or update) the in-progress stroke / closed region outline. */
export function setRegionPreview(
  map: maplibregl.Map,
  points: readonly LonLat[],
  closed: boolean,
): void {
  const data = {
    type: 'FeatureCollection' as const,
    features: points.length > 1 ? [regionFeature(points, closed)] : [],
  };
  const src = map.getSource(REGION_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (src) {
    src.setData(data as never);
    return;
  }
  map.addSource(REGION_SOURCE, { type: 'geojson', data: data as never });
  map.addLayer({
    id: REGION_FILL,
    type: 'fill',
    source: REGION_SOURCE,
    filter: ['==', ['geometry-type'], 'Polygon'] as never,
    paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.12 },
  });
  map.addLayer({
    id: REGION_LINE,
    type: 'line',
    source: REGION_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#2563eb',
      'line-width': 2.5,
      'line-dasharray': [2, 1.5],
    },
  });
}

/** Remove the region source + layers entirely. */
export function clearRegion(map: maplibregl.Map): void {
  for (const id of [REGION_FILL, REGION_LINE]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(REGION_SOURCE)) map.removeSource(REGION_SOURCE);
}

export interface ExploreSnapshot {
  visibility: Record<string, 'visible' | 'none'>;
  touchedProviders: string[];
}

function isBaseLayer(id: string): boolean {
  return id.startsWith('ign-');
}

function isRegionLayer(id: string): boolean {
  return id.startsWith('explore-region');
}

/**
 * Clear the map to only the matched bus lines. Providers with matches must
 * already be mounted (caller mounts them via `mountProvider`). Records a
 * snapshot of every layer's visibility so it can be restored on exit.
 */
export function showOnlyMatchedBusLines(
  map: maplibregl.Map,
  results: ExploreResults,
  mountProvider: (providerId: string) => void,
): ExploreSnapshot {
  const matchedProviders = Object.keys(results.matchedRouteIdsByProvider);
  for (const providerId of matchedProviders) mountProvider(providerId);

  // Snapshot AFTER mounting so newly-added provider layers are captured. Skip
  // the base layers: their visibility is owned by the activeLayerId effect
  // (which stays live so the Explore basemap switcher works), and restoring a
  // stale base visibility here would revert a basemap change made mid-Explore.
  const visibility: Record<string, 'visible' | 'none'> = {};
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (isRegionLayer(layer.id) || isBaseLayer(layer.id)) continue;
    const v = map.getLayoutProperty(layer.id, 'visibility');
    visibility[layer.id] = v === 'none' ? 'none' : 'visible';
  }

  // Hide every overlay; keep only the base raster + the region outline.
  for (const layer of layers) {
    if (isBaseLayer(layer.id) || isRegionLayer(layer.id)) continue;
    map.setLayoutProperty(layer.id, 'visibility', 'none');
  }

  // Dim the basemap so the matched lines read as the foreground.
  for (const layer of layers) {
    if (isBaseLayer(layer.id) && layer.type === 'raster') {
      map.setPaintProperty(layer.id, 'raster-opacity', BASE_DIM_OPACITY);
    }
  }

  const linesByProvider = new Map(results.providers.map((p) => [p.providerId, p.lines]));

  // Reveal the matched providers' line layers, filtered to matched routes,
  // thickened and at full opacity so they pop against the dimmed basemap. Each
  // line is drawn in its own palette colour with its number repeated along it.
  for (const providerId of matchedProviders) {
    const ids = results.matchedRouteIdsByProvider[providerId];
    const L = transitLayerIds(providerId);
    const lines = linesByProvider.get(providerId) ?? [];
    const colorExpr = lineColorExpr(lines);
    const filter = ['in', ['get', 'route_id'], ['literal', ids]] as never;
    if (map.getLayer(L.lineLayer)) {
      map.setFilter(L.lineLayer, filter);
      map.setLayoutProperty(L.lineLayer, 'visibility', 'visible');
    }
    if (map.getLayer(L.hitLineLayer)) {
      map.setFilter(L.hitLineLayer, filter);
      map.setLayoutProperty(L.hitLineLayer, 'visibility', 'visible');
    }
    // Keep highlight layers mounted+visible (they match nothing until a line
    // is tapped) and reset the base line opacity, then apply the emphasis.
    if (map.getLayer(L.highlightCasingLayer)) {
      map.setLayoutProperty(L.highlightCasingLayer, 'visibility', 'visible');
    }
    if (map.getLayer(L.highlightLayer)) {
      map.setLayoutProperty(L.highlightLayer, 'visibility', 'visible');
      // Highlight the tapped line in its own colour, not the provider colour.
      map.setPaintProperty(L.highlightLayer, 'line-color', colorExpr as never);
    }
    setTransitProviderHighlight(map, providerId, null);
    if (map.getLayer(L.lineLayer)) {
      map.setPaintProperty(L.lineLayer, 'line-color', colorExpr as never);
      map.setPaintProperty(L.lineLayer, 'line-width', EXPLORE_LINE_WIDTH);
      map.setPaintProperty(L.lineLayer, 'line-opacity', 1);
    }
    // Repeated route-number labels along each line, as small coloured pills.
    const numId = numbersLayerId(providerId);
    if (map.getLayer(numId)) map.removeLayer(numId);
    map.addLayer({
      id: numId,
      type: 'symbol',
      source: L.lineSource,
      'source-layer': TRANSIT_SOURCE_LAYER,
      minzoom: 8,
      filter,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'route_short_name'], ''],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'symbol-spacing': 160,
        'text-allow-overlap': false,
        'text-padding': 2,
      },
      paint: {
        'text-color': textColorExpr(lines) as never,
        'text-halo-color': colorExpr as never,
        'text-halo-width': 2.5,
        'text-halo-blur': 0.2,
      },
    });
  }

  return { visibility, touchedProviders: matchedProviders };
}

/** Undo showOnlyMatchedBusLines: restore visibility + normal transit filters. */
export function restoreFromSnapshot(
  map: maplibregl.Map,
  snapshot: ExploreSnapshot,
  dayFilter: DayFilter,
  hideLowFreq: boolean,
): void {
  for (const [id, vis] of Object.entries(snapshot.visibility)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  }
  // Un-dim the basemap.
  for (const layer of map.getStyle().layers ?? []) {
    if (isBaseLayer(layer.id) && layer.type === 'raster') {
      map.setPaintProperty(layer.id, 'raster-opacity', 1);
    }
  }
  for (const providerId of snapshot.touchedProviders) {
    const L = transitLayerIds(providerId);
    const numId = numbersLayerId(providerId);
    if (map.getLayer(numId)) map.removeLayer(numId);
    if (map.getLayer(L.lineLayer)) {
      map.setPaintProperty(L.lineLayer, 'line-width', TRANSIT_LINE_WIDTH);
    }
    // Reset per-line colours back to the provider's single colour.
    const providerColor = getProvider(providerId)?.lineColor;
    if (providerColor) setTransitProviderColor(map, providerId, providerColor);
    setTransitProviderHighlight(map, providerId, null);
    setTransitProviderDayFilter(map, providerId, dayFilter, hideLowFreq);
    setTransitProviderStopFilter(map, providerId, dayFilter, hideLowFreq);
  }
  clearRegion(map);
}
