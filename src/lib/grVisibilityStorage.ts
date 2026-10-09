// Persisted on/off state for the GR (Grande Randonnée) trails overlay
// toggle. Mirrors lib/curatedVisibilityStorage.ts.

const STORAGE_KEY = 'hp:gr-visible';
const DEFAULT_VISIBLE = false;

export function readGrVisible(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function writeGrVisible(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable; runtime state is still authoritative */
  }
}
