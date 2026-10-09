// Reject GTFS shapes whose points are not in path order.
//
// Found via the Savines–Réallon shuttle (`navettes-vai-serre-poncon`, shape
// 225): its 290 vertices are dense and all in the right valley, but they are
// published in scrambled order, so drawing them in sequence zig-zags back and
// forth across Serre-Ponçon for 1199 km between two villages 12 km apart.
//
// The discriminator is the ratio of path length to bounding-box diagonal, which
// is independent of how finely a shape is sampled — a coarse rural shape with
// five points is not penalised for being coarse, only for doubling back.
// Measured over all 17,676 shapes across every registered provider:
//
//   median 1.54 · p99 4.08 · p99.9 6.87 · highest legitimate 12.7 · shape 225: 100.9
//
// A route that runs out and back scores ~2; a loop or a shape that services
// several branches scores under 13. The threshold sits between the two
// populations with room on both sides, so it cannot fire on a real shape.
//
// We drop rather than repair. Reconstructing the order by nearest-neighbour
// gets a 34 km path with a 4.3 km jump still in it — plausible-looking and
// wrong, which is worse than absent for someone planning to reach a trailhead.
// A route left with no usable shape is dropped by the build, exactly as one
// that ships no shape at all.

// ---------------------------------------------------------------------------
// Second, independent check: is the coordinate a place at all?
//
// Found via cars-region-drome route D45 (NYONS - VALREAS - GRIGNAN -
// PIERRELATTE), which drew a line from the Drôme to the Gulf of Guinea and
// back. Its geometry carries a single [0, 0] vertex mid-path:
//
//   [4.88711, 44.36505] → [0, 0] → [4.89911, 44.39232]
//
// The ratio above cannot catch this, and no threshold would. A lone outlier at
// distance d makes the path length ≈ 2d (out and back) while the bounding-box
// diagonal becomes ≈ d, so the ratio converges on 2 however distant the outlier
// is — the five affected Drôme shapes measure 2.00–2.01 against a threshold of
// 25, i.e. indistinguishable from an ordinary out-and-back route. Lowering the
// threshold to catch them would reject thousands of legitimate shapes first.
//
// So this check is absolute rather than relative. It is deliberately coarse: it
// asks "is this a location inside the area we cover", not "is this stop on the
// right road". Besides [0, 0] — the overwhelmingly common sentinel — it also
// catches swapped lon/lat, which for French latitudes lands in the Indian Ocean.
//
// Bounds are metropolitan France + Corsica, the same box
// scripts/gr/fetch-overpass.mjs uses, so the repo carries one definition of the
// covered area. Measured against all 4,229,844 stored vertices, real data spans
// lon -1.0366 (cars-region-64) … 9.5485 (cars-haute-corse) and lat 41.3895
// (cars-haute-corse) … 48.5882 (fluo-vosges); the tightest margin is 0.39° of
// latitude at Corsica, roughly 43 km.
const SERVED_AREA = { minLon: -5.5, maxLon: 10.0, minLat: 41.0, maxLat: 51.5 };

const SCRAMBLE_RATIO = 25;
const MIN_POINTS = 10;
const MIN_DIAGONAL_KM = 0.05;

const KM_PER_DEG_LAT = 110.57;

/**
 * Whether a coordinate is a plausible location inside the served area.
 * Non-finite values are not locations either.
 *
 * @param {[number, number]} coord lon/lat
 */
export function isServedCoordinate(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const [lon, lat] = coord;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return (
    lon >= SERVED_AREA.minLon &&
    lon <= SERVED_AREA.maxLon &&
    lat >= SERVED_AREA.minLat &&
    lat <= SERVED_AREA.maxLat
  );
}

function kmBetween(a, b, cosLat) {
  const dx = (a[0] - b[0]) * KM_PER_DEG_LAT * cosLat;
  const dy = (a[1] - b[1]) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/**
 * @param {Array<[number, number]>} coords lon/lat pairs in published order
 * @returns {{ ok: boolean, ratio: number, lengthKm: number, diagonalKm: number }}
 */
export function assessShape(coords) {
  const nil = { ok: true, ratio: 0, lengthKm: 0, diagonalKm: 0 };
  if (!Array.isArray(coords) || coords.length < MIN_POINTS) return nil;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const diagonalKm = kmBetween([minLon, minLat], [maxLon, maxLat], cosLat);
  if (diagonalKm < MIN_DIAGONAL_KM) return nil;

  let lengthKm = 0;
  for (let i = 1; i < coords.length; i++) {
    lengthKm += kmBetween(coords[i - 1], coords[i], cosLat);
  }
  const ratio = lengthKm / diagonalKm;
  return { ok: ratio <= SCRAMBLE_RATIO, ratio, lengthKm, diagonalKm };
}

/** A fragment shorter than this is not a line and is discarded. */
const MIN_FRAGMENT_POINTS = 2;

/**
 * Split a shape at any point that is not a plausible location.
 *
 * We split rather than reject or bridge. Rejecting the whole shape would
 * discard demonstrably good geometry — the Drôme shapes measure 22–57 km of
 * valid path around their one bad vertex. Bridging the invalid point's
 * neighbours would invent a segment the feed never published: 3.18 km of
 * straight line across Drôme terrain, which is exactly the "believable but
 * wrong" outcome this module exists to avoid. Splitting keeps every valid
 * vertex, invents nothing, and is honest about where the feed's data was
 * missing.
 *
 * Consecutive invalid points collapse into one split, and invalid points at
 * either end trim rather than splitting.
 *
 * @param {Array<[number, number]>} coords lon/lat pairs in published order
 * @returns {{ fragments: Array<Array<[number, number]>>, invalidPoints: Array<[number, number]> }}
 */
export function splitAtImplausible(coords) {
  if (!Array.isArray(coords) || coords.length === 0) {
    return { fragments: [], invalidPoints: [] };
  }
  /** @type {Array<Array<[number, number]>>} */
  const fragments = [];
  /** @type {Array<[number, number]>} */
  const invalidPoints = [];
  /** @type {Array<[number, number]>} */
  let current = [];
  for (const coord of coords) {
    if (isServedCoordinate(coord)) {
      current.push(coord);
      continue;
    }
    invalidPoints.push(coord);
    // A run of consecutive invalid points yields one split, not one per point:
    // `current` is already empty on the second and later of the run.
    if (current.length > 0) {
      fragments.push(current);
      current = [];
    }
  }
  if (current.length > 0) fragments.push(current);
  return {
    fragments: fragments.filter((f) => f.length >= MIN_FRAGMENT_POINTS),
    invalidPoints,
  };
}

/**
 * The whole gate for one shape: split at implausible points, then apply the
 * path-order ratio to each surviving fragment, so a split cannot smuggle a
 * scrambled fragment past the check that would otherwise have caught it.
 *
 * @param {Array<[number, number]>} coords
 * @returns {{ fragments: Array<Array<[number, number]>>, invalidPoints: Array<[number, number]>, rejected: Array<{ coords: Array<[number,number]>, quality: ReturnType<typeof assessShape> }> }}
 */
export function usableFragments(coords) {
  const { fragments, invalidPoints } = splitAtImplausible(coords);
  const kept = [];
  const rejected = [];
  for (const fragment of fragments) {
    const quality = assessShape(fragment);
    if (quality.ok) kept.push(fragment);
    else rejected.push({ coords: fragment, quality });
  }
  return { fragments: kept, invalidPoints, rejected };
}

/**
 * The same treatment for an already-assembled Feature geometry. The ledger
 * keeps a line's last good geometry indefinitely, so a corrupt shape that got
 * captured before these checks existed would otherwise be preserved forever —
 * and drawn dashed, which is not an improvement over drawing it solid.
 *
 * Mirrors the build: implausible points split the geometry, points out of path
 * order discard it. The path-order rule stays all-or-nothing, as it was before
 * splitting existed — a geometry with any scrambled part is not trustworthy in
 * its other parts either.
 *
 * @param {{ type: string, coordinates: unknown } | null | undefined} geometry
 * @returns {{ geometry: { type: string, coordinates: unknown }, invalidPoints: number } | null}
 *   null when nothing usable remains, in which case the caller drops the entry.
 */
export function repairGeometry(geometry) {
  if (!geometry) return null;
  const parts =
    geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.type === 'MultiLineString'
        ? geometry.coordinates
        : [];
  if (parts.length === 0) return null;

  const fragments = [];
  let invalidPoints = 0;
  for (const part of parts) {
    const split = splitAtImplausible(part);
    invalidPoints += split.invalidPoints.length;
    fragments.push(...split.fragments);
  }
  if (fragments.length === 0) return null;
  if (!fragments.every((f) => assessShape(f).ok)) return null;

  return {
    geometry:
      fragments.length === 1
        ? { type: 'LineString', coordinates: fragments[0] }
        : { type: 'MultiLineString', coordinates: fragments },
    invalidPoints,
  };
}
