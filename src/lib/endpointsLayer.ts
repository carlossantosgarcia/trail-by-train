// Shared helper for A/B start/end markers on hiking tracks. Used by both
// the user-GPX track rendering in Map.tsx and the curated-hikes overlay.
//
// Markers are rendered as a MapLibre symbol layer driven by a small Point
// FeatureCollection. The icon image is a colored circle (track colour)
// with a dark halo and a white stroke, registered once per distinct colour
// via `ensureEndpointImage`. The letter ("A", "B", or "A/B" for a loop)
// is drawn by MapLibre's text engine on top of the icon.

import type maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, MultiLineString, Point } from 'geojson';

// --- Constants ----------------------------------------------------------

/** Geographic threshold for collapsing A and B into a single A/B marker. */
export const LOOP_THRESHOLD_M = 50;

/** Minimum map zoom at which endpoint markers become visible. Below this
 *  the map is showing too much area for A/B labels to be useful. */
export const ENDPOINTS_MIN_ZOOM = 9;

/** Image size (px) for the icon bitmap; rendered at pixelRatio=2 so the
 *  CSS-px footprint is half. Keep round-marker math in one place. */
const IMAGE_SIZE_PX = 44;
const CIRCLE_RADIUS_PX = 16;
const STROKE_WIDTH_PX = 2;
const HALO_BLUR_PX = 4;

const TEXT_COLOR = '#ffffff';
const TEXT_HALO_COLOR = 'rgba(0, 0, 0, 0.55)';
const TEXT_HALO_WIDTH = 1.2;
const TEXT_FONT_SIZE = 12;
// Match the fontstack already in use elsewhere (rail stations, transit
// labels) — these are the fonts the demotiles glyph CDN actually serves.
// Bold variants would fail to load and the symbol layer would render
// blank, which would in turn mask the icon image too.
const TEXT_FONTSTACK = ['Open Sans Regular', 'Arial Unicode MS Regular'];

// --- Endpoint image registration ---------------------------------------

/** Public icon-image id for a given colour. Stable across calls so the
 *  symbol layer's `icon-image` expression can refer to it by name. */
export function endpointImageId(color: string): string {
  return `endpoint-marker-${color.toLowerCase()}`;
}

/** Build a circular icon ImageData in the requested colour. */
function buildEndpointImage(color: string): ImageData {
  if (typeof document === 'undefined') {
    throw new Error('buildEndpointImage: requires a browser document');
  }
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE_PX;
  canvas.height = IMAGE_SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('buildEndpointImage: 2d context unavailable');

  const cx = IMAGE_SIZE_PX / 2;
  const cy = IMAGE_SIZE_PX / 2;

  // Dark soft halo so the marker stays legible on white/topo basemaps.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = HALO_BLUR_PX;
  ctx.beginPath();
  ctx.arc(cx, cy, CIRCLE_RADIUS_PX, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // White stroke ring on top — sharp edge against any basemap.
  ctx.beginPath();
  ctx.arc(cx, cy, CIRCLE_RADIUS_PX, 0, Math.PI * 2);
  ctx.lineWidth = STROKE_WIDTH_PX;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  return ctx.getImageData(0, 0, IMAGE_SIZE_PX, IMAGE_SIZE_PX);
}

/** Register the endpoint icon for `color` on `map` if not already present.
 *  Safe to call repeatedly; the underlying `map.addImage` is gated by
 *  `map.hasImage`. Returns the icon-image id for use in layout expressions. */
export function ensureEndpointImage(map: maplibregl.Map, color: string): string {
  const id = endpointImageId(color);
  if (map.hasImage(id)) return id;
  try {
    const img = buildEndpointImage(color);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.addImage(id, img as any, { pixelRatio: 2 });
  } catch {
    // Best-effort; if image registration fails the symbol layer renders
    // the letter alone (no icon), still functional just less pretty.
  }
  return id;
}

// --- Endpoints GeoJSON builder ----------------------------------------

interface EndpointProps {
  letter: 'A' | 'B' | 'A/B';
  color: string;
  /** Tag used by curated source to keep line layers from rendering Points. */
  kind: 'endpoint';
  /** Optional: parent track id for diagnostics or future click handlers. */
  trackId?: string;
}

type EndpointFeature = Feature<Point, EndpointProps>;

/** Great-circle distance between two [lng, lat] points in metres. */
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** First coordinate of a (Multi)LineString, or null if the geometry is empty. */
function firstCoord(g: LineString | MultiLineString): [number, number] | null {
  if (g.type === 'LineString') {
    const c = g.coordinates[0];
    return c ? [c[0], c[1]] : null;
  }
  for (const seg of g.coordinates) {
    if (seg.length > 0) return [seg[0][0], seg[0][1]];
  }
  return null;
}

/** Last coordinate of a (Multi)LineString, or null if the geometry is empty. */
function lastCoord(g: LineString | MultiLineString): [number, number] | null {
  if (g.type === 'LineString') {
    const c = g.coordinates[g.coordinates.length - 1];
    return c ? [c[0], c[1]] : null;
  }
  for (let i = g.coordinates.length - 1; i >= 0; i--) {
    const seg = g.coordinates[i];
    if (seg.length > 0) return [seg[seg.length - 1][0], seg[seg.length - 1][1]];
  }
  return null;
}

/** Build the FeatureCollection of endpoint markers for one track geometry.
 *  Returns an empty collection for degenerate (0- or 1-point) geometries.
 *  Collapses A and B into a single "A/B" feature if the endpoints are within
 *  `LOOP_THRESHOLD_M`. */
export function buildEndpointsGeoJSON(
  geometry: LineString | MultiLineString,
  color: string,
  trackId?: string,
): FeatureCollection<Point, EndpointProps> {
  const first = firstCoord(geometry);
  const last = lastCoord(geometry);
  if (!first || !last) {
    return { type: 'FeatureCollection', features: [] };
  }
  // Treat a single-point geometry (first === last by reference equality on
  // a 1-point LineString) as degenerate too.
  if (geometry.type === 'LineString' && geometry.coordinates.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  const loop = haversineMeters(first, last) <= LOOP_THRESHOLD_M;
  const mkProps = (letter: EndpointProps['letter']): EndpointProps => ({
    letter,
    color,
    kind: 'endpoint',
    ...(trackId ? { trackId } : {}),
  });
  const mkFeature = (
    coord: [number, number],
    letter: EndpointProps['letter'],
  ): EndpointFeature => ({
    type: 'Feature',
    properties: mkProps(letter),
    geometry: { type: 'Point', coordinates: coord },
  });

  if (loop) {
    return { type: 'FeatureCollection', features: [mkFeature(first, 'A/B')] };
  }
  return {
    type: 'FeatureCollection',
    features: [mkFeature(first, 'A'), mkFeature(last, 'B')],
  };
}

// --- Shared symbol-layer style descriptors -----------------------------

/** Layout for an endpoint symbol layer. Caller supplies the `icon-image`
 *  expression (varies: constant for per-track GPX, data-driven for curated). */
export function endpointSymbolLayout(
  iconImage: maplibregl.LayerSpecification['layout'] extends infer L
    ? L extends { 'icon-image'?: infer I }
      ? I
      : never
    : never,
  visibility: 'visible' | 'none' = 'visible',
): Record<string, unknown> {
  return {
    'icon-image': iconImage,
    'icon-size': 1,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    'text-field': ['get', 'letter'],
    'text-font': TEXT_FONTSTACK,
    'text-size': TEXT_FONT_SIZE,
    'text-allow-overlap': true,
    'text-ignore-placement': true,
    'text-anchor': 'center',
    'text-justify': 'center',
    visibility,
  };
}

export function endpointSymbolPaint(): Record<string, unknown> {
  return {
    'text-color': TEXT_COLOR,
    'text-halo-color': TEXT_HALO_COLOR,
    'text-halo-width': TEXT_HALO_WIDTH,
  };
}
