// Visibility of the simple overlays. Each effect tries once and, if its layers
// don't exist yet (before `load` has added them), retries on `styledata`.
// While Explore owns the map these stand down (see `exploreActiveRef` in
// Map.tsx), reporting success so they stop retrying.

import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import { setRailNetworkVisibility } from '../railNetworkOverlay';
import { setRailStationsVisibility } from '../railStationsOverlay';
import {
  setCuratedHikesVisibility,
  setCuratedHikesVisibleIds,
  CURATED_HIT_LAYER_ID,
  type CuratedManifest,
  type FilterRange,
} from '../../features/curated-hikes';
import { setGrVisible, GR_LABEL_LAYER_ID } from '../../features/gr-trails';
import { applyWhenReady } from './applyWhenReady';

type MapRef = MutableRefObject<maplibregl.Map | null>;
type FlagRef = MutableRefObject<boolean>;

export function useRailVisibility(
  mapRef: MapRef,
  exploreActiveRef: FlagRef,
  railVisible: boolean,
): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return applyWhenReady(map, () => {
      if (exploreActiveRef.current) return true;
      const haloPresent = !!map.getLayer('rail-network-halo');
      const linePresent = !!map.getLayer('rail-network-rail-a');
      if (!haloPresent || !linePresent) return false;
      setRailNetworkVisibility(map, railVisible);
      return true;
    });
  }, [mapRef, exploreActiveRef, railVisible]);
}

export function useStationsVisibility(
  mapRef: MapRef,
  exploreActiveRef: FlagRef,
  stationsVisible: boolean,
): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return applyWhenReady(map, () => {
      if (exploreActiveRef.current) return true;
      if (!map.getLayer('rail-stations-dot')) return false;
      setRailStationsVisibility(map, stationsVisible);
      return true;
    });
  }, [mapRef, exploreActiveRef, stationsVisible]);
}

export function useCuratedVisibility(
  mapRef: MapRef,
  exploreActiveRef: FlagRef,
  curatedVisible: boolean,
): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return applyWhenReady(map, () => {
      if (exploreActiveRef.current) return true;
      if (!map.getLayer(CURATED_HIT_LAYER_ID)) return false;
      setCuratedHikesVisibility(map, curatedVisible);
      return true;
    });
  }, [mapRef, exploreActiveRef, curatedVisible]);
}

export function useGrVisibility(
  mapRef: MapRef,
  exploreActiveRef: FlagRef,
  grVisible: boolean,
): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return applyWhenReady(map, () => {
      if (exploreActiveRef.current) return true;
      if (!map.getLayer(GR_LABEL_LAYER_ID)) return false;
      setGrVisible(map, grVisible);
      return true;
    });
  }, [mapRef, exploreActiveRef, grVisible]);
}

/** Recompute the curated visible-ids from the duration filter. */
export function useCuratedFilter(
  mapRef: MapRef,
  exploreActiveRef: FlagRef,
  curatedManifest: CuratedManifest | null,
  curatedFilter: FilterRange | null,
): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !curatedManifest || !curatedFilter) return;
    const ids = curatedManifest.hikes
      .filter((h) => h.durationDays >= curatedFilter.min && h.durationDays <= curatedFilter.max)
      .map((h) => h.id);
    return applyWhenReady(map, () => {
      if (exploreActiveRef.current) return true;
      if (!map.getLayer(CURATED_HIT_LAYER_ID)) return false;
      setCuratedHikesVisibleIds(map, ids);
      return true;
    });
  }, [mapRef, exploreActiveRef, curatedFilter, curatedManifest]);
}
