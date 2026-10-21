import type maplibregl from 'maplibre-gl';
import { daysPredicate, MAX_STOP_MASKS, NO_DAYS, type DaySelection } from './serviceDays';
import { ensurePmtilesProtocol } from '../lib/pmtilesProtocol';
import { textColorFor } from '../lib/colorContrast';
import { RECENT_DAYS, UNCERTAIN_DAYS, todayDayNumber } from './freshness';
import type { ProviderConfig } from './types';

const TRANSIT_SOURCE_LAYER = 'transit';

// Zoom thresholds. Lines show at every zoom. Stops wait for street scale: at
// regional zoom a dense network's stops hid its lines and caught the taps
// meant for them. The focused line is the exception — its stops show as soon
// as the line is worth reading, because finding where it stops is why it was
// picked.
const LINES_MINZOOM = 0;
const STOPS_MINZOOM = 12;
const FOCUS_STOPS_MINZOOM = 8;
const CHIPS_MINZOOM = 12;
const STOP_LABELS_MINZOOM = 14;
const FOCUS_STOP_LABELS_MINZOOM = 11;

// Transparent line overlay that catches clicks a few pixels off the line.
const HIT_WIDTH_PX = 12;

const LABEL_FONT = ['Noto Sans Regular'];
const CHIP_FONT = ['Noto Sans Bold'];

/** Line width by zoom: hairlines across a region, a readable stroke in town. */
export const TRANSIT_LINE_WIDTH: unknown = [
  'interpolate',
  ['linear'],
  ['zoom'],
  6,
  1.1,
  10,
  1.6,
  13,
  2.4,
  16,
  4,
];
const FOCUS_CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 6, 4.5, 10, 6, 13, 8, 16, 11];
const FOCUS_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 6, 2.5, 10, 3.2, 13, 4.5, 16, 6.5];
const STOP_RADIUS = ['interpolate', ['linear'], ['zoom'], 12, 2.2, 14, 3.2, 16, 4.6];
const STOP_STROKE = ['interpolate', ['linear'], ['zoom'], 12, 1.2, 15, 2];
const FOCUS_STOP_RADIUS = ['interpolate', ['linear'], ['zoom'], 8, 2.4, 11, 3.2, 14, 4.6, 16, 6];
const FOCUS_STOP_STROKE = ['interpolate', ['linear'], ['zoom'], 8, 1.4, 14, 2.4];
const STOP_HIT_RADIUS = ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 9, 16, 11];

function ids(providerId: string) {
  return {
    lineSource: `transit-${providerId}-lines`,
    stopSource: `transit-${providerId}-stops`,
    lineLayer: `transit-${providerId}-line`,
    archivedLineLayer: `transit-${providerId}-line-archived`,
    stopLayer: `transit-${providerId}-stop`,
    stopLabelLayer: `transit-${providerId}-stop-label`,
    focusStopLayer: `transit-${providerId}-focus-stop`,
    focusStopLabelLayer: `transit-${providerId}-focus-stop-label`,
    chipLayer: `transit-${providerId}-chip`,
    hitLineLayer: `transit-${providerId}-line-hit`,
    hitStopLayer: `transit-${providerId}-stop-hit`,
    hitFocusStopLayer: `transit-${providerId}-focus-stop-hit`,
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

export type { DaySelection };

interface SetupOptions {
  beforeId?: string;
  initialVisible?: boolean;
  initialColor?: string;
  initialDayFilter?: DaySelection;
  initialShowArchived?: boolean;
}

type Filter = maplibregl.FilterSpecification;

function composeAll(parts: (Filter | null)[]): Filter | null {
  const real = parts.filter(Boolean) as Filter[];
  if (real.length === 0) return null;
  if (real.length === 1) return real[0];
  return ['all', ...real] as unknown as Filter;
}

// MapLibre's setFilter accepts `undefined` to clear a layer's filter, but
// the TS type doesn't reflect that, so we pass `['literal', true]` as a
// no-op when the composed filter is null.
const NO_FILTER = ['literal', true] as unknown as Filter;
const MATCH_NOTHING = ['literal', false] as unknown as Filter;

const ARCHIVED_PREDICATE = [
  '==',
  ['coalesce', ['get', 'archived'], false],
  true,
] as unknown as Filter;

const NOT_ARCHIVED_PREDICATE = [
  '==',
  ['coalesce', ['get', 'archived'], false],
  false,
] as unknown as Filter;

function routeIs(routeId: string): Filter {
  return ['==', ['to-string', ['get', 'route_id']], routeId] as unknown as Filter;
}

function routeIn(routeIds: readonly string[]): Filter {
  return ['in', ['to-string', ['get', 'route_id']], ['literal', routeIds]] as unknown as Filter;
}

/**
 * A stop served by this line. The stop carries its lines as a list of objects,
 * which expressions cannot search; its JSON text can be, and the key/value pair
 * is unambiguous there.
 */
function stopServes(routeId: string): Filter {
  return [
    'in',
    `"route_id":${JSON.stringify(routeId)}`,
    ['to-string', ['get', 'serving_lines']],
  ] as unknown as Filter;
}

function stopServesAny(routeIds: readonly string[]): Filter {
  if (routeIds.length === 0) return MATCH_NOTHING;
  return ['any', ...routeIds.map(stopServes)] as unknown as Filter;
}

// Everything that decides what a network draws, so each change recomputes the
// filters and paint from one place instead of patching the layers it thinks
// it touched.
interface ProviderRenderState {
  /** The network's colour (the user's choice, or the catalog's). */
  lineColor: string;
  /** A per-route colour expression replacing it while Explore draws. */
  colorExpr: unknown | null;
  /** Explore draws its matched lines bolder. */
  width: unknown;
  visible: boolean;
  showArchived: boolean;
  dayFilter: DaySelection;
  /** Explore's matched routes: only these are drawn while set. */
  scope: string[] | null;
  /** The focused route, when it is one of this network's. */
  focusRouteId: string | null;
  /** The focused route's colour. */
  focusColor: string | null;
  /** Some route is focused, in this network or another. */
  anyFocus: boolean;
}
const providerState = new Map<string, ProviderRenderState>();

const LIVE_LINE_OPACITY = 0.95;
/** Lines that are not the focused one, when one is. */
const UNFOCUSED_LINE_OPACITY = 0.22;

// Archived lines fade with age: the longer since a feed last published the
// line, the less it should assert itself against lines that are actually
// running. `today` is passed in so the map ages the data at draw time rather
// than relying on a value baked into the tiles at build time.
function archivedOpacityExpression(today: number, dim: boolean): unknown {
  const k = dim ? 0.4 : 1;
  return [
    'case',
    ['<=', ['-', today, ['coalesce', ['get', 'last_seen_day'], 0]], RECENT_DAYS],
    0.5 * k,
    ['<=', ['-', today, ['coalesce', ['get', 'last_seen_day'], 0]], UNCERTAIN_DAYS],
    0.34 * k,
    0.22 * k,
  ];
}

function lineOpacity(s: ProviderRenderState): unknown {
  const base = s.colorExpr ? 1 : LIVE_LINE_OPACITY;
  if (!s.anyFocus) return base;
  if (!s.focusRouteId) return UNFOCUSED_LINE_OPACITY;
  return ['case', routeIs(s.focusRouteId), base, UNFOCUSED_LINE_OPACITY];
}

const PILL_PREFIX = 'transit-pill-';

/** Name of the pill image behind line numbers drawn on `color`. */
export function pillImageName(color: string): string {
  return PILL_PREFIX + color.replace('#', '').toLowerCase();
}

const pillMaps = new WeakSet<maplibregl.Map>();

/**
 * The pill behind line numbers: a rounded rectangle in the line's colour,
 * stretched around the text. Drawn on demand, one per colour, when a layer
 * first asks for it. (One SDF image tinted per layer would be leaner, but
 * MapLibre blurs an SDF icon stretched by icon-text-fit into a large square.)
 */
function ensurePillImages(map: maplibregl.Map): void {
  if (pillMaps.has(map)) return;
  pillMaps.add(map);
  map.on('styleimagemissing', (e: { id: string }) => {
    if (!e.id.startsWith(PILL_PREFIX) || map.hasImage(e.id)) return;
    const color = `#${e.id.slice(PILL_PREFIX.length)}`;
    const ratio = 2;
    const r = 8;
    const w = 2 * r + 8;
    const h = 2 * r + 4;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.beginPath();
    g.roundRect(1, 1, w - 2, h - 2, r - 1);
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(15, 23, 42, 0.28)';
    g.stroke();
    map.addImage(e.id, g.getImageData(0, 0, w, h), {
      pixelRatio: ratio,
      stretchX: [[r, w - r]],
      stretchY: [[r, h - r]],
      content: [r - 2, 3, w - r + 2, h - 3],
    });
  });
}

export function setupTransitProviderOverlay(
  map: maplibregl.Map,
  provider: ProviderConfig,
  options: SetupOptions = {},
): () => void {
  const L = ids(provider.id);
  const visibility = options.initialVisible === false ? 'none' : 'visible';
  const lineColor = options.initialColor ?? provider.lineColor;
  const beforeId =
    options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;

  ensurePmtilesProtocol();
  ensurePillImages(map);
  if (!map.getSource(L.lineSource)) {
    map.addSource(L.lineSource, {
      type: 'vector',
      url: `pmtiles://${provider.linesPmtilesUrl}`,
      attribution: provider.attribution,
    });
  }
  // Stops are fetched only once they are first needed. Explore mounts a
  // network just to draw its matched lines, and loading a national network's
  // stops.geojson there cost a second of main-thread work per network for
  // nothing.
  if (!map.getSource(L.stopSource)) {
    map.addSource(L.stopSource, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: provider.attribution,
    });
    stopsUrl.set(provider.id, provider.stopsGeoJsonUrl);
  }
  if (visibility === 'visible') ensureTransitStops(map, provider.id);

  const state: ProviderRenderState = {
    lineColor,
    colorExpr: null,
    width: TRANSIT_LINE_WIDTH,
    visible: visibility === 'visible',
    showArchived: options.initialShowArchived ?? true,
    dayFilter: options.initialDayFilter ?? NO_DAYS,
    scope: null,
    focusRouteId: null,
    focusColor: null,
    anyFocus: anyFocusNow,
  };
  providerState.set(provider.id, state);

  const layout = {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
    visibility: visibility as 'visible' | 'none',
  };
  const lineLayer = (
    id: string,
    paint: Record<string, unknown>,
    minzoom = LINES_MINZOOM,
  ): maplibregl.LayerSpecification =>
    ({
      id,
      type: 'line',
      source: L.lineSource,
      'source-layer': TRANSIT_SOURCE_LAYER,
      minzoom,
      filter: MATCH_NOTHING,
      layout,
      paint,
    }) as maplibregl.LayerSpecification;
  const add = (spec: maplibregl.LayerSpecification) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec, beforeId);
  };

  // Lines the feed has stopped publishing. Dashed rather than solid, because
  // `line-dasharray` is not data-driven — the dash has to come from its own
  // layer, which also lets the whole set be toggled off in one go.
  add(
    lineLayer(L.archivedLineLayer, {
      'line-color': lineColor,
      'line-width': TRANSIT_LINE_WIDTH,
      'line-dasharray': [2, 2],
      'line-opacity': archivedOpacityExpression(todayDayNumber(), false),
    }),
  );
  // Single solid line per network. Per-route GTFS colours are confetti at
  // network density (508 lines, many with similar hues), so the network's
  // colour is the one every line, stop and card uses.
  add(
    lineLayer(L.lineLayer, {
      'line-color': lineColor,
      'line-width': TRANSIT_LINE_WIDTH,
      'line-opacity': LIVE_LINE_OPACITY,
    }),
  );
  // The focused line, above its network: a white casing for contrast against
  // any basemap, then the line itself, bolder.
  add(
    lineLayer(L.highlightCasingLayer, {
      'line-color': '#ffffff',
      'line-width': FOCUS_CASING_WIDTH,
      'line-opacity': 0.95,
    }),
  );
  add(
    lineLayer(L.highlightLayer, {
      'line-color': lineColor,
      'line-width': FOCUS_LINE_WIDTH,
      'line-opacity': 1,
    }),
  );

  // Stops: white dots ringed in the line's colour, the way transit maps draw
  // them, so they read as stations on the line rather than as more line.
  add({
    id: L.stopLayer,
    type: 'circle',
    source: L.stopSource,
    minzoom: STOPS_MINZOOM,
    filter: MATCH_NOTHING,
    layout: { visibility },
    paint: {
      'circle-radius': STOP_RADIUS as never,
      'circle-color': '#ffffff',
      'circle-stroke-color': lineColor,
      'circle-stroke-width': STOP_STROKE as never,
    },
  });
  add({
    id: L.focusStopLayer,
    type: 'circle',
    source: L.stopSource,
    minzoom: FOCUS_STOPS_MINZOOM,
    filter: MATCH_NOTHING,
    layout: { visibility },
    paint: {
      'circle-radius': FOCUS_STOP_RADIUS as never,
      'circle-color': '#ffffff',
      'circle-stroke-color': lineColor,
      'circle-stroke-width': FOCUS_STOP_STROKE as never,
    },
  });

  // Line numbers, on a pill of the line's colour that stays upright.
  add({
    id: L.chipLayer,
    type: 'symbol',
    source: L.lineSource,
    'source-layer': TRANSIT_SOURCE_LAYER,
    minzoom: CHIPS_MINZOOM,
    filter: MATCH_NOTHING,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 320,
      'text-field': ['get', 'route_short_name'],
      'text-font': CHIP_FONT,
      'text-size': 10.5,
      'text-rotation-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'icon-image': pillImageName(lineColor),
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [1, 2, 1, 2],
      'text-padding': 6,
      'text-allow-overlap': false,
      visibility,
    },
    paint: {
      'text-color': textColorFor(lineColor),
    },
  });

  const label = (id: string, minzoom: number): maplibregl.LayerSpecification => ({
    id,
    type: 'symbol',
    source: L.stopSource,
    minzoom,
    filter: MATCH_NOTHING,
    layout: {
      'text-field': ['get', 'stop_name'],
      'text-font': LABEL_FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 12] as never,
      'text-anchor': 'left',
      'text-offset': [0.7, 0],
      'text-max-width': 9,
      'text-optional': true,
      visibility,
    },
    paint: {
      'text-color': '#0f172a',
      'text-halo-color': 'rgba(255,255,255,0.92)',
      'text-halo-width': 1.4,
    },
  });
  add(label(L.stopLabelLayer, STOP_LABELS_MINZOOM));
  add(label(L.focusStopLabelLayer, FOCUS_STOP_LABELS_MINZOOM));

  // Hit areas — invisible, wider geometry above the visible layers so a tap
  // within a few pixels lands. The map's one transit click handler queries
  // these, stops first.
  add(
    lineLayer(L.hitLineLayer, {
      'line-color': '#000000',
      'line-width': HIT_WIDTH_PX,
      'line-opacity': 0,
    }),
  );
  const hitStop = (id: string, minzoom: number): maplibregl.LayerSpecification => ({
    id,
    type: 'circle',
    source: L.stopSource,
    minzoom,
    filter: MATCH_NOTHING,
    layout: { visibility },
    paint: {
      'circle-radius': STOP_HIT_RADIUS as never,
      'circle-color': '#000000',
      'circle-opacity': 0,
    },
  });
  add(hitStop(L.hitStopLayer, STOPS_MINZOOM));
  add(hitStop(L.hitFocusStopLayer, FOCUS_STOPS_MINZOOM));

  applyState(map, provider.id);

  return () => {
    for (const id of ALL_LAYERS(L)) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(L.lineSource)) map.removeSource(L.lineSource);
    if (map.getSource(L.stopSource)) map.removeSource(L.stopSource);
    providerState.delete(provider.id);
  };
}

function ALL_LAYERS(L: ReturnType<typeof ids>): string[] {
  return [
    L.hitFocusStopLayer,
    L.hitStopLayer,
    L.hitLineLayer,
    L.focusStopLabelLayer,
    L.stopLabelLayer,
    L.chipLayer,
    L.focusStopLayer,
    L.stopLayer,
    L.highlightLayer,
    L.highlightCasingLayer,
    L.lineLayer,
    L.archivedLineLayer,
  ];
}

/** Layers a tap on a stop is looked up in, focused line's stops first. */
export function transitStopHitLayers(providerId: string): string[] {
  const L = ids(providerId);
  return [L.hitFocusStopLayer, L.hitStopLayer];
}

/** Recompute a network's filters and paint from its state. */
function applyState(map: maplibregl.Map, providerId: string): void {
  const s = providerState.get(providerId);
  if (!s) return;
  const L = ids(providerId);
  const has = (id: string) => !!map.getLayer(id);
  const setFilter = (id: string, f: Filter | null) => {
    if (has(id)) map.setFilter(id, f ?? NO_FILTER);
  };
  const setPaint = (id: string, prop: string, value: unknown) => {
    if (has(id)) map.setPaintProperty(id, prop, value as never);
  };

  const days = daysPredicate(s.dayFilter, 1);
  const scope = s.scope ? routeIn(s.scope) : null;
  const focus = s.focusRouteId ? routeIs(s.focusRouteId) : null;
  const shownLines = composeAll([days, s.showArchived ? null : NOT_ARCHIVED_PREDICATE, scope]);

  setFilter(L.lineLayer, composeAll([days, NOT_ARCHIVED_PREDICATE, scope]));
  setFilter(L.archivedLineLayer, composeAll([days, ARCHIVED_PREDICATE, scope]));
  setFilter(L.hitLineLayer, shownLines);
  setFilter(L.highlightCasingLayer, focus ?? MATCH_NOTHING);
  setFilter(L.highlightLayer, focus ?? MATCH_NOTHING);
  // With a line focused, only its number stays on the map.
  setFilter(
    L.chipLayer,
    s.anyFocus ? (focus ? composeAll([shownLines, focus]) : MATCH_NOTHING) : shownLines,
  );

  const stops = composeAll([
    // A stop carries one mask per distinct pattern of its lines.
    daysPredicate(s.dayFilter, MAX_STOP_MASKS),
    s.showArchived ? null : NOT_ARCHIVED_PREDICATE,
    s.scope ? stopServesAny(s.scope) : null,
  ]);
  setFilter(L.stopLayer, stops);
  setFilter(L.hitStopLayer, stops);
  // Other stops keep their dot but lose their name while a line is focused:
  // the names on the map are then the focused line's.
  setFilter(L.stopLabelLayer, s.anyFocus ? MATCH_NOTHING : stops);
  const focusStops = s.focusRouteId ? stopServes(s.focusRouteId) : MATCH_NOTHING;
  setFilter(L.focusStopLayer, focusStops);
  setFilter(L.focusStopLabelLayer, focusStops);
  setFilter(L.hitFocusStopLayer, focusStops);

  const color = (s.colorExpr ?? s.lineColor) as unknown;
  setPaint(L.lineLayer, 'line-color', color);
  setPaint(L.lineLayer, 'line-width', s.width);
  setPaint(L.lineLayer, 'line-opacity', lineOpacity(s));
  setPaint(L.archivedLineLayer, 'line-color', color);
  setPaint(
    L.archivedLineLayer,
    'line-opacity',
    archivedOpacityExpression(todayDayNumber(), s.anyFocus),
  );
  setPaint(L.highlightLayer, 'line-color', s.focusColor ?? s.lineColor);
  setPaint(L.stopLayer, 'circle-stroke-color', color === s.lineColor ? s.lineColor : '#475569');
  setPaint(L.stopLayer, 'circle-opacity', s.anyFocus ? 0.45 : 1);
  setPaint(L.stopLayer, 'circle-stroke-opacity', s.anyFocus ? 0.45 : 1);
  setPaint(L.focusStopLayer, 'circle-stroke-color', s.focusColor ?? s.lineColor);
  // Explore's own number pills (exploreMapLayers) step back like the lines.
  const numbers = `explore-numbers-${providerId}`;
  const numbersOpacity = !s.anyFocus
    ? 1
    : s.focusRouteId
      ? ['case', routeIs(s.focusRouteId), 1, 0.3]
      : 0.3;
  setPaint(numbers, 'icon-opacity', numbersOpacity);
  setPaint(numbers, 'text-opacity', numbersOpacity);
  const chipColor = s.focusColor ?? s.lineColor;
  if (has(L.chipLayer)) map.setLayoutProperty(L.chipLayer, 'icon-image', pillImageName(chipColor));
  setPaint(L.chipLayer, 'text-color', textColorFor(chipColor));
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
  for (const id of ALL_LAYERS(L)) {
    if (id === L.archivedLineLayer) continue;
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value);
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
  if (!state) return;
  state.showArchived = showArchived;
  if (map.getLayer(L.archivedLineLayer)) {
    map.setLayoutProperty(
      L.archivedLineLayer,
      'visibility',
      state.visible && showArchived ? 'visible' : 'none',
    );
  }
  applyState(map, providerId);
}

export function setTransitProviderDayFilter(
  map: maplibregl.Map,
  providerId: string,
  dayFilter: DaySelection,
): void {
  const state = providerState.get(providerId);
  if (!state) return;
  state.dayFilter = dayFilter;
  applyState(map, providerId);
}

export function setTransitProviderColor(
  map: maplibregl.Map,
  providerId: string,
  color: string,
): void {
  const state = providerState.get(providerId);
  if (!state) return;
  state.lineColor = color;
  applyState(map, providerId);
}

/**
 * Explore's view of a network: only `routeIds` drawn, each in its own colour,
 * bolder. `null` returns the network to its normal look.
 */
export function setTransitProviderScope(
  map: maplibregl.Map,
  providerId: string,
  scope: { routeIds: string[]; colorExpr: unknown; width: unknown } | null,
): void {
  const state = providerState.get(providerId);
  if (!state) return;
  state.scope = scope?.routeIds ?? null;
  state.colorExpr = scope?.colorExpr ?? null;
  state.width = scope?.width ?? TRANSIT_LINE_WIDTH;
  applyState(map, providerId);
}

let anyFocusNow = false;

/**
 * Focus a route: drawn bold over a casing with its stops and their names, while
 * every other line, in every network, steps back. `routeId` null on a network
 * that does not own the focus; `anyFocus` says whether some network does.
 */
export function setTransitProviderHighlight(
  map: maplibregl.Map,
  providerId: string,
  routeId: string | null,
  options: { anyFocus?: boolean; color?: string | null } = {},
): void {
  const state = providerState.get(providerId);
  if (!state) return;
  if (routeId) ensureTransitStops(map, providerId);
  state.focusRouteId = routeId;
  state.focusColor = routeId ? (options.color ?? null) : null;
  state.anyFocus = options.anyFocus ?? !!routeId;
  anyFocusNow = state.anyFocus;
  applyState(map, providerId);
}
