// Pure geometry helpers for Explore mode. No dependency on MapLibre or React
// so they stay trivially testable and reusable. All coordinates are
// [lon, lat] pairs (GeoJSON order).

export type LonLat = [number, number];

/**
 * Ray-casting point-in-polygon test. `ring` is an ordered list of [lon, lat]
 * vertices; it need not repeat the first point at the end. Points exactly on
 * an edge are reported inconsistently (as is inherent to the algorithm) — good
 * enough for a hand-drawn search region.
 */
export function pointInPolygon(pt: LonLat, ring: readonly LonLat[]): boolean {
  const x = pt[0];
  const y = pt[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function perpendicularDistance(p: LonLat, a: LonLat, b: LonLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return Math.hypot(ex, ey);
  }
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(p[0] - x, p[1] - y);
}

/**
 * Douglas–Peucker simplification. `epsilon` is a tolerance in degrees. Keeps
 * the first and last points; drops vertices closer than `epsilon` to the
 * retained polyline. Used to thin a raw touch stroke (often hundreds of
 * points) into a handful of vertices before it becomes a search polygon.
 */
export function simplify(points: readonly LonLat[], epsilon: number): LonLat[] {
  if (points.length < 3) return points.map((p) => [p[0], p[1]] as LonLat);
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= epsilon) {
    return [
      [points[0][0], points[0][1]],
      [points[end][0], points[end][1]],
    ];
  }
  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  // Drop the duplicated join vertex.
  return left.slice(0, -1).concat(right);
}

/** Axis-aligned bounding box [minLon, minLat, maxLon, maxLat]. */
export function bbox(points: readonly LonLat[]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Approximate planar area of a ring in square metres, using an
 * equirectangular projection at the ring's mean latitude. Accurate enough at
 * the scale of a hand-drawn region to distinguish a real area from an
 * accidental scribble.
 */
export function areaMeters2(ring: readonly LonLat[]): number {
  if (ring.length < 3) return 0;
  let latSum = 0;
  for (const [, lat] of ring) latSum += lat;
  const latMean = latSum / ring.length;
  const kx = 111320 * Math.cos((latMean * Math.PI) / 180);
  const ky = 110540;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] * kx;
    const yi = ring[i][1] * ky;
    const xj = ring[j][0] * kx;
    const yj = ring[j][1] * ky;
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2;
}

/** Minimum area (m²) below which a drawn region is treated as an accidental
 * scribble rather than a real search area (~120 m × 120 m). */
export const MIN_REGION_AREA_M2 = 15000;

/** Simplification tolerance in degrees (~25 m at French latitudes). */
export const SIMPLIFY_EPSILON_DEG = 0.00025;

/** True when a ring is too small or has too few vertices to be usable. */
export function isDegenerateRing(ring: readonly LonLat[]): boolean {
  return ring.length < 3 || areaMeters2(ring) < MIN_REGION_AREA_M2;
}

/** Vertices in a generated circle. 64 is smooth at any zoom the app reaches
 * and keeps the ring cheap for the point-in-polygon scan over ~38k stops. */
const CIRCLE_SEGMENTS = 64;

/**
 * Ring approximating a circle of `radiusKm` around `center`.
 *
 * Equirectangular, matching `areaMeters2`: longitude degrees are scaled by
 * cos(lat) so the shape is a circle on the ground rather than in degree space.
 * Over the tens of kilometres this is used for, the error against a true
 * geodesic circle is well under the precision a "how far am I willing to
 * travel" slider implies.
 *
 * Wound counter-clockwise and not closed — `pointInPolygon` treats the ring as
 * implicitly closed, and `setRegionPreview` appends the closing vertex itself.
 */
export function circleRing(center: LonLat, radiusKm: number): LonLat[] {
  const [lon, lat] = center;
  const dLat = radiusKm / 110.54;
  const cos = Math.cos((lat * Math.PI) / 180);
  // Guard the poles; irrelevant for France but keeps the function total.
  const dLon = radiusKm / (111.32 * Math.max(cos, 1e-6));
  const ring: LonLat[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const theta = (i / CIRCLE_SEGMENTS) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(theta), lat + dLat * Math.sin(theta)]);
  }
  return ring;
}
