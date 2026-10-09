import type { SampleElevations } from './ignAltimetry.d.mts';

export interface TerrainProfile {
  elevationsByFeature: (number | null)[][];
  ascentM: number;
  descentM: number;
  sampled: number;
  covered: number;
}

export declare function deriveTerrainProfile(
  featureCoords: ReadonlyArray<ReadonlyArray<readonly number[]>>,
  sample: SampleElevations,
): Promise<TerrainProfile>;
