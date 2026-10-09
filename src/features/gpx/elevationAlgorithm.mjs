// Pure elevation-gain/loss estimator shared by the browser GPX parser
// (src/features/gpx/parser.ts) and the offline benchmark
// (scripts/benchmark-elevation.mjs). Written as plain ESM JavaScript with
// JSDoc + a sibling .d.mts so it runs unchanged under Node 20+ and is
// type-checked when imported from TypeScript.
//
// The approach: distance-based moving-average smoothing followed by a
// hysteresis accumulator, with parameters chosen to approximate Komoot's
// reported D+/D− on the bundled test_data/ fixtures (see the gpx-viewer spec).

/**
 * Default smoothing window, in along-track metres. The moving average
 * averages all samples within ±windowM/2 of each point.
 *
 * Calibrated against the four Komoot fixtures under test_data/ (see
 * design.md, "Calibration findings"). Mild smoothing wins on this set
 * because their `<ele>` data is already clean; a larger window
 * systematically under-counts D+.
 * @type {number}
 */
export const DEFAULT_WINDOW_M = 10;

/**
 * Default hysteresis threshold, in metres. A run of climb (or descent)
 * is only credited once its cumulative move since the last confirmed
 * turning point exceeds this threshold.
 *
 * Calibration set: test_data/*.gpx. Result with (window=10, threshold=2):
 * MAPE(D+) ≈ 1.9 %, MAPE(D−) ≈ 1 % on the three non-DEM-limited fixtures.
 * @type {number}
 */
export const DEFAULT_THRESHOLD_M = 2;

/**
 * @typedef {Object} ElePoint
 * @property {number | null} ele      Elevation in metres, or null when missing.
 * @property {number} distFromPrevM   Distance to the previous point in the
 *                                    same segment, in metres. Use 0 at the
 *                                    start of each segment.
 */

/**
 * @typedef {Object} AscentDescentOptions
 * @property {number} [windowM]       Override the smoothing window (m).
 * @property {number} [thresholdM]    Override the hysteresis threshold (m).
 */

/**
 * Compute ascent (D+) and descent (D−) in metres for a single ordered
 * list of points. Multi-segment tracks should be processed by calling
 * this once per segment and summing the results — that avoids creating
 * phantom climb across segment gaps.
 *
 * @param {ReadonlyArray<ElePoint>} points
 * @param {AscentDescentOptions} [opts]
 * @returns {{ ascentM: number; descentM: number }}
 */
export function computeAscentDescentMeters(points, opts) {
  const windowM = opts?.windowM ?? DEFAULT_WINDOW_M;
  const thresholdM = opts?.thresholdM ?? DEFAULT_THRESHOLD_M;

  if (!Array.isArray(points) || points.length < 2) {
    return { ascentM: 0, descentM: 0 };
  }

  // Split the segment into contiguous runs that all have a finite ele
  // value. A missing/NaN ele breaks the run; the hysteresis accumulator
  // resets at each break (rather than interpolating, which would invent
  // climb across the gap).
  let ascent = 0;
  let descent = 0;

  let runEle = [];
  let runDist = []; // cumulative along-track distance, metres
  let cumDist = 0;

  const flush = () => {
    if (runEle.length >= 2) {
      const smoothed = movingAverageByDistance(runEle, runDist, windowM);
      const { up, down } = hysteresisSum(smoothed, thresholdM);
      ascent += up;
      descent += down;
    }
    runEle = [];
    runDist = [];
    cumDist = 0;
  };

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const step = Number.isFinite(p.distFromPrevM) ? Math.max(0, p.distFromPrevM) : 0;
    if (i > 0) cumDist += step;

    if (p.ele == null || !Number.isFinite(p.ele)) {
      flush();
      continue;
    }
    runEle.push(p.ele);
    runDist.push(cumDist);
  }
  flush();

  return {
    ascentM: Math.round(ascent),
    descentM: Math.round(descent),
  };
}

/**
 * Distance-based centred moving average. For each index i, returns the
 * mean of every sample j with |dist[j] - dist[i]| <= windowM / 2.
 * Implemented with two pointers — O(n) for a monotonic distance array.
 *
 * @param {ReadonlyArray<number>} ele
 * @param {ReadonlyArray<number>} dist   Monotonically non-decreasing.
 * @param {number} windowM
 * @returns {number[]}
 */
function movingAverageByDistance(ele, dist, windowM) {
  const n = ele.length;
  const out = new Array(n);
  if (n === 0) return out;
  if (windowM <= 0) {
    for (let i = 0; i < n; i++) out[i] = ele[i];
    return out;
  }
  const half = windowM / 2;

  let lo = 0;
  let hi = 0;
  let sum = 0;
  // Initialise: include index 0
  sum = ele[0];
  for (let i = 0; i < n; i++) {
    // Advance hi to the right while still inside the window
    while (hi + 1 < n && dist[hi + 1] - dist[i] <= half) {
      hi += 1;
      sum += ele[hi];
    }
    // Advance lo to the right while we've fallen out of the window
    while (lo < i && dist[i] - dist[lo] > half) {
      sum -= ele[lo];
      lo += 1;
    }
    const count = hi - lo + 1;
    out[i] = sum / count;
  }
  return out;
}

/**
 * Hysteresis accumulator. Walks the (smoothed) elevation series and
 * only credits climb/descent once the move since the last confirmed
 * turning point exceeds `threshold`. This absorbs sub-threshold noise
 * on flat sections while still crediting real climbs made of many
 * small steps.
 *
 * Algorithm sketch:
 *   - Track an "anchor" (the last confirmed turning point) and a
 *     "candidate extremum" (the running high or low since the anchor,
 *     depending on current direction).
 *   - When the series reverses by more than `threshold` from the
 *     candidate extremum, credit the move from anchor → candidate
 *     extremum to the appropriate bucket, then make the candidate
 *     extremum the new anchor.
 *   - At end of series, credit the final anchor → last-extremum move.
 *
 * @param {ReadonlyArray<number>} ele
 * @param {number} threshold
 * @returns {{ up: number; down: number }}
 */
function hysteresisSum(ele, threshold) {
  let up = 0;
  let down = 0;
  if (ele.length < 2) return { up, down };

  let anchor = ele[0];
  let extremum = ele[0];
  let direction = 0; // -1 down, +1 up, 0 unknown

  for (let i = 1; i < ele.length; i++) {
    const v = ele[i];
    if (direction === 0) {
      if (v > extremum) extremum = v;
      else if (v < extremum) {
        // also retract: the lowest seen becomes the candidate
        // until we definitively start moving up
        extremum = v;
      }
      if (v - anchor >= threshold) {
        direction = +1;
        extremum = v;
      } else if (anchor - v >= threshold) {
        direction = -1;
        extremum = v;
      }
      continue;
    }
    if (direction === +1) {
      if (v >= extremum) {
        extremum = v;
      } else if (extremum - v >= threshold) {
        // confirmed reversal: credit the up-move anchor → extremum
        up += extremum - anchor;
        anchor = extremum;
        extremum = v;
        direction = -1;
      }
    } else {
      // direction === -1
      if (v <= extremum) {
        extremum = v;
      } else if (v - extremum >= threshold) {
        down += anchor - extremum;
        anchor = extremum;
        extremum = v;
        direction = +1;
      }
    }
  }

  // End of run: credit the final move from anchor to the last extremum
  if (direction === +1) up += Math.max(0, extremum - anchor);
  else if (direction === -1) down += Math.max(0, anchor - extremum);

  return { up, down };
}
