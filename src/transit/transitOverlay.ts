import type maplibregl from 'maplibre-gl';
import { ensurePmtilesProtocol } from '../lib/pmtilesProtocol';
import { textColorFor } from '../lib/colorContrast';
import { RECENT_DAYS, UNCERTAIN_DAYS, todayDayNumber } from './freshness';
import type { ProviderConfig } from './types';

const TRANSIT_SOURCE_LAYER = 'transit';

// Zoom thresholds — lines always visible (no minzoom gating), stops from
// regional-approach scale, chips/labels at city detail.
const LINES_MINZOOM = 0;
const STOPS_MINZOOM = 9;
const CHIPS_MINZOOM = 12;
const STOP_LABELS_MINZOOM = 12;

// Transparent overlay above visible geometry that captures clicks. 12px
// is a comfortable mouse-friendly buffer that doesn't over-grab.
const HIT_WIDTH_PX = 12;

const LABEL_FONTSTACK = ['Open Sans Regular', 'Arial Unicode MS Regular'];

/** Default per-provider line width (px). Shared so Explore mode can thicken
 * matched lines and restore this exact value afterwards. */
export const TRANSIT_LINE_WIDTH = 1.8;

function ids(providerId: string) {
  return {
    lineSource: `transit-${providerId}-lines`,
    stopSource: `transit-${providerId}-stops`,
    lineLayer: `transit-${providerId}-line`,
    archivedLineLayer: `transit-${providerId}-line-archived`,
    stopLayer: `transit-${providerId}-stop`,
    stopLabelLayer: `transit-${providerId}-stop-label`,
    chipLayer: `transit-${providerId}-chip`,
    hitLineLayer: `transit-${providerId}-line-hit`,
    hitStopLayer: `transit-${providerId}-stop-hit`,
    highlightCasingLayer: `transit-${providerId}-line-highlight-casing`,
    highlightLayer: `transit-${providerId}-line-highlight`,
  };
}

export function transitLayerIds(providerId: string) {
  return ids(providerId);
}

type LonLat = [number, number];

interface LineGeometry {
  type: 'LineString' | 'MultiLineString';
  coordinates: LonLat[] | LonLat[][];
}

// Project `p` onto the segment a→b and return the closest point + the
// squared planar distance. Geographically incorrect at large scales, but
// we only ever compare segments within a few pixels of a click, so the
// equirectangular shortcut is more than accurate enough and avoids a
// trig per segment.
function nearestOnSegment(p: LonLat, a: LonLat, b: LonLat): { point: LonLat; d2: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  const ex = p[0] - x;
  const ey = p[1] - y;
  return { point: [x, y], d2: ex * ex + ey * ey };
}

/**
 * Snap a click point onto the geometry of a clicked line feature so the
 * popup tail visually touches the line instead of hovering over the
 * fattened hit-area offset. Handles both `LineString` and `MultiLineString`.
 * Falls back to the click point if the geometry is empty or unrecognised.
 */
export function nearestPointOnLine(
  geometry: LineGeometry | { type: string; coordinates: unknown } | null | undefined,
  click: LonLat,
): LonLat {
  if (!geometry) return click;
  const lines: LonLat[][] =
    geometry.type === 'LineString'
      ? [geometry.coordinates as LonLat[]]
      : geometry.type === 'MultiLineString'
        ? (geometry.coordinates as LonLat[][])
        : [];
  let best: LonLat = click;
  let bestD2 = Infinity;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const r = nearestOnSegment(click, line[i - 1], line[i]);
      if (r.d2 < bestD2) {
        bestD2 = r.d2;
        best = r.point;
      }
    }
  }
  return bestD2 === Infinity ? click : best;
}

export type DayFilter = 'any' | 'weekday' | 'saturday' | 'sunday';

interface SetupOptions {
  beforeId?: string;
  initialVisible?: boolean;
  initialColor?: string;
  initialDayFilter?: DayFilter;
  initialHideLowFreq?: boolean;
  initialShowArchived?: boolean;
}

function dayLinePredicate(dayFilter: DayFilter): maplibregl.FilterSpecification | null {
  if (dayFilter === 'any') return null;
  const key =
    dayFilter === 'weekday'
      ? 'runs_weekday'
      : dayFilter === 'saturday'
        ? 'runs_saturday'
        : 'runs_sunday';
  // Explicit ['==', expr, true] so MapLibre parses as expression form
  // unambiguously and the predicate always returns a boolean.
  return [
    '==',
    ['coalesce', ['get', key], true],
    true,
  ] as unknown as maplibregl.FilterSpecification;
}

function lowFreqLinePredicate(hideLowFreq: boolean): maplibregl.FilterSpecification | null {
  if (!hideLowFreq) return null;
  return [
    '==',
    ['coalesce', ['get', 'is_low_freq'], false],
    false,
  ] as unknown as maplibregl.FilterSpecification;
}

function highFreqStopPredicate(hideLowFreq: boolean): maplibregl.FilterSpecification | null {
  if (!hideLowFreq) return null;
  return [
    '==',
    ['coalesce', ['get', 'has_high_freq_line'], true],
    true,
  ] as unknown as maplibregl.FilterSpecification;
}

function composeAll(
  parts: (maplibregl.FilterSpecification | null)[],
): maplibregl.FilterSpecification | null {
  const real = parts.filter(Boolean) as maplibregl.FilterSpecification[];
  if (real.length === 0) return null;
  if (real.length === 1) return real[0];
  return ['all', ...real] as unknown as maplibregl.FilterSpecification;
}

function lineFilter(
  dayFilter: DayFilter,
  hideLowFreq: boolean,
  archived?: 'live' | 'archived',
): maplibregl.FilterSpecification | null {
  return composeAll([
    dayLinePredicate(dayFilter),
    lowFreqLinePredicate(hideLowFreq),
    archived === 'archived'
      ? ARCHIVED_PREDICATE
      : archived === 'live'
        ? NOT_ARCHIVED_PREDICATE
        : null,
  ]);
}

function stopFilter(
  dayFilter: DayFilter,
  hideLowFreq: boolean,
  showArchived: boolean,
): maplibregl.FilterSpecification | null {
  return composeAll([
    dayLinePredicate(dayFilter),
    highFreqStopPredicate(hideLowFreq),
    showArchived ? null : NOT_ARCHIVED_PREDICATE,
  ]);
}

// MapLibre's setFilter accepts `undefined` to clear a layer's filter, but
// the TS type doesn't reflect that, so we pass `['literal', true]` as a
// no-op when the composed filter is null.
const NO_FILTER: maplibregl.FilterSpecification = [
  'literal',
  true,
] as unknown as maplibregl.FilterSpecification;

// Per-provider highlight state — needed because base line-opacity becomes
// route-aware when a highlight is set, and we need to know which color is
// currently active when composing the expression.
interface ProviderRenderState {
  lineColor: string;
  highlightedRouteId: string | null;
  visible: boolean;
  showArchived: boolean;
  dayFilter: DayFilter;
  hideLowFreq: boolean;
}
const providerState = new Map<string, ProviderRenderState>();

const NO_HIGHLIGHT_FILTER: maplibregl.FilterSpecification = [
  'literal',
  false,
] as unknown as maplibregl.FilterSpecification;

const LIVE_LINE_OPACITY = 0.95;

// Archived lines fade with age: the longer since a feed last published the
// line, the less it should assert itself against lines that are actually
// running. `today` is passed in so the map ages the data at draw time rather
// than relying on a value baked into the tiles at build time.
function archivedOpacityExpression(today: number): unknown {
  return [
    'case',
    ['<=', ['-', today, ['coalesce', ['get', 'last_seen_day'], 0]], RECENT_DAYS],
    0.5,
    ['<=', ['-', today, ['coalesce', ['get', 'last_seen_day'], 0]], UNCERTAIN_DAYS],
    0.34,
    0.22,
  ];
}

// Base line-opacity expression for lines still in the feed. With a highlight,
// drop non-matching route_ids to a dim wash and keep the highlighted route at
// full opacity (the highlight layer paints over it, so its exact value barely
// shows).
function baseLineOpacityExpression(highlightedRouteId: string | null): unknown {
  if (!highlightedRouteId) return LIVE_LINE_OPACITY;
  return ['case', ['==', ['get', 'route_id'], highlightedRouteId], LIVE_LINE_OPACITY, 0.18];
}

const ARCHIVED_PREDICATE: maplibregl.FilterSpecification = [
  '==',
  ['coalesce', ['get', 'archived'], false],
  true,
] as unknown as maplibregl.FilterSpecification;

const NOT_ARCHIVED_PREDICATE: maplibregl.FilterSpecification = [
  '==',
  ['coalesce', ['get', 'archived'], false],
  false,
] as unknown as maplibregl.FilterSpecification;

export function setupTransitProviderOverlay(
  map: maplibregl.Map,
  provider: ProviderConfig,
  options: SetupOptions = {},
): () => void {
  const L = ids(provider.id);
  const visibility = options.initialVisible === false ? 'none' : 'visible';
  const lineColor = options.initialColor ?? provider.lineColor;
  const stopColor = lineColor;
  const dayFilter: DayFilter = options.initialDayFilter ?? 'any';
  const hideLowFreq = options.initialHideLowFreq ?? false;
  const showArchived = options.initialShowArchived ?? true;
  const beforeId =
    options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;

  ensurePmtilesProtocol();
  if (!map.getSource(L.lineSource)) {
    map.addSource(L.lineSource, {
      type: 'vector',
      url: `pmtiles://${provider.linesPmtilesUrl}`,
      attribution: provider.attribution,
    });
  }
  // Stops are fetched only once they are first shown. Explore mounts a
  // network just to draw its matched lines, with stops hidden, and loading a
  // national network's stops.geojson there cost a second of main-thread work
  // per network for nothing.
  if (!map.getSource(L.stopSource)) {
    map.addSource(L.stopSource, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: provider.attribution,
    });
    stopsUrl.set(provider.id, provider.stopsGeoJsonUrl);
  }
  if (visibility === 'visible') ensureTransitStops(map, provider.id);

  // Track per-provider state so setTransitProviderHighlight can recompose
  // the opacity expression without re-querying the layer's paint props.
  providerState.set(provider.id, {
    lineColor,
    highlightedRouteId: null,
    visible: visibility === 'visible',
    showArchived,
    dayFilter,
    hideLowFreq,
  });

  // Single solid line per provider. Per-route GTFS colours are confetti
  // at network density (508 lines, many with similar hues) — uniform
  // per-provider colour reads better against the basemap.
  const linePaint = {
    'line-color': lineColor,
    'line-width': TRANSIT_LINE_WIDTH,
    'line-opacity': baseLineOpacityExpression(null) as unknown as number,
  };
  const baseLayout = {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
    visibility: visibility as 'visible' | 'none',
  };
  const LINE_FILTER = lineFilter(dayFilter, hideLowFreq, 'live') ?? NO_FILTER;
  const ARCHIVED_LINE_FILTER = lineFilter(dayFilter, hideLowFreq, 'archived') ?? NO_FILTER;
  const STOP_FILTER = stopFilter(dayFilter, hideLowFreq, showArchived);
  const CHIP_FILTER = lineFilter(dayFilter, hideLowFreq, showArchived ? undefined : 'live');

  if (!map.getLayer(L.lineLayer)) {
    map.addLayer(
      {
        id: L.lineLayer,
        type: 'line',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: LINES_MINZOOM,
        filter: LINE_FILTER,
        layout: baseLayout,
        paint: linePaint,
      },
      beforeId,
    );
  }

  // Lines the feed has stopped publishing. Dashed rather than solid, because
  // `line-dasharray` is not data-driven — the dash has to come from its own
  // layer, which also lets the whole set be toggled off in one go.
  if (!map.getLayer(L.archivedLineLayer)) {
    map.addLayer(
      {
        id: L.archivedLineLayer,
        type: 'line',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: LINES_MINZOOM,
        filter: ARCHIVED_LINE_FILTER,
        layout: {
          ...baseLayout,
          visibility: visibility === 'visible' && showArchived ? 'visible' : 'none',
        },
        paint: {
          'line-color': lineColor,
          'line-width': TRANSIT_LINE_WIDTH,
          'line-dasharray': [2, 2],
          'line-opacity': archivedOpacityExpression(todayDayNumber()) as unknown as number,
        },
      },
      beforeId,
    );
  }

  // Highlight layers — drawn above the base line layer so the chosen route
  // pops. Two layers: a white casing for contrast against the basemap, then
  // a thicker line in the provider colour on top. Filter starts as "match
  // nothing"; setTransitProviderHighlight flips it.
  if (!map.getLayer(L.highlightCasingLayer)) {
    map.addLayer(
      {
        id: L.highlightCasingLayer,
        type: 'line',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: LINES_MINZOOM,
        filter: NO_HIGHLIGHT_FILTER,
        layout: baseLayout,
        paint: {
          'line-color': '#ffffff',
          'line-width': 5,
          'line-opacity': 0.95,
        },
      },
      beforeId,
    );
  }
  if (!map.getLayer(L.highlightLayer)) {
    map.addLayer(
      {
        id: L.highlightLayer,
        type: 'line',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: LINES_MINZOOM,
        filter: NO_HIGHLIGHT_FILTER,
        layout: baseLayout,
        paint: {
          'line-color': lineColor,
          'line-width': 3,
          'line-opacity': 1,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(L.stopLayer)) {
    map.addLayer(
      {
        id: L.stopLayer,
        type: 'circle',
        source: L.stopSource,
        minzoom: STOPS_MINZOOM,
        ...(STOP_FILTER ? { filter: STOP_FILTER } : {}),
        layout: { visibility },
        paint: {
          'circle-radius': 3,
          'circle-color': stopColor,
          'circle-stroke-color': '#1f2937',
          'circle-stroke-width': 1,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(L.stopLabelLayer)) {
    map.addLayer(
      {
        id: L.stopLabelLayer,
        type: 'symbol',
        source: L.stopSource,
        minzoom: STOP_LABELS_MINZOOM,
        ...(STOP_FILTER ? { filter: STOP_FILTER } : {}),
        layout: {
          'text-field': ['get', 'stop_name'],
          'text-font': LABEL_FONTSTACK,
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 0.6],
          'text-optional': true,
          visibility,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
      beforeId,
    );
  }

  // Chip: line-centered symbol with the route_short_name on a coloured
  // text-halo (the "highlighter" effect — cheaper than an SDF sprite +
  // works without bundling a chip frame image).
  if (!map.getLayer(L.chipLayer)) {
    map.addLayer(
      {
        id: L.chipLayer,
        type: 'symbol',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: CHIPS_MINZOOM,
        ...(CHIP_FILTER ? { filter: CHIP_FILTER } : {}),
        layout: {
          'symbol-placement': 'line-center',
          'text-field': [
            'concat',
            ['case', ['==', ['get', 'reservation'], 'required'], '· ', ''],
            ['get', 'route_short_name'],
          ],
          'text-font': LABEL_FONTSTACK,
          'text-size': 11,
          'text-padding': 4,
          'text-allow-overlap': false,
          visibility,
        },
        paint: {
          'text-color': textColorFor(lineColor),
          'text-halo-color': lineColor,
          'text-halo-width': 3,
          'text-halo-blur': 0.2,
        },
      },
      beforeId,
    );
  }

  // Hit-area layers — invisible, wider geometry above the visible layers
  // so clicks within a few pixels register as hits. Click handlers in
  // Map.tsx target these layer ids instead of the visible siblings.
  const hitLineLayout = { ...baseLayout };
  if (!map.getLayer(L.hitLineLayer)) {
    map.addLayer(
      {
        id: L.hitLineLayer,
        type: 'line',
        source: L.lineSource,
        'source-layer': TRANSIT_SOURCE_LAYER,
        minzoom: LINES_MINZOOM,
        filter: LINE_FILTER,
        layout: hitLineLayout,
        paint: {
          'line-color': '#000000',
          'line-width': HIT_WIDTH_PX,
          'line-opacity': 0,
        },
      },
      beforeId,
    );
  }
  if (!map.getLayer(L.hitStopLayer)) {
    map.addLayer(
      {
        id: L.hitStopLayer,
        type: 'circle',
        source: L.stopSource,
        minzoom: STOPS_MINZOOM,
        ...(STOP_FILTER ? { filter: STOP_FILTER } : {}),
        layout: { visibility },
        paint: {
          'circle-radius': HIT_WIDTH_PX,
          'circle-color': '#000000',
          'circle-opacity': 0,
        },
      },
      beforeId,
    );
  }

  return () => {
    for (const id of [
      L.hitStopLayer,
      L.hitLineLayer,
      L.chipLayer,
      L.stopLabelLayer,
      L.stopLayer,
      L.highlightLayer,
      L.highlightCasingLayer,
      L.lineLayer,
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(L.lineSource)) map.removeSource(L.lineSource);
    if (map.getSource(L.stopSource)) map.removeSource(L.stopSource);
    providerState.delete(provider.id);
  };
}

/** Stops URL of each mounted provider whose stops have not been loaded yet. */
const stopsUrl = new Map<string, string>();

/** Load a provider's stops into its (initially empty) source, once. */
export function ensureTransitStops(map: maplibregl.Map, providerId: string): void {
  const url = stopsUrl.get(providerId);
  if (!url) return;
  const src = map.getSource(ids(providerId).stopSource) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData(url);
  stopsUrl.delete(providerId);
}

export function setTransitProviderVisibility(
  map: maplibregl.Map,
  providerId: string,
  visible: boolean,
): void {
  const L = ids(providerId);
  if (visible) ensureTransitStops(map, providerId);
  const value = visible ? 'visible' : 'none';
  for (const id of [
    L.lineLayer,
    L.stopLayer,
    L.stopLabelLayer,
    L.chipLayer,
    L.hitLineLayer,
    L.hitStopLayer,
    L.highlightLayer,
    L.highlightCasingLayer,
  ]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value);
    }
  }
  const state = providerState.get(providerId);
  if (state) state.visible = visible;
  // The archived layer is gated by both the provider toggle and the
  // "lignes hors horaire" toggle, so it can't just follow `value`.
  if (map.getLayer(L.archivedLineLayer)) {
    map.setLayoutProperty(
      L.archivedLineLayer,
      'visibility',
      visible && (state?.showArchived ?? true) ? 'visible' : 'none',
    );
  }
}

/**
 * Show or hide the lines the feed no longer publishes. They stay in the tiles
 * either way; this only controls whether they are drawn and clickable.
 */
export function setTransitProviderShowArchived(
  map: maplibregl.Map,
  providerId: string,
  showArchived: boolean,
): void {
  const L = ids(providerId);
  const state = providerState.get(providerId);
  if (state) state.showArchived = showArchived;
  const dayFilter = state?.dayFilter ?? 'any';
  const hideLowFreq = state?.hideLowFreq ?? false;
  if (map.getLayer(L.archivedLineLayer)) {
    map.setLayoutProperty(
      L.archivedLineLayer,
      'visibility',
      (state?.visible ?? true) && showArchived ? 'visible' : 'none',
    );
  }
  const chip = lineFilter(dayFilter, hideLowFreq, showArchived ? undefined : 'live') ?? NO_FILTER;
  if (map.getLayer(L.chipLayer)) map.setFilter(L.chipLayer, chip);
  if (map.getLayer(L.hitLineLayer)) map.setFilter(L.hitLineLayer, chip);
  const stops = stopFilter(dayFilter, hideLowFreq, showArchived) ?? NO_FILTER;
  if (map.getLayer(L.stopLayer)) map.setFilter(L.stopLayer, stops);
  if (map.getLayer(L.stopLabelLayer)) map.setFilter(L.stopLabelLayer, stops);
  if (map.getLayer(L.hitStopLayer)) map.setFilter(L.hitStopLayer, stops);
}

export function setTransitProviderDayFilter(
  map: maplibregl.Map,
  providerId: string,
  dayFilter: DayFilter,
  hideLowFreq: boolean,
): void {
  const L = ids(providerId);
  const state = providerState.get(providerId);
  if (state) {
    state.dayFilter = dayFilter;
    state.hideLowFreq = hideLowFreq;
  }
  const showArchived = state?.showArchived ?? true;
  const live = lineFilter(dayFilter, hideLowFreq, 'live') ?? NO_FILTER;
  const archived = lineFilter(dayFilter, hideLowFreq, 'archived') ?? NO_FILTER;
  const both = lineFilter(dayFilter, hideLowFreq, showArchived ? undefined : 'live') ?? NO_FILTER;
  if (map.getLayer(L.lineLayer)) map.setFilter(L.lineLayer, live);
  if (map.getLayer(L.archivedLineLayer)) map.setFilter(L.archivedLineLayer, archived);
  if (map.getLayer(L.chipLayer)) map.setFilter(L.chipLayer, both);
  if (map.getLayer(L.hitLineLayer)) map.setFilter(L.hitLineLayer, both);
}

export function setTransitProviderStopFilter(
  map: maplibregl.Map,
  providerId: string,
  dayFilter: DayFilter,
  hideLowFreq: boolean,
): void {
  const L = ids(providerId);
  const state = providerState.get(providerId);
  const f = stopFilter(dayFilter, hideLowFreq, state?.showArchived ?? true) ?? NO_FILTER;
  if (map.getLayer(L.stopLayer)) map.setFilter(L.stopLayer, f);
  if (map.getLayer(L.stopLabelLayer)) map.setFilter(L.stopLabelLayer, f);
  if (map.getLayer(L.hitStopLayer)) map.setFilter(L.hitStopLayer, f);
}

export function setTransitProviderColor(
  map: maplibregl.Map,
  providerId: string,
  color: string,
): void {
  const L = ids(providerId);
  if (map.getLayer(L.lineLayer)) map.setPaintProperty(L.lineLayer, 'line-color', color);
  if (map.getLayer(L.archivedLineLayer)) {
    map.setPaintProperty(L.archivedLineLayer, 'line-color', color);
  }
  if (map.getLayer(L.stopLayer)) map.setPaintProperty(L.stopLayer, 'circle-color', color);
  if (map.getLayer(L.chipLayer)) {
    map.setPaintProperty(L.chipLayer, 'text-halo-color', color);
    map.setPaintProperty(L.chipLayer, 'text-color', textColorFor(color));
  }
  if (map.getLayer(L.highlightLayer)) {
    map.setPaintProperty(L.highlightLayer, 'line-color', color);
  }
  const state = providerState.get(providerId);
  if (state) state.lineColor = color;
}

export function setTransitProviderHighlight(
  map: maplibregl.Map,
  providerId: string,
  routeId: string | null,
): void {
  const L = ids(providerId);
  const state = providerState.get(providerId);
  if (state) state.highlightedRouteId = routeId;
  const highlightFilter: maplibregl.FilterSpecification = routeId
    ? (['==', ['get', 'route_id'], routeId] as unknown as maplibregl.FilterSpecification)
    : NO_HIGHLIGHT_FILTER;
  if (map.getLayer(L.highlightCasingLayer)) {
    map.setFilter(L.highlightCasingLayer, highlightFilter);
  }
  if (map.getLayer(L.highlightLayer)) {
    map.setFilter(L.highlightLayer, highlightFilter);
  }
  if (map.getLayer(L.lineLayer)) {
    map.setPaintProperty(
      L.lineLayer,
      'line-opacity',
      baseLineOpacityExpression(routeId) as unknown as number,
    );
  }
}
