// Explore's matching, off the main thread. Loads explore-index.json once
// (built by scripts/transit/build-explore-index.mjs) and answers "which lines
// and stations are inside this ring?". Parsing and scanning ~60k stops on the
// main thread froze the page for seconds on a phone, mid-stroke.

import type { LonLat } from './geometry';
import { matchIndex, type ExploreIndex, type IndexMatch } from './matchIndex';

export type WorkerRequest =
  | { kind: 'load'; url: string }
  | { kind: 'match'; id: number; ring: LonLat[] };

export type WorkerResponse =
  | { kind: 'loaded' }
  | { kind: 'load-failed'; error: string }
  | ({ kind: 'matched'; id: number } & IndexMatch);

let index: ExploreIndex | null = null;
const post = (m: WorkerResponse) =>
  (self as unknown as { postMessage(m: unknown): void }).postMessage(m);

self.addEventListener('message', async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.kind === 'load') {
    try {
      const resp = await fetch(msg.url, { credentials: 'same-origin' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${msg.url}`);
      index = (await resp.json()) as ExploreIndex;
      post({ kind: 'loaded' });
    } catch (err) {
      post({ kind: 'load-failed', error: (err as Error).message ?? String(err) });
    }
  } else if (msg.kind === 'match' && index) {
    post({ kind: 'matched', id: msg.id, ...matchIndex(index, msg.ring) });
  }
});
