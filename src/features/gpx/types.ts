import type { FeatureCollection, LineString } from 'geojson';

export type TrackBbox = [number, number, number, number];

export interface TrackSummary {
  /** Total distance along the track in kilometres. */
  distanceKm: number;
  /**
   * Estimated total ascent in metres. Produced by the smoothed +
   * hysteresis-thresholded estimator in `elevationAlgorithm.mjs`
   * (parameters `ELE_SMOOTHING_WINDOW_M`, `ELE_GAIN_THRESHOLD_M` in
   * `parser.ts`), calibrated to approximate Komoot's D+ values — not a
   * raw sum of point-to-point deltas.
   */
  ascentM: number;
  /** Estimated total descent in metres. Same estimator and tuning as `ascentM`. */
  descentM: number;
  /** Total number of recorded points across all segments. */
  pointCount: number;
  /** Elapsed time in seconds — only present when every point had a timestamp. */
  elapsedSeconds?: number;
  /** Whether any point had a non-zero elevation. */
  hasElevation: boolean;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: TrackBbox;
  /**
   * Where the elevation series came from.
   *
   * - `file`    — the GPX's own `<ele>` values.
   * - `terrain` — derived from the shipped RGE ALTI archive, because the
   *               file carried none. Describes the ground under the drawn
   *               line, not what a device measured while walking.
   * - `none`    — no elevation could be obtained.
   *
   * Optional so tracks persisted before this existed stay valid on read;
   * `elevationSourceOf` supplies the fallback.
   */
  elevationSource?: ElevationSource;
  /**
   * Set when terrain enrichment covered only part of the track (the route
   * leaves RGE ALTI coverage). Fraction of D+ samples that resolved, 0..1.
   */
  terrainCoverage?: number;
}

export type ElevationSource = 'file' | 'terrain' | 'none';

/**
 * Elevation source for a track, inferring it for records written before the
 * field existed: those were only ever populated from the file itself.
 */
export function elevationSourceOf(summary: TrackSummary): ElevationSource {
  return summary.elevationSource ?? (summary.hasElevation ? 'file' : 'none');
}

/** Terrain enrichment state, for tracks that have no elevation of their own. */
export type EnrichmentState =
  | { status: 'pending' }
  | { status: 'failed'; reason: 'service-unavailable' | 'error'; message: string };

/**
 * A loaded GPX track as it lives in the sidebar / store.
 * Geometry is stored separately so the list can hydrate fast.
 */
export interface Track {
  id: string;
  /** User-editable display name; initialised from the file's <name> or filename. */
  name: string;
  /** Original filename (immutable, kept for reference). */
  originalFilename: string;
  /** Hex colour for the line, e.g. "#0072B2". */
  colour: string;
  visible: boolean;
  createdAt: number;
  summary: TrackSummary;
  /**
   * True when the file's geometry came from `<rte>` routes rather than
   * `<trk>` tracks — a planned route rather than a recorded walk.
   *
   * Lives on Track, not TrackSummary, because TrackSummary is serialised
   * into the curated-hikes manifest and adding a field there would churn
   * that generated file for every hike.
   */
  fromRoute?: boolean;
}

export interface TrackGeometry {
  id: string;
  geojson: FeatureCollection<LineString, Record<string, unknown>>;
}

export type GpxLoadErrorCode = 'invalid-xml' | 'no-track-segments' | 'read-failed' | 'unknown';

export class GpxLoadError extends Error {
  override readonly name = 'GpxLoadError';
  readonly code: GpxLoadErrorCode;
  readonly filename: string;

  constructor(code: GpxLoadErrorCode, filename: string, message: string) {
    super(message);
    this.code = code;
    this.filename = filename;
  }
}

export class QuotaError extends Error {
  override readonly name = 'QuotaError';
  constructor(message = 'Browser storage is full — remove some tracks to free space.') {
    super(message);
  }
}
