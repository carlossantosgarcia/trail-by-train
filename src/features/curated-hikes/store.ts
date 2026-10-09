// Minimal useSyncExternalStore-backed state for the curated-hikes
// overlay: the loaded manifest, the active duration-filter range, and
// the currently-selected hike (for the click popup).
//
// Toggle on/off is handled by App.tsx via lib/curatedVisibilityStorage —
// the overlay itself only needs to know about manifest + filter +
// selection. Filter state is transient (resets when the overlay is
// remounted), per spec.

import { useSyncExternalStore } from 'react';
import { loadManifest } from './manifest';
import type { CuratedHike, CuratedManifest } from './types';

export interface FilterRange {
  min: number;
  max: number;
}

interface State {
  manifest: CuratedManifest | null;
  loading: boolean;
  loadError: string | null;
  filter: FilterRange | null;
  selectedId: string | null;
  /** Where the user clicked — anchors the popup near the hit instead of the bbox centre, which can land in another country for split themed collections. */
  selectedAnchor: [number, number] | null;
}

let state: State = {
  manifest: null,
  loading: false,
  loadError: null,
  filter: null,
  selectedId: null,
  selectedAnchor: null,
};

const subscribers = new Set<() => void>();

function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  for (const s of subscribers) s();
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot(): State {
  return state;
}

let loadPromise: Promise<void> | null = null;

/** Trigger a manifest fetch (idempotent). Resolves once the manifest is loaded. */
export function ensureManifestLoaded(): Promise<void> {
  if (state.manifest) return Promise.resolve();
  if (loadPromise) return loadPromise;
  setState({ loading: true, loadError: null });
  loadPromise = (async () => {
    try {
      const manifest = await loadManifest();
      const max = Math.max(1, ...manifest.hikes.map((h) => h.durationDays));
      setState({
        manifest,
        loading: false,
        loadError: null,
        filter: { min: 1, max },
      });
    } catch (err) {
      setState({ loading: false, loadError: (err as Error).message });
      loadPromise = null;
      throw err;
    }
  })();
  return loadPromise;
}

export function getDurationBounds(manifest: CuratedManifest): FilterRange {
  if (manifest.hikes.length === 0) return { min: 1, max: 1 };
  let min = Infinity,
    max = -Infinity;
  for (const h of manifest.hikes) {
    if (h.durationDays < min) min = h.durationDays;
    if (h.durationDays > max) max = h.durationDays;
  }
  return { min: Math.max(1, min), max: Math.max(1, max) };
}

export function setFilter(filter: FilterRange): void {
  setState({ filter });
}

/** Reset the filter to the full range from the loaded manifest. */
export function resetFilter(): void {
  if (!state.manifest) return;
  const { max } = getDurationBounds(state.manifest);
  setState({ filter: { min: 1, max } });
}

export function setSelected(id: string | null, anchor: [number, number] | null = null): void {
  if (state.selectedId === id && state.selectedAnchor === anchor) return;
  setState({ selectedId: id, selectedAnchor: id ? anchor : null });
}

export function getSelectedHike(): CuratedHike | null {
  if (!state.manifest || !state.selectedId) return null;
  return state.manifest.hikes.find((h) => h.id === state.selectedId) ?? null;
}

export function visibleIds(): string[] {
  if (!state.manifest || !state.filter) return [];
  const { min, max } = state.filter;
  return state.manifest.hikes
    .filter((h) => h.durationDays >= min && h.durationDays <= max)
    .map((h) => h.id);
}

export function useCuratedStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useCuratedState(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
