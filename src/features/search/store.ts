// Pub/sub store for the search bar. Same lightweight pattern as
// explore/store and transit/highlightStore: module state, a Set of listeners,
// surfaced through useSyncExternalStore. Nothing here is persisted — a query
// is not a preference.

import { useSyncExternalStore } from 'react';
import { ensureIndexLoaded, queryIndex } from './data';
import { isPointResult, type SearchResult } from './types';
import { enterExploreAtPoint } from '../explore';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SearchState {
  /** Whether the result list is showing. */
  open: boolean;
  /**
   * Mobile only: whether the field itself is showing. Collapsed, search is a
   * single icon sharing the dock's action row — a field of its own would add a
   * whole row of chrome to a viewport that is already tight against the
   * map-dominance budget in the responsive-ui spec.
   *
   * It lives in the store rather than in SearchBar because the dock decides
   * *where* each state renders: the icon belongs to the action row, the field
   * to its own row above it.
   */
  expanded: boolean;
  query: string;
  status: SearchStatus;
  results: SearchResult[];
  error: string | null;
}

const INITIAL: SearchState = {
  open: false,
  expanded: false,
  query: '',
  status: 'idle',
  results: [],
  error: null,
};

let state: SearchState = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<SearchState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getState(): SearchState {
  return state;
}

export function useSearch(): SearchState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ---- Actions.

/**
 * Start loading the index. Called on first focus of the field so the fetch
 * overlaps the user's typing instead of blocking the first query.
 */
export function warmIndex(): void {
  void ensureIndexLoaded().catch(() => {});
}

/**
 * Guards against an out-of-order resolve: the index load is async, so a fast
 * typist can have several queries in flight on the very first keystrokes.
 */
let queryToken = 0;

export function setQuery(query: string): void {
  const token = ++queryToken;
  set({ query, open: true, error: null });
  if (!query.trim()) {
    set({ results: [], status: 'idle' });
    return;
  }
  if (state.status !== 'ready') set({ status: 'loading' });
  void ensureIndexLoaded()
    .then((index) => {
      if (token !== queryToken) return;
      set({ results: queryIndex(index, query), status: 'ready' });
    })
    .catch((err) => {
      if (token !== queryToken) return;
      set({ status: 'error', error: (err as Error).message, results: [] });
    });
}

export function closeSearch(): void {
  set({ open: false });
}

/** Mobile: swap the dock's search icon for the field. */
export function expandSearch(): void {
  set({ expanded: true });
}

/** Mobile: give the row back to the actions. */
export function collapseSearch(): void {
  set({ expanded: false, open: false });
}

export function clearSearch(): void {
  queryToken++;
  set({
    query: '',
    results: [],
    open: false,
    status: state.status === 'error' ? 'idle' : state.status,
  });
}

/**
 * Act on a chosen result. The two shapes diverge here, and this is the whole
 * point of the distinction:
 *
 *  - a point has somewhere to centre a circle, so it hands Explore a centre to
 *    put a radius around;
 *  - an extent is a line or a track with no meaningful centre, so it is framed
 *    and revealed on the map, and Explore is left alone.
 *
 * A point deliberately does NOT fly the map here. Entering the radius phase
 * makes Map.tsx frame the default circle, which is the same move but correctly
 * zoomed — flying to the point first would just be an animation the fit then
 * undoes.
 */
export function selectResult(result: SearchResult): void {
  clearSearch();
  // On a phone the field gives its row back to the dock's actions, so the
  // map shows the result rather than an empty field.
  set({ expanded: false });
  if (isPointResult(result)) {
    enterExploreAtPoint(result.coord, result.name);
    return;
  }
  window.dispatchEvent(
    new CustomEvent('search:reveal', {
      detail: {
        kind: result.kind,
        id: result.id,
        extra: result.extra,
        bbox: result.bbox,
        name: result.name,
      },
    }),
  );
}

/** Payload of the `search:reveal` event, handled by App.tsx and Map.tsx. */
export interface SearchRevealDetail {
  kind: 'bus' | 'rando' | 'gr';
  id: string;
  extra: string | null;
  bbox: [number, number, number, number];
  name: string;
}
