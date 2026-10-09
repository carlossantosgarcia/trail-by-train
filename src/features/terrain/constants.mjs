// Service and tuning constants for terrain-derived elevation.
//
// Plain ESM with a sibling .d.mts, matching elevationAlgorithm.mjs /
// parseCore.mjs, so the same code runs unchanged in the browser bundle and
// in Node scripts.

/**
 * Plausible elevation range for covered terrain, in metres. Values outside
 * it are treated as no coverage.
 *
 * The published no-data sentinel is -99999, but RGE ALTI also
 * emits interpolation artifacts near coverage edges that are neither
 * plausible terrain nor that sentinel — a sampled tile on the Luxembourg
 * border returned a minimum of -5922 m. Masking by sentinel alone would let
 * those through as phantom cliffs.
 */
export const DEM_MIN_PLAUSIBLE_M = -20;
export const DEM_MAX_PLAUSIBLE_M = 4900;

/**
 * Along-track spacing used to sample terrain, in metres.
 *
 * Sampling at uniform arc length rather than at the file's own vertices
 * keeps D+/D- a property of the terrain rather than of how densely the
 * producing tool emitted vertices.
 * @type {number}
 */
export const DEM_SAMPLE_INTERVAL_M = 10;

/**
 * Minimum along-track spacing between track vertices sent to the altimetry
 * service, in metres. Vertices in between are interpolated. 25 m matches the
 * ~27 m/px resolution at which RGE ALTI was measured to be as accurate for
 * this use as its native 1-5 m (finer sampling reintroduces micro-relief),
 * and keeps a 60 km track to a single request.
 * @type {number}
 */
export const DEM_VERTEX_SPACING_M = 25;

/**
 * Along-track spacing at which D+/D- is evaluated, in metres. The 10 m
 * series is decimated by this factor over DEM_SAMPLE_INTERVAL_M.
 *
 * At 50 m the resampling itself is the low-pass filter, which is why
 * DEM_WINDOW_M below is zero.
 * @type {number}
 */
export const DEM_DPLUS_INTERVAL_M = 50;

/**
 * Smoothing window for terrain-derived series, in metres. Zero: none.
 *
 * DEM elevation is not GPS elevation with less noise, it is a different
 * signal. Applying the recorded-elevation tuning (window 10 m, threshold
 * 2 m) to a 10 m DEM series scores MAPE D+ 15.9 %, D- 42 %, worst 112 % —
 * far outside the 10/10/20 budget. Of 85 configurations swept, only 9
 * passed; they cluster at an effective smoothing length of 30-50 m.
 * @type {number}
 */
export const DEM_WINDOW_M = 0;

/**
 * Hysteresis threshold for terrain-derived series, in metres.
 * With DEM_DPLUS_INTERVAL_M = 50 and DEM_WINDOW_M = 0 this scores
 * MAPE D+ 3.2 %, D- 5.7 %, worst 8.7 % against the Komoot references.
 * @type {number}
 */
export const DEM_THRESHOLD_M = 5;

/** IGN Géoplateforme altimetry endpoint (keyless, CORS-open). @type {string} */
export const IGN_ALTI_URL = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';

/** RGE ALTI resource; answers -99999 outside French territory. @type {string} */
export const IGN_ALTI_RESOURCE = 'ign_rge_alti_wld';

/** Points per request — the service rejects more than 5000. @type {number} */
export const IGN_ALTI_MAX_POINTS = 5000;
