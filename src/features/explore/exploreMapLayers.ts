// Imperative MapLibre helpers for Explore mode. Kept out of Map.tsx so the
// component only wires events; all the layer bookkeeping lives here.

import type maplibregl from 'maplibre-gl';
import {
  transitLayerIds,
  setTransitProviderDayFilter,
  setTransitProviderScope,
  ensureTransitStops,
  pillImageName,
  type DaySelection,
} from '../../transit';
import { setExploreLineColors } from '../../transit/lineColors';
import type { LonLat } from './geometry';
import type { ExploreResults, ExploreBusLine } from './data';
import { textColorFor, CONTRAST_DARK } from '../../lib/colorContrast';

/** Opacity the basemap is dimmed to so matched lines read as the foreground. */
const BASE_DIM_OPACITY = 0.35;
/** Bolder line width for matched lines while a region is active. */
const EXPLORE_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 6, 2.5, 10, 3.2, 13, 4, 16, 5.5];
/** Zoom from which Explore shows the matched lines' stops, as the map does. */
export const EXPLORE_STOPS_MINZOOM = 12;
/** Vector source-layer name of the transit line tiles (see transitOverlay). */
const TRANSIT_SOURCE_LAYER = 'transit';

/** The drawn region's colour, shared with the live stroke overlay. */
export const REGION_COLOR = '#2563eb';

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

/** MapLibre `match` expression mapping route_id -> its pill image. */
function pillImageExpr(lines: ExploreBusLine[]): unknown {
  const pairs: unknown[] = [];
  for (const l of lines) pairs.push(l.routeId, pillImageName(l.color));
  return ['match', ['to-string', ['get', 'route_id']], ...pairs, pillImageName('#888888')];
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
    paint: { 'fill-color': REGION_COLOR, 'fill-opacity': 0.12 },
  });
  map.addLayer({
    id: REGION_LINE,
    type: 'line',
    source: REGION_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': REGION_COLOR,
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
  // Hide every overlay, keeping only the base raster and the region outline.
  // Layers already hidden are left alone: each visibility change costs a
  // style update, and most layers are hidden to begin with.
  const visibility: Record<string, 'visible' | 'none'> = {};
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (isRegionLayer(layer.id) || isBaseLayer(layer.id)) continue;
    const v = map.getLayoutProperty(layer.id, 'visibility') === 'none' ? 'none' : 'visible';
    visibility[layer.id] = v;
    if (v === 'visible') map.setLayoutProperty(layer.id, 'visibility', 'none');
  }

  // Dim the basemap so the matched lines read as the foreground.
  for (const layer of layers) {
    if (isBaseLayer(layer.id) && layer.type === 'raster') {
      map.setPaintProperty(layer.id, 'raster-opacity', BASE_DIM_OPACITY);
    }
  }

  const linesByProvider = new Map(results.providers.map((p) => [p.providerId, p.lines]));

  // Cards, chips and the focused line ask for a line's colour by route, so
  // they show Explore's colours rather than the network's while it draws.
  const colors: Record<string, Record<string, string>> = {};
  for (const p of results.providers) {
    colors[p.providerId] = Object.fromEntries(p.lines.map((l) => [l.routeId, l.color]));
  }
  setExploreLineColors(colors);

  // Reveal the matched networks, scoped to the matched routes, each in its own
  // palette colour and bolder, with their stops at street zoom and the focused
  // line's at any zoom, as on the normal map.
  for (const providerId of matchedProviders) {
    const ids = results.matchedRouteIdsByProvider[providerId];
    const L = transitLayerIds(providerId);
    const lines = linesByProvider.get(providerId) ?? [];
    const colorExpr = lineColorExpr(lines);
    setTransitProviderScope(map, providerId, {
      routeIds: ids,
      colorExpr,
      width: EXPLORE_LINE_WIDTH,
    });
    for (const id of [
      L.lineLayer,
      L.hitLineLayer,
      L.highlightCasingLayer,
      L.highlightLayer,
      L.stopLayer,
      L.hitStopLayer,
      L.stopLabelLayer,
      L.focusStopLayer,
      L.focusStopLabelLayer,
      L.hitFocusStopLayer,
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
    }
    if (map.getZoom() >= EXPLORE_STOPS_MINZOOM) ensureTransitStops(map, providerId);
    // Repeated route-number labels along each line, as small coloured pills.
    const filter = ['in', ['to-string', ['get', 'route_id']], ['literal', ids]] as never;
    const numId = numbersLayerId(providerId);
    if (map.getLayer(numId)) map.removeLayer(numId);
    map.addLayer(
      {
        id: numId,
        type: 'symbol',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: 8,
        filter,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'route_short_name'], ''],
          'text-font': ['Noto Sans Bold'],
          'text-size': 10.5,
          'symbol-spacing': 200,
          'text-rotation-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
          'icon-image': pillImageExpr(lines) as never,
          'icon-text-fit': 'both',
          'icon-text-fit-padding': [1, 2, 1, 2],
          'text-allow-overlap': false,
          'text-padding': 4,
        },
        paint: {
          'text-color': textColorExpr(lines) as never,
        },
      },
      // Under the stops, so a stop stays tappable where a number sits.
      map.getLayer(L.stopLayer) ? L.stopLayer : undefined,
    );
  }

  return { visibility, touchedProviders: matchedProviders };
}

/** Undo showOnlyMatchedBusLines: restore visibility + normal transit filters. */
export function restoreFromSnapshot(
  map: maplibregl.Map,
  snapshot: ExploreSnapshot,
  dayFilter: DaySelection,
): void {
  for (const [id, vis] of Object.entries(snapshot.visibility)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  }
  // A network mounted during Explore never loaded its stops; one shown again
  // now needs them.
  for (const providerId of snapshot.touchedProviders) {
    if (snapshot.visibility[transitLayerIds(providerId).stopLayer] === 'visible') {
      ensureTransitStops(map, providerId);
    }
  }
  // Un-dim the basemap.
  for (const layer of map.getStyle().layers ?? []) {
    if (isBaseLayer(layer.id) && layer.type === 'raster') {
      map.setPaintProperty(layer.id, 'raster-opacity', 1);
    }
  }
  setExploreLineColors(null);
  for (const providerId of snapshot.touchedProviders) {
    const numId = numbersLayerId(providerId);
    if (map.getLayer(numId)) map.removeLayer(numId);
    setTransitProviderScope(map, providerId, null);
    setTransitProviderDayFilter(map, providerId, dayFilter);
  }
  clearRegion(map);
}
