import type { ProviderConfig } from './types';
import { TRANSIT_PROVIDERS } from './providers';

export { TRANSIT_PROVIDERS };

export function getProvider(id: string): ProviderConfig | undefined {
  return TRANSIT_PROVIDERS.find((p) => p.id === id);
}

export {
  setTransitProviderVisibility,
  setTransitProviderDayFilter,
  setTransitProviderStopFilter,
  setTransitProviderColor,
  setTransitProviderHighlight,
  setTransitProviderShowArchived,
  setupTransitProviderOverlay,
  transitLayerIds,
  nearestPointOnLine,
  TRANSIT_LINE_WIDTH,
} from './transitOverlay';
export type { DayFilter } from './transitOverlay';
export type {
  ProviderConfig,
  ServiceWindow,
  TransitLineProperties,
  TransitProviderMeta,
  TransitStopProperties,
} from './types';
