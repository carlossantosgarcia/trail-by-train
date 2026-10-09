// One-shot, cached fetch of the curated-hikes manifest. Subsequent calls
// return the same in-flight promise so toggling the overlay on and off
// quickly never issues parallel fetches.

import type { CuratedManifest } from './types';
import { KNOWN_CURATED_SOURCES } from './types';

let pending: Promise<CuratedManifest> | null = null;
let loaded: CuratedManifest | null = null;

function manifestUrl(): string {
  return `${import.meta.env.BASE_URL}curated/manifest.json`;
}

export function getCachedManifest(): CuratedManifest | null {
  return loaded;
}

export function loadManifest(): Promise<CuratedManifest> {
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;
  pending = (async () => {
    const resp = await fetch(manifestUrl(), { credentials: 'same-origin' });
    if (!resp.ok) {
      pending = null;
      throw new Error(
        `Could not load curated-hikes manifest (HTTP ${resp.status} ${resp.statusText}).`,
      );
    }
    const data = (await resp.json()) as CuratedManifest;
    // Drop entries whose `source` is missing or unrecognised so the
    // runtime is robust to a partially-broken build. Log so a curious
    // maintainer can see what fell out.
    const known = new Set<string>(KNOWN_CURATED_SOURCES);
    const filtered = (data.hikes ?? []).filter((h) => h.source && known.has(h.source));
    if (filtered.length !== data.hikes.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[curated-hikes] dropped ${data.hikes.length - filtered.length} manifest entries with missing/unknown source`,
      );
    }
    loaded = { ...data, hikes: filtered };
    return loaded;
  })();
  return pending;
}
