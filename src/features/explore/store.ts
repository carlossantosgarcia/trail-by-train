// Pub/sub store for Explore mode. Mirrors the lightweight store pattern used
// elsewhere (transit/highlightStore, curated-hikes/store): module-level state
// + a Set of listeners, surfaced to React via useSyncExternalStore. The mode
// is fully ephemeral — nothing here is persisted.

import { useSyncExternalStore } from 'react';
import { computeResults, ensureExploreData, type ExploreResults } from './data';
import { circleRing, type LonLat } from './geometry';

export type ExplorePhase = 'drawing' | 'radius' | 'results';
export type ExploreStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/**
 * How the region was defined. Recorded because "change the region" has to go
 * back to the control the user actually used — the slider for a point-seeded
 * session, the draw prompt for a traced one.
 */
export type ExploreOrigin = 'draw' | 'point';

/** Default radius: a comfortable day's reach around a point, and a region
 * large enough that a rural area still matches something. */
export const DEFAULT_RADIUS_KM = 8;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 40;

export interface ExploreState {
  active: boolean;
  /** When true, the next drag on the map traces the lasso instead of panning. */
  armed: boolean;
  phase: ExplorePhase;
  origin: ExploreOrigin;
  /** Centre of a point-seeded region ([lon, lat]), or null for a drawn one. */
  center: LonLat | null;
  /** Name of the searched place the centre came from, shown in the panel. */
  centerLabel: string | null;
  radiusKm: number;
  /** Closed polygon ring ([lon, lat] vertices), or null before one is drawn. */
  region: LonLat[] | null;
  status: ExploreStatus;
  results: ExploreResults | null;
  error: string | null;
  /** Transient nudge, e.g. after a too-small stroke. */
  notice: string | null;
  /** Railway-network overlay shown on top of the matched bus lines. On by
   * default — rail is usually the first leg, so the matched buses only read
   * once you can see which gare they connect to. Turning it off holds for the
   * session; re-entering the mode restores the default. */
  showRail: boolean;
  /** Curated hike whose track is drawn on the map (independent of the info
   * popup, which is opened by clicking the track). */
  hikeOnMapId: string | null;
}

const INITIAL: ExploreState = {
  active: false,
  armed: false,
  phase: 'drawing',
  origin: 'draw',
  center: null,
  centerLabel: null,
  radiusKm: DEFAULT_RADIUS_KM,
  region: null,
  status: 'idle',
  results: null,
  error: null,
  notice: null,
  showRail: true,
  hikeOnMapId: null,
};

let state: ExploreState = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<ExploreState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function getExploreState(): ExploreState {
  return state;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useExplore(): ExploreState {
  return useSyncExternalStore(subscribe, getExploreState, getExploreState);
}

// ---- Actions.

export function enterExplore(): void {
  set({
    active: true,
    armed: true,
    phase: 'drawing',
    origin: 'draw',
    center: null,
    centerLabel: null,
    radiusKm: DEFAULT_RADIUS_KM,
    region: null,
    status: 'idle',
    results: null,
    error: null,
    notice: null,
    showRail: true,
    hikeOnMapId: null,
  });
  // Warm the caches while the user frames their area.
  void ensureExploreData().catch(() => {});
}

/**
 * Enter Explore centred on a point — the path a search result takes.
 *
 * `armed` stays false: the user is choosing a distance, not drawing, so the
 * lasso capture in Map.tsx must not install and the map must keep panning
 * normally.
 */
export function enterExploreAtPoint(center: LonLat, label: string): void {
  set({
    active: true,
    armed: false,
    phase: 'radius',
    origin: 'point',
    center,
    centerLabel: label,
    radiusKm: DEFAULT_RADIUS_KM,
    region: null,
    status: 'idle',
    results: null,
    error: null,
    notice: null,
    showRail: true,
    hikeOnMapId: null,
  });
  void ensureExploreData().catch(() => {});
}

export function setRadiusKm(km: number): void {
  const clamped = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, km));
  if (clamped === state.radiusKm) return;
  set({ radiusKm: clamped });
}

/** Commit the chosen radius: turn it into a ring and run the normal match. */
export function confirmRadius(): void {
  if (!state.center) return;
  finalizeRegion(circleRing(state.center, state.radiusKm));
}

export function toggleRail(): void {
  set({ showRail: !state.showRail });
}

/** Draw (or clear) a curated hike's track on the map. */
export function showHikeOnMap(id: string | null): void {
  set({ hikeOnMapId: id });
}

export function exitExplore(): void {
  set(INITIAL);
}

export function armDraw(): void {
  set({ armed: true, notice: null });
}

/**
 * Discard the current region/results and go back to defining one.
 *
 * Which control that means depends on how the region was made: a point-seeded
 * session returns to its slider with the centre intact, a traced one re-arms
 * the lasso.
 */
export function redraw(): void {
  const toRadius = state.origin === 'point' && state.center !== null;
  set({
    armed: !toRadius,
    phase: toRadius ? 'radius' : 'drawing',
    region: null,
    status: 'idle',
    results: null,
    error: null,
    notice: null,
    hikeOnMapId: null,
  });
}

/** Report a rejected (too-small / degenerate) stroke without leaving drawing. */
export function rejectStroke(notice: string): void {
  set({ armed: false, notice });
}

let computeToken = 0;

/**
 * Finalize a drawn ring: store it, switch to results, and kick off the
 * (async) spatial match. Guarded by a token so a rapid redraw can't have an
 * older compute clobber a newer one.
 */
export function finalizeRegion(ring: LonLat[]): void {
  const token = ++computeToken;
  set({
    armed: false,
    phase: 'results',
    region: ring,
    status: 'loading',
    results: null,
    error: null,
    notice: null,
  });
  void computeResults(ring)
    .then((results) => {
      if (token !== computeToken) return;
      const empty =
        results.totalLines === 0 && results.stations.length === 0 && results.hikes.length === 0;
      set({ results, status: empty ? 'empty' : 'ready' });
    })
    .catch((err) => {
      if (token !== computeToken) return;
      set({ status: 'error', error: (err as Error).message });
    });
}

// ---- Map-focus helpers. The panel lives outside the map component, so it
// asks the map to move via window CustomEvents that Map.tsx listens for
// (same decoupling as the existing `transit:open-line` event).

export function exploreFlyTo(coord: LonLat): void {
  window.dispatchEvent(new CustomEvent('explore:flyto', { detail: { coord } }));
}

export function exploreFit(bbox: [number, number, number, number]): void {
  window.dispatchEvent(new CustomEvent('explore:fit', { detail: { bbox } }));
}
