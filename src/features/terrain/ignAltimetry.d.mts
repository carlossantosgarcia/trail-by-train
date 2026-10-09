export declare class TerrainServiceError extends Error {
  constructor(message: string, cause?: unknown);
  cause?: unknown;
}

export type SampleElevations = (
  points: ReadonlyArray<readonly [number, number]>,
) => Promise<(number | null)[]>;

export declare function sampleElevations(
  points: ReadonlyArray<readonly [number, number]>,
  opts?: { fetch?: typeof fetch },
): Promise<(number | null)[]>;
