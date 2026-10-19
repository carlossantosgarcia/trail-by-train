// Whether this browser has seen the first-visit tutorial. The value is the
// tutorial's version, so a materially new tutorial can show itself once more
// by bumping TUTORIAL_VERSION. Never leaves the browser.

const STORAGE_KEY = 'tutorial.seen';
export const TUTORIAL_VERSION = 1;

export function readTutorialSeen(): boolean {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) >= TUTORIAL_VERSION;
  } catch {
    return false;
  }
}

export function writeTutorialSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(TUTORIAL_VERSION));
  } catch {
    /* ignore */
  }
}
