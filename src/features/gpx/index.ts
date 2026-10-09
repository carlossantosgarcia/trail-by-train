export { default as GpxDropZone } from './GpxDropZone';
export { default as FilePickerButton } from './FilePickerButton';
export { default as TrackList } from './TrackList';
export { default as ElevationProfile } from './ElevationProfile';
export { default as ToastStack } from './ToastStack';

export {
  hydrate as hydrateGpx,
  onZoomToTrack,
  onToast,
  setHoveredSample,
  useGpxState,
} from './store';
export type { HoveredSample } from './store';

export type { Track, TrackSummary, TrackBbox } from './types';

export {
  BODY_MASS_KG,
  EFFORT_METRIC_DEFS,
  MIN_STEP_M,
  MINETTI_GRADIENT_CLAMP,
  computeEffort,
  computeEffortFromSummary,
} from './effort';
export type { EffortInputs, EffortMetrics, EffortSample, MetricDef, MetricId } from './effort';
