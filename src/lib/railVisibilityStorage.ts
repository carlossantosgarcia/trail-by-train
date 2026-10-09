const STORAGE_KEY = 'hp:rail-visible';
const DEFAULT_VISIBLE = true;

export function readRailVisible(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function writeRailVisible(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable (private mode, quota, etc.) — silently ignore;
    // the runtime state is still authoritative for the current session.
  }
}
