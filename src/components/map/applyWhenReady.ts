import type maplibregl from 'maplibre-gl';

/**
 * Run `apply` now; if it reports that its layers are not there yet (very
 * early in mount, before `load` has added them), retry on each `styledata`
 * tick until it succeeds. Returns the effect cleanup.
 *
 * We do NOT gate on map.isStyleLoaded(): it can transiently report false
 * while a *source* (e.g. a PMTiles vector source) is still fetching, and
 * `load` is a one-shot event, so `map.once('load', …)` after the initial load
 * would silently never run.
 */
export function applyWhenReady(
  map: maplibregl.Map,
  apply: () => boolean,
): (() => void) | undefined {
  if (apply()) return;
  const onStyledata = () => {
    if (apply()) map.off('styledata', onStyledata);
  };
  map.on('styledata', onStyledata);
  return () => {
    map.off('styledata', onStyledata);
  };
}

/** Run `apply` now and again on every `styledata` tick. Returns the cleanup. */
export function applyOnEveryStyledata(map: maplibregl.Map, apply: () => void): () => void {
  apply();
  const onStyledata = () => apply();
  map.on('styledata', onStyledata);
  return () => {
    map.off('styledata', onStyledata);
  };
}
