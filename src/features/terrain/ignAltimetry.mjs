// Elevation lookups against IGN's Géoplateforme altimetry service.
//
// The service answers from RGE ALTI — the same model the app used to ship as
// a ~360 MB archive — is keyless, CORS-open and free under Licence Ouverte
// 2.0. Querying it on demand costs a few requests per track instead of a
// half-gigabyte asset every deployment has to host.
//
// Only tracks whose GPX carried no elevation ever reach this module, so the
// app makes no altimetry request at all in the common case.

import {
  DEM_MAX_PLAUSIBLE_M,
  DEM_MIN_PLAUSIBLE_M,
  IGN_ALTI_MAX_POINTS,
  IGN_ALTI_RESOURCE,
  IGN_ALTI_URL,
} from './constants.mjs';

/** The altimetry service could not be reached or refused the request. */
export class TerrainServiceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'TerrainServiceError';
    this.cause = cause;
  }
}

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {ReadonlyArray<readonly [number, number]>} chunk
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<number[]>}
 */
async function requestChunk(chunk, fetchImpl) {
  const body = JSON.stringify({
    lon: chunk.map((p) => p[0].toFixed(6)).join('|'),
    lat: chunk.map((p) => p[1].toFixed(6)).join('|'),
    resource: IGN_ALTI_RESOURCE,
    delimiter: '|',
    zonly: 'true',
  });

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(IGN_ALTI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        const json = await res.json();
        if (!Array.isArray(json?.elevations) || json.elevations.length !== chunk.length) {
          throw new TerrainServiceError('The altimetry service returned a malformed response.');
        }
        return json.elevations;
      }
      lastError = new TerrainServiceError(`The altimetry service answered HTTP ${res.status}.`);
      if (!RETRY_STATUSES.has(res.status)) break;
    } catch (err) {
      lastError =
        err instanceof TerrainServiceError
          ? err
          : new TerrainServiceError('The altimetry service could not be reached.', err);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
  }
  throw lastError;
}

/**
 * Sample elevations for a list of [lon, lat] points.
 *
 * Points outside RGE ALTI coverage (sea, beyond the border) come back as the
 * service's -99999 sentinel; those — and any value outside the plausible
 * range, which also catches interpolation artefacts at coverage edges — are
 * returned as null so callers propagate missing coverage instead of drawing
 * a phantom cliff.
 *
 * Chunks are requested one at a time: the service rate-limits per client,
 * and a track rarely needs more than two or three chunks.
 *
 * @param {ReadonlyArray<readonly [number, number]>} points
 * @param {{ fetch?: typeof fetch }} [opts]
 * @returns {Promise<(number | null)[]>} metres, or null where unavailable
 * @throws {TerrainServiceError} when the service is unavailable.
 */
export async function sampleElevations(points, opts) {
  const fetchImpl = opts?.fetch ?? globalThis.fetch.bind(globalThis);
  /** @type {(number | null)[]} */
  const out = [];
  for (let i = 0; i < points.length; i += IGN_ALTI_MAX_POINTS) {
    const z = await requestChunk(points.slice(i, i + IGN_ALTI_MAX_POINTS), fetchImpl);
    for (const v of z) {
      out.push(
        typeof v === 'number' && v >= DEM_MIN_PLAUSIBLE_M && v <= DEM_MAX_PLAUSIBLE_M ? v : null,
      );
    }
  }
  return out;
}
