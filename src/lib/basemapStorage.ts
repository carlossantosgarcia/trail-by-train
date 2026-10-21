// The basemap the user last picked, persisted like every other user setting
// in this app (see themeStorage, railVisibilityStorage, …), so someone who
// prefers Topo or Street gets it back on their next visit.

import { BASE_LAYERS, DEFAULT_BASE_LAYER_ID } from '../layers/ignBaseLayers';

const KEY = 'hp.basemap';

/** The saved basemap, or the default when none is saved or it no longer exists. */
export function readBasemap(): string {
  try {
    const raw = window.localStorage.getItem(KEY);
    return BASE_LAYERS.some((l) => l.id === raw) ? (raw as string) : DEFAULT_BASE_LAYER_ID;
  } catch {
    // Private-mode Safari and friends throw on localStorage access.
    return DEFAULT_BASE_LAYER_ID;
  }
}

export function writeBasemap(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable; runtime state is still authoritative */
  }
}
