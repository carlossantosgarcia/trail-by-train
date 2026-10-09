import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLatBoundsLike } from 'maplibre-gl';
import { setRailNetworkVisibility } from '../railNetworkOverlay';
import { setRailStationsVisibility } from '../railStationsOverlay';
import {
  setCuratedHikesVisibility,
  setCuratedHikesVisibleIds,
  CURATED_HIT_LAYER_ID,
  type CuratedManifest,
  type FilterRange,
} from '../../features/curated-hikes';
import {
  useExplore,
  finalizeRegion,
  rejectStroke,
  setRegionPreview,
  clearRegion,
  showOnlyMatchedBusLines,
  restoreFromSnapshot,
  simplify,
  circleRing,
  ringBbox,
  isDegenerateRing,
  SIMPLIFY_EPSILON_DEG,
  type ExploreSnapshot,
  type LonLat,
} from '../../features/explore';
import type { DayFilter } from '../../transit';
import { fitPadding } from '../../lib/chromePadding';

interface ExploreMapOptions {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  mapInstance: maplibregl.Map | null;
  explore: ReturnType<typeof useExplore>;
  mountTransitProviderRef: MutableRefObject<((providerId: string) => void) | null>;
  dayFilterRef: MutableRefObject<DayFilter>;
  hideLowFreqRef: MutableRefObject<boolean>;
  curatedVisibleRef: MutableRefObject<boolean>;
  curatedManifest: CuratedManifest | null;
  curatedFilter: FilterRange | null;
}

/** Explore mode's map side: lasso, radius preview, matched-lines render, focus events. */
export function useExploreMap({
  mapRef,
  mapInstance,
  explore,
  mountTransitProviderRef,
  dayFilterRef,
  hideLowFreqRef,
  curatedVisibleRef,
  curatedManifest,
  curatedFilter,
}: ExploreMapOptions): void {
  const exploreSnapshotRef = useRef<ExploreSnapshot | null>(null);

  // ---- Explore: lasso capture. Active only while the mode is armed. Suspends
  // map pan/zoom for the stroke, traces a rubber-band on the canvas, and on
  // release simplifies + closes the ring (or rejects a too-small scribble).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !explore.active || !explore.armed) return;
    const canvas = map.getCanvas();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.touchZoomRotate.disable();
    map.doubleClickZoom.disable();
    const prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    let drawing = false;
    // Track only the first pointer of the gesture. A second finger (e.g. a
    // pinch attempt) emits its own pointer stream; mixing both fingers'
    // coordinates produced a high-frequency sawtooth ("dents-de-scie"). We
    // lock onto the initial pointerId and ignore every other pointer.
    let activePointerId: number | null = null;
    let pts: LonLat[] = [];
    const toLngLat = (ev: PointerEvent): LonLat => {
      const rect = canvas.getBoundingClientRect();
      const ll = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top]);
      return [ll.lng, ll.lat];
    };
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button > 0) return;
      // Ignore additional fingers once a stroke is in progress.
      if (drawing || activePointerId !== null) return;
      drawing = true;
      activePointerId = ev.pointerId;
      pts = [toLngLat(ev)];
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      setRegionPreview(map, pts, false);
      ev.preventDefault();
    };
    const onMove = (ev: PointerEvent) => {
      if (!drawing || ev.pointerId !== activePointerId) return;
      pts.push(toLngLat(ev));
      setRegionPreview(map, pts, false);
    };
    const onUp = (ev: PointerEvent) => {
      if (!drawing || ev.pointerId !== activePointerId) return;
      drawing = false;
      activePointerId = null;
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      const ring = simplify(pts, SIMPLIFY_EPSILON_DEG);
      if (isDegenerateRing(ring)) {
        clearRegion(map);
        rejectStroke('Zone trop petite — dessinez une zone plus grande.');
        return;
      }
      setRegionPreview(map, ring, true);
      finalizeRegion(ring);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.style.touchAction = prevTouchAction;
      map.dragPan.enable();
      map.dragRotate.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
    };
  }, [mapRef, mapInstance, explore.active, explore.armed]);

  // ---- Explore: circle preview while a radius is being chosen.
  //
  // Reuses the lasso's own region source, so the circle and a drawn outline
  // are literally the same layer — confirming the radius therefore replaces
  // the preview with an identical-looking finalized ring, with no flicker.
  //
  // The frame is applied on a trailing timer: a slider drag emits a change per
  // step, and animating fitBounds per step would fight the user's input. One
  // frame after they settle is what reads as responsive.
  const radiusCenter = explore.center;
  const radiusKm = explore.radiusKm;
  const inRadiusPhase = explore.active && explore.phase === 'radius' && !!radiusCenter;
  // Identity of the centre currently framed. The store keeps the same `center`
  // array across radius changes, so a differing reference means a new place was
  // chosen — which is framed at once, while a radius change waits out the drag.
  const framedCenterRef = useRef<LonLat | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !inRadiusPhase || !radiusCenter) {
      framedCenterRef.current = null;
      return;
    }
    const ring = circleRing(radiusCenter, radiusKm);
    setRegionPreview(map, ring, true);
    const [minLon, minLat, maxLon, maxLat] = ringBbox(ring);
    const bounds: LngLatBoundsLike = [
      [minLon, minLat],
      [maxLon, maxLat],
    ];
    // A newly chosen place: this is the only move the map makes on selection,
    // so it goes straight to the framed circle rather than flying to the point
    // and then correcting.
    if (framedCenterRef.current !== radiusCenter) {
      framedCenterRef.current = radiusCenter;
      map.fitBounds(bounds, { padding: fitPadding(), duration: 600 });
      return;
    }
    const timer = window.setTimeout(() => {
      map.fitBounds(bounds, { padding: fitPadding(), duration: 400 });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [mapRef, mapInstance, inRadiusPhase, radiusCenter, radiusKm]);

  // ---- Explore: render matched bus lines only, restore on teardown.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const results = explore.results;
    const shouldRender =
      explore.active && !!results && (explore.status === 'ready' || explore.status === 'empty');
    if (!shouldRender || !results) return;
    const snap = showOnlyMatchedBusLines(map, results, (id) =>
      mountTransitProviderRef.current?.(id),
    );
    exploreSnapshotRef.current = snap;
    return () => {
      // Deliberately the value at cleanup time (when Explore exits), not at setup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      restoreFromSnapshot(map, snap, dayFilterRef.current, hideLowFreqRef.current);
      exploreSnapshotRef.current = null;
    };
  }, [
    dayFilterRef,
    hideLowFreqRef,
    mapRef,
    mountTransitProviderRef,
    mapInstance,
    explore.active,
    explore.status,
    explore.results,
  ]);

  // ---- Explore: optional railway-network overlay. Explore owns the rail
  // layers while active (the normal rail effect is suppressed), so drive their
  // visibility from the store toggle. Runs after the render effect above so it
  // re-shows rail on top of the just-hidden overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !explore.active) return;
    // Only once the map has cleared to the results view; during drawing the
    // normal overlays (incl. rail) are still shown untouched.
    if (explore.status !== 'ready' && explore.status !== 'empty') return;
    if (!map.getLayer('rail-network-halo')) return;
    setRailNetworkVisibility(map, explore.showRail);
    // Show the gares (stations) alongside the network lines.
    if (map.getLayer('rail-stations-dot')) {
      setRailStationsVisibility(map, explore.showRail);
    }
  }, [mapRef, mapInstance, explore.active, explore.showRail, explore.status]);

  // ---- Explore: draw a chosen curated hike's track on the otherwise bus-only
  // map. Panel selection sets `hikeOnMapId`; the track stays until another is
  // chosen or the mode exits. Its info box is opened separately by clicking the
  // track (the curated overlay's own click handler), so closing the box leaves
  // the track on the map. On teardown, reset the curated visible-ids filter to
  // the app's normal duration filter so a later toggle-on isn't stuck showing
  // just this one hike.
  const hikeOnMapId = explore.hikeOnMapId;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const inResults = explore.active && (explore.status === 'ready' || explore.status === 'empty');
    if (!inResults) return;
    if (!map.getLayer(CURATED_HIT_LAYER_ID)) return;
    if (hikeOnMapId) {
      setCuratedHikesVisibleIds(map, [hikeOnMapId]);
      setCuratedHikesVisibility(map, true);
    } else {
      setCuratedHikesVisibility(map, false);
    }
    return () => {
      if (!map.getLayer(CURATED_HIT_LAYER_ID)) return;
      const ids: string[] | 'all' =
        curatedManifest && curatedFilter
          ? curatedManifest.hikes
              .filter(
                (h) => h.durationDays >= curatedFilter.min && h.durationDays <= curatedFilter.max,
              )
              .map((h) => h.id)
          : 'all';
      setCuratedHikesVisibleIds(map, ids);
      // Deliberately the value at cleanup time (when Explore exits), not at setup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setCuratedHikesVisibility(map, curatedVisibleRef.current);
    };
  }, [
    curatedVisibleRef,
    mapRef,
    mapInstance,
    explore.active,
    explore.status,
    hikeOnMapId,
    curatedManifest,
    curatedFilter,
  ]);

  // ---- Explore: map-focus events dispatched by the result panel.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onFly = (e: Event) => {
      const { coord } = (e as CustomEvent<{ coord: [number, number] }>).detail;
      map.flyTo({ center: coord, zoom: Math.max(map.getZoom(), 13), duration: 600 });
    };
    const onFit = (e: Event) => {
      const { bbox } = (e as CustomEvent<{ bbox: [number, number, number, number] }>).detail;
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: fitPadding(), maxZoom: 14, duration: 600 },
      );
    };
    window.addEventListener('explore:flyto', onFly);
    window.addEventListener('explore:fit', onFit);
    return () => {
      window.removeEventListener('explore:flyto', onFly);
      window.removeEventListener('explore:fit', onFit);
    };
  }, [mapRef, mapInstance]);

  // ---- Explore: drop the region outline when the mode ends.
  //
  // `restoreFromSnapshot` clears it on the way out of the results view, but a
  // session abandoned from the radius panel never took a snapshot — without
  // this the circle would outlive the mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || explore.active) return;
    clearRegion(map);
  }, [mapRef, mapInstance, explore.active]);
}
