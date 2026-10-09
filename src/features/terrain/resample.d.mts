export declare function resampleByDistance(
  coords: ReadonlyArray<readonly number[]>,
  intervalM: number,
): [number, number][];

export declare function cumulativeDistances(
  coords: ReadonlyArray<readonly number[]>,
): number[];
