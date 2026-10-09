// Theme preference, persisted like every other user setting in this app
// (see railVisibilityStorage, busFilterStorage, …).
//
// The *applied* theme is resolved and stamped onto <html data-theme> by an
// inline script in index.html before first paint, so there is never a flash
// of the wrong palette. This module is the typed accessor React uses; it must
// stay in step with that script.

const KEY = 'hp.theme';

/** What the user asked for. 'auto' follows the operating system. */
export type ThemePreference = 'auto' | 'light' | 'dark';

/** What is actually on screen. */
export type ResolvedTheme = 'light' | 'dark';

function isPreference(v: unknown): v is ThemePreference {
  return v === 'auto' || v === 'light' || v === 'dark';
}

export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(KEY);
    return isPreference(raw) ? raw : 'auto';
  } catch {
    // Private-mode Safari and friends throw on localStorage access.
    return 'auto';
  }
}

export function writeThemePreference(value: ThemePreference): void {
  try {
    if (value === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    // Preference simply won't persist; the applied theme still changes.
  }
}

/** Resolve a preference against the OS setting. */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'auto') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Stamp the resolved theme onto <html>, which is what the tokens key off. */
export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}
