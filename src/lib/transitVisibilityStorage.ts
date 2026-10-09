// Per-provider visibility persistence. Mirrors railVisibilityStorage so the
// rail and transit toggles behave identically across reloads.

function keyFor(providerId: string): string {
  return `hp:transit-visible:${providerId}`;
}

export function readTransitVisible(providerId: string, defaultVisible: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(keyFor(providerId));
    if (raw === '1') return true;
    if (raw === '0') return false;
    return defaultVisible;
  } catch {
    return defaultVisible;
  }
}

export function writeTransitVisible(providerId: string, value: boolean): void {
  try {
    window.localStorage.setItem(keyFor(providerId), value ? '1' : '0');
  } catch {
    // Storage unavailable — runtime state remains authoritative.
  }
}

const PREFIX = 'hp:transit-visible:';

/**
 * Drop stored toggles for providers that no longer exist.
 *
 * Reads are already driven by the provider catalog, so a retired id is inert
 * rather than fatal — but it would sit in storage for ever. When Fluo's three
 * departmental providers were replaced by one region-wide provider, that left
 * three dead keys per user. Removing them keeps the guarantee deliberate
 * instead of incidental.
 */
export function pruneUnknownTransitVisible(knownIds: readonly string[]): void {
  try {
    const known = new Set(knownIds);
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX) && !known.has(key.slice(PREFIX.length))) stale.push(key);
    }
    // Collected first: removing while iterating reindexes the store.
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing to prune.
  }
}
