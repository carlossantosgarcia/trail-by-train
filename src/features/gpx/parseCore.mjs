// Pure GPX parsing core — no browser-only globals, no TypeScript.
// Lives as .mjs alongside its .d.mts type declarations so it can be
// imported from both the browser bundle (via parser.ts) and Node
// scripts without going through any TS toolchain at runtime. Same pattern as
// elevationAlgorithm.mjs / .d.mts.

import { gpx as gpxToGeoJSON } from '@tmcw/togeojson';
import {
  computeAscentDescentMeters,
  DEFAULT_THRESHOLD_M,
  DEFAULT_WINDOW_M,
} from './elevationAlgorithm.mjs';

export const ELE_SMOOTHING_WINDOW_M = DEFAULT_WINDOW_M;
export const ELE_GAIN_THRESHOLD_M = DEFAULT_THRESHOLD_M;

export class GpxParseError extends Error {
  constructor(code, filename, message) {
    super(message);
    this.name = 'GpxParseError';
    this.code = code;
    this.filename = filename;
  }
}

function isLineStringFeature(f) {
  return f?.geometry?.type === 'LineString';
}

function haversineMetres(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371008.8;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const c = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(c));
}

export { haversineMetres };

export function computeSummary(features) {
  let distanceM = 0;
  let ascentM = 0;
  let descentM = 0;
  let pointCount = 0;
  let hasElevation = false;
  let minLon = Infinity,
    minLat = Infinity,
    maxLon = -Infinity,
    maxLat = -Infinity;

  let allHaveTimes = true;
  let firstTime = null;
  let lastTime = null;

  for (const feat of features) {
    const coords = feat.geometry.coordinates;
    pointCount += coords.length;

    const times = feat.properties?.coordinateProperties?.times;
    const featAllHaveTimes = Array.isArray(times) && times.length === coords.length;
    if (!featAllHaveTimes) allHaveTimes = false;

    const segPoints = new Array(coords.length);

    for (let i = 0; i < coords.length; i++) {
      const [lon, lat, ele] = coords[i];
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
      if (typeof ele === 'number' && ele !== 0) hasElevation = true;

      let stepM = 0;
      if (i > 0) {
        stepM = haversineMetres(coords[i - 1], coords[i]);
        distanceM += stepM;
      }
      segPoints[i] = {
        ele: typeof ele === 'number' ? ele : null,
        distFromPrevM: stepM,
      };

      if (featAllHaveTimes && times) {
        const t = Date.parse(times[i]);
        if (!Number.isNaN(t)) {
          if (firstTime === null || t < firstTime) firstTime = t;
          if (lastTime === null || t > lastTime) lastTime = t;
        }
      }
    }

    const { ascentM: segAsc, descentM: segDesc } = computeAscentDescentMeters(segPoints, {
      windowM: ELE_SMOOTHING_WINDOW_M,
      thresholdM: ELE_GAIN_THRESHOLD_M,
    });
    ascentM += segAsc;
    descentM += segDesc;
  }

  const bbox = minLon === Infinity ? [0, 0, 0, 0] : [minLon, minLat, maxLon, maxLat];

  const summary = {
    distanceKm: distanceM / 1000,
    ascentM,
    descentM,
    pointCount,
    hasElevation,
    bbox,
  };
  if (allHaveTimes && firstTime !== null && lastTime !== null && lastTime > firstTime) {
    summary.elapsedSeconds = Math.round((lastTime - firstTime) / 1000);
  }
  return summary;
}

function findMetadataName(doc) {
  // Walk <metadata><name>... — works in both browser Document and
  // @xmldom/xmldom Document without needing querySelector.
  const metas = doc.getElementsByTagName('metadata');
  for (let i = 0; i < metas.length; i++) {
    const meta = metas.item ? metas.item(i) : metas[i];
    if (!meta) continue;
    const names = meta.getElementsByTagName('name');
    for (let j = 0; j < names.length; j++) {
      const node = names.item ? names.item(j) : names[j];
      const txt = (node?.textContent ?? '').trim();
      if (txt) return txt;
    }
  }
  return null;
}

function extractName(doc, filename, featureProps) {
  const firstWithName = featureProps.find(
    (p) => typeof p?.name === 'string' && p.name.trim().length > 0,
  );
  if (firstWithName) return firstWithName.name.trim();
  const metaName = findMetadataName(doc);
  if (metaName) return metaName;
  return filename.replace(/\.gpx$/i, '');
}

/**
 * Parse an already-parsed GPX `Document` into a track name, GeoJSON
 * FeatureCollection of LineStrings, and a summary. Throws
 * `GpxParseError` with a code (`invalid-xml` or `no-track-segments`)
 * when the document isn't usable.
 */
export function parseGpxDocument(doc, filename) {
  const rootName = String(doc?.documentElement?.nodeName ?? '').toLowerCase();
  if (rootName !== 'gpx') {
    throw new GpxParseError(
      'invalid-xml',
      filename,
      `Could not read ${filename}: root element is <${doc?.documentElement?.nodeName ?? '?'}>, expected <gpx>.`,
    );
  }

  const fullCollection = gpxToGeoJSON(doc);
  // Both <trk> tracks and <rte> routes are loadable. A route is what a
  // *planned* hike looks like — the output of GDAL, BRouter, BaseCamp — and
  // rejecting it served no requirement in the gpx-viewer spec. togeojson
  // tags routes with `_gpxType: 'rte'`, which is deliberately left on the
  // feature so the UI can distinguish a planned route from a recorded track.
  const trackFeatures = fullCollection.features.filter(isLineStringFeature);

  if (trackFeatures.length === 0) {
    throw new GpxParseError(
      'no-track-segments',
      filename,
      `${filename} contains no track or route geometry — only waypoints.`,
    );
  }

  const geojson = {
    type: 'FeatureCollection',
    features: trackFeatures,
  };

  const summary = computeSummary(trackFeatures);
  const name = extractName(
    doc,
    filename,
    trackFeatures.map((f) => f.properties ?? {}),
  );
  return { name, geojson, summary };
}
