// Desktop collapsed/expanded state for the floating controls panel.
// Defaults to expanded so first-time users discover the controls.

const STORAGE_KEY = 'controls.panel.collapsed';

export function readControlsCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeControlsCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}
