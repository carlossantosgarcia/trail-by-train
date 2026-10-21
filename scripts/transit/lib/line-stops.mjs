// public/transit/<id>/line-stops.json: each line's stops in the order a bus
// calls at them, and the line's full extent. The line card lists the stops
// from it, and "Cadrer la ligne" frames the whole line in one move, where the
// tiles alone only ever hold the part of the line already on screen.
//
// Shape of the file (coordinates as integers of 1e-5°, about a metre):
//   {
//     "stops": [[stop_id, name, lon, lat], …],
//     "lines": { route_id: { "bbox": [w, s, e, n],
//                            "variants": [{ "dir": 0, "trips": 12, "stops": [stop index, …] }, …] } }
//   }
// A variant is one way the line runs: its stops in order. Variants whose stops
// all appear, in the same order, in a longer one of the same direction (short
// turns, runs that skip stops) are folded into it, so what is left are the
// routes that really differ — the branches. `dir` 0 is the direction that
// ends at the line's second endpoint, so it reads from the card's first
// terminus to its second. Each direction lists its variants busiest first.
// Stop indexes point into `stops`, the merged stops of stops.geojson.

const E5 = (x) => Math.round(x * 1e5);

/** Variants kept per direction; a line with more is listed by its busiest. */
export const MAX_VARIANTS = 6;

/**
 * Record one stop_times row. One flat array per trip, sequence numbers and
 * stop ids alternating: a large feed has millions of rows, and a small array
 * per row would cost several times the memory.
 */
export function addTripStop(rowsByTrip, tripId, seq, stopId) {
  let rows = rowsByTrip.get(tripId);
  if (!rows) rowsByTrip.set(tripId, (rows = []));
  rows.push(seq, stopId);
}

/** A trip's stop ids in calling order, from what addTripStop recorded. */
export function orderedTripStops(rows) {
  if (!rows) return [];
  const pairs = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push([rows[i], rows[i + 1]]);
  return pairs.sort((a, b) => a[0] - b[0]).map((r) => r[1]);
}

/**
 * The trip the card's first direction is read from: of the longest trip each
 * way, the one ending at the line's second endpoint. `longestByDir` maps a
 * direction to its longest trip, in the order build.mjs took the endpoints
 * from it.
 */
export function firstDirection(longestByDir) {
  const keys = [...longestByDir.keys()].slice(0, 2);
  return keys.length === 2 ? keys[1] : keys[0];
}

/**
 * The distinct stop patterns of a line's trips, with how many trips run each.
 * @returns {Array<{ dir: 0 | 1, trips: number, stops: string[] }>} raw stop ids
 */
export function routePatterns(trips, rowsByTrip, firstDir) {
  const byKey = new Map();
  for (const trip of trips) {
    const stops = orderedTripStops(rowsByTrip.get(trip.trip_id));
    if (stops.length < 2) continue;
    const dir = (trip.direction_id ?? '0') === firstDir ? 0 : 1;
    const key = `${dir}\u0001${stops.join('\u0001')}`;
    const p = byKey.get(key);
    if (p) p.trips += 1;
    else byKey.set(key, { dir, trips: 1, stops });
  }
  return [...byKey.values()];
}

/** Whether every element of `inner` appears in `outer`, in the same order. */
export function isSubsequence(inner, outer) {
  let j = 0;
  for (let i = 0; i < outer.length && j < inner.length; i += 1) {
    if (outer[i] === inner[j]) j += 1;
  }
  return j === inner.length;
}

/**
 * Fold patterns into the longer ones that contain them, per direction, and
 * keep the busiest MAX_VARIANTS of each. A folded pattern's trips count for
 * the variant that contains it.
 */
export function foldVariants(patterns) {
  const out = [];
  for (const dir of [0, 1]) {
    const kept = [];
    const sorted = patterns
      .filter((p) => p.dir === dir)
      .sort((a, b) => b.stops.length - a.stops.length || b.trips - a.trips);
    for (const p of sorted) {
      const host = kept.find((k) => isSubsequence(p.stops, k.stops));
      if (host) host.trips += p.trips;
      else kept.push({ ...p });
    }
    kept.sort((a, b) => b.trips - a.trips || b.stops.length - a.stops.length);
    out.push(...kept.slice(0, MAX_VARIANTS));
  }
  return out;
}

function bboxOf(geometry) {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const lines =
    geometry?.type === 'LineString'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiLineString'
        ? geometry.coordinates
        : [];
  for (const line of lines) {
    for (const [x, y] of line) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  }
  return Number.isFinite(w) ? [E5(w), E5(s), E5(e), E5(n)] : null;
}

/**
 * @param {object} args
 * @param {Array<{ properties: { route_id: string }, geometry: object }>} args.lineFeatures
 *   Every line written to the map, archived ones included.
 * @param {Map<string, Array<{ dir: 0 | 1, trips: number, stops: string[] }>>} args.patternsByRoute
 *   Raw stop patterns per live route (routePatterns).
 * @param {Map<string, string>} args.aliases  Raw stop id → merged stop id.
 * @param {Array<{ properties: { stop_id: string, stop_name: string }, geometry: { coordinates: [number, number] } }>} args.stopFeatures
 *   The stops written to stops.geojson.
 * @param {object | null} args.previous  The last build's line-stops.json, for archived lines.
 */
export function buildLineStops({ lineFeatures, patternsByRoute, aliases, stopFeatures, previous }) {
  const stops = [];
  const indexById = new Map();
  const featureById = new Map(stopFeatures.map((f) => [f.properties.stop_id, f]));
  const indexOf = (id) => {
    let i = indexById.get(id);
    if (i !== undefined) return i;
    const f = featureById.get(id);
    if (!f) return undefined;
    const [lon, lat] = f.geometry.coordinates;
    i = stops.length;
    stops.push([id, f.properties.stop_name, E5(lon), E5(lat)]);
    indexById.set(id, i);
    return i;
  };
  // Merged ids, without the repeat of two poles of one merged stop in a row.
  const merge = (ids) => {
    const out = [];
    for (const raw of ids) {
      const id = aliases.get(raw) ?? raw;
      if (featureById.has(id) && out[out.length - 1] !== id) out.push(id);
    }
    return out;
  };

  const lines = {};
  for (const f of lineFeatures) {
    const routeId = f.properties.route_id;
    const bbox = bboxOf(f.geometry);
    let patterns = (patternsByRoute.get(routeId) ?? []).map((p) => ({
      ...p,
      stops: merge(p.stops),
    }));
    // A line the feed no longer carries keeps the variants it had.
    if (patterns.length === 0 && previous?.lines?.[routeId]?.variants) {
      patterns = previous.lines[routeId].variants.map((v) => ({
        ...v,
        stops: merge(v.stops.map((i) => previous.stops[i]?.[0]).filter(Boolean)),
      }));
    }
    const variants = foldVariants(patterns.filter((p) => p.stops.length >= 2)).map((v) => ({
      dir: v.dir,
      trips: v.trips,
      stops: v.stops.map(indexOf),
    }));
    if (!bbox && variants.length === 0) continue;
    lines[routeId] = { bbox, variants };
  }
  return { stops, lines };
}
