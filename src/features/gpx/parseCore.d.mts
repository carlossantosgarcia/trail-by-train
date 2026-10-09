import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { TrackSummary } from './types';

export declare const ELE_SMOOTHING_WINDOW_M: number;
export declare const ELE_GAIN_THRESHOLD_M: number;

export declare function haversineMetres(
  a: [number, number] | [number, number, number],
  b: [number, number] | [number, number, number],
): number;

export declare function computeSummary(
  features: Feature<LineString, Record<string, unknown>>[],
): TrackSummary;

export interface ParsedGpx {
  name: string;
  geojson: FeatureCollection<LineString, Record<string, unknown>>;
  summary: TrackSummary;
}

export type GpxParseErrorCode = 'invalid-xml' | 'no-track-segments';

export declare class GpxParseError extends Error {
  readonly name: 'GpxParseError';
  readonly code: GpxParseErrorCode;
  readonly filename: string;
  constructor(code: GpxParseErrorCode, filename: string, message: string);
}

/**
 * Parse an already-parsed GPX Document (browser DOMParser or
 * @xmldom/xmldom DOMParser) into a name + GeoJSON + summary. Throws
 * `GpxParseError` if the document isn't a usable GPX track.
 */
export declare function parseGpxDocument(doc: unknown, filename: string): ParsedGpx;
