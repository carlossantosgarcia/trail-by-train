// Dissolve a route's GTFS shape variants into a single union geometry.
//
// A route that forks or branches ships in GTFS as several shapes that run
// down the same trunk before diverging. Drawing them all stacks near-identical
// polylines on the shared trunk (bloat + opacity stacking on reduced-opacity
// lines). This helper collapses those variants into the *union* of their
// paths: shared trunk kept once, genuine forks preserved as separate branches.
//
// Approach (see openspec change union-transit-route-geometry, design D2):
// greedy, tolerance-based segment coverage — no exact-coordinate dedup (GPS
// variants sample the same road at different vertices) and no topology library.
//   1. Order variants by vertex count desc, tie-broken by id (deterministic).
//   2. Seed the "kept" set with the longest variant (usually the trunk whole).
//   3. For each later variant, classify each segment as covered (its sample
//      points lie within `tol` of already-kept geometry) or novel; drop covered
//      runs, keep maximal novel runs as new branches, and index them so later
//      variants dedupe against them too.
// Distances use an equirectangular projection anchored at the route's first
// vertex — internally consistent (an affine map), fast, and accurate at the
// France-scale spans and metre-level tolerances involved here.

/** Default coverage tolerance in metres. Wide enough to absorb GPS sampling
 * jitter and lane-level offsets between variants on the same road; narrower
 * than the spacing between distinct parallel roads, so real forks survive. */
export const DISSOLVE_TOLERANCE_METERS = 12;

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON_EQUATOR = 111320;

/** Squared distance from point (px,py) to segment (ax,ay)-(bx,by), in projected
 * metres². Squared to avoid a sqrt in the hot path. */
function pointSegDistSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

/**
 * Dissolve shape variants into union geometry members.
 *
 * @param {Array<{ id: string, coords: [number, number][] }>} variants
 *        Each variant's `coords` is an array of `[lon, lat]` pairs.
 * @param {{ toleranceMeters?: number }} [opts]
 * @returns {[number, number][][]} union members, each an array of `[lon, lat]`
 *          pairs (original coordinates, unprojected). One member → caller emits
 *          a LineString; multiple → a MultiLineString.
 */
export function dissolveRouteShapes(variants, opts = {}) {
  const tol = opts.toleranceMeters ?? DISSOLVE_TOLERANCE_METERS;
  const tolSq = tol * tol;
  const cell = tol;

  const usable = variants.filter((v) => v.coords && v.coords.length >= 2);
  if (usable.length === 0) return [];

  // Deterministic order: longest first (bias union toward keeping the trunk
  // whole), ties broken by id so repeated builds are byte-identical.
  const ordered = [...usable].sort((a, b) => {
    if (b.coords.length !== a.coords.length) return b.coords.length - a.coords.length;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Equirectangular projection anchored at the first vertex of the longest
  // variant. Consistent across the whole route since it's a single affine map.
  const [lon0, lat0] = ordered[0].coords[0];
  const mPerDegLon = M_PER_DEG_LON_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const projX = (lon) => (lon - lon0) * mPerDegLon;
  const projY = (lat) => (lat - lat0) * M_PER_DEG_LAT;

  /** @type {Map<string, Array<{ax:number,ay:number,bx:number,by:number}>>} */
  const grid = new Map();
  const cellKey = (cx, cy) => `${cx},${cy}`;

  // Index a kept segment into every grid cell it passes through, sampling at
  // half-cell spacing so a query point within `tol` is always found within a
  // ±2-cell block (see coveredPoint).
  function addSegment(ax, ay, bx, by) {
    const seg = { ax, ay, bx, by };
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / (cell / 2)));
    let lastKey = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const key = cellKey(Math.floor(x / cell), Math.floor(y / cell));
      if (key === lastKey) continue;
      lastKey = key;
      let arr = grid.get(key);
      if (!arr) grid.set(key, (arr = []));
      arr.push(seg);
    }
  }

  function coveredPoint(x, y) {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const arr = grid.get(cellKey(cx + dx, cy + dy));
        if (!arr) continue;
        for (const s of arr) {
          if (pointSegDistSq(x, y, s.ax, s.ay, s.bx, s.by) <= tolSq) return true;
        }
      }
    }
    return false;
  }

  const members = [];

  // Seed with the longest variant: keep it whole and index all its segments.
  const seed = ordered[0].coords;
  members.push(seed);
  const seedP = seed.map(([lon, lat]) => [projX(lon), projY(lat)]);
  for (let i = 0; i < seedP.length - 1; i++) {
    addSegment(seedP[i][0], seedP[i][1], seedP[i + 1][0], seedP[i + 1][1]);
  }

  // Fold in the remaining variants, keeping only novel runs.
  for (let v = 1; v < ordered.length; v++) {
    const coords = ordered[v].coords;
    const p = coords.map(([lon, lat]) => [projX(lon), projY(lat)]);
    const n = coords.length;

    // A segment i (vertex i → i+1) is covered when both endpoints and its
    // midpoint all lie within tolerance of already-kept geometry.
    const covered = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      const [ax, ay] = p[i];
      const [bx, by] = p[i + 1];
      covered[i] =
        coveredPoint(ax, ay) &&
        coveredPoint(bx, by) &&
        coveredPoint((ax + bx) / 2, (ay + by) / 2);
    }

    // Split into maximal runs of novel segments; each becomes a branch member.
    let runStart = -1; // segment index where the current novel run began
    const flush = (lastVertex) => {
      if (runStart < 0) return;
      members.push(coords.slice(runStart, lastVertex + 1));
      for (let i = runStart; i < lastVertex; i++) {
        addSegment(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
      }
      runStart = -1;
    };
    for (let i = 0; i < n - 1; i++) {
      if (!covered[i]) {
        if (runStart < 0) runStart = i;
      } else {
        flush(i); // novel run ended at segment i-1 → its last vertex is i
      }
    }
    flush(n - 1); // trailing novel run ends at the final vertex
  }

  return members;
}
