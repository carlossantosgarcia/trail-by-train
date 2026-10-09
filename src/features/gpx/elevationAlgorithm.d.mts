export declare const DEFAULT_WINDOW_M: number;
export declare const DEFAULT_THRESHOLD_M: number;

export interface ElePoint {
  /** Elevation in metres, or null when missing. */
  ele: number | null;
  /** Distance to the previous point in the same segment, in metres. */
  distFromPrevM: number;
}

export interface AscentDescentOptions {
  windowM?: number;
  thresholdM?: number;
}

export declare function computeAscentDescentMeters(
  points: ReadonlyArray<ElePoint>,
  opts?: AscentDescentOptions,
): { ascentM: number; descentM: number };
