// Persisted on/off state for the curated-hikes (Nature sans Voiture)
// overlay toggle. Mirrors lib/railVisibilityStorage.ts.

const STORAGE_KEY = 'hp:curated-nsv-visible';
const DEFAULT_VISIBLE = false;

export function readCuratedVisible(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function writeCuratedVisible(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable; runtime state is still authoritative */
  }
}
