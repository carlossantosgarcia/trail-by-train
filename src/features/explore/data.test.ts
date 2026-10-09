import { afterEach, describe, expect, it, vi } from 'vitest';

// Explore must recover from a failed load: the first attempt fails, the next
// one must try again rather than replay the failure for the whole session.

vi.mock('../../transit', () => ({ TRANSIT_PROVIDERS: [] }));
vi.mock('../curated-hikes', () => ({ loadManifest: () => Promise.resolve({ hikes: [] }) }));

let attempts = 0;
class FakeWorker {
  private listeners: ((ev: { data: unknown }) => void)[] = [];
  addEventListener(_: string, fn: (ev: { data: unknown }) => void) {
    this.listeners.push(fn);
  }
  removeEventListener(_: string, fn: (ev: { data: unknown }) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  postMessage(msg: { kind: string }) {
    if (msg.kind !== 'load') return;
    attempts += 1;
    const data = attempts === 1 ? { kind: 'load-failed', error: 'HTTP 503' } : { kind: 'loaded' };
    queueMicrotask(() => [...this.listeners].forEach((l) => l({ data })));
  }
}
vi.stubGlobal('Worker', FakeWorker);

afterEach(() => {
  attempts = 0;
});

describe('ensureExploreData', () => {
  it('retries after a failed load', async () => {
    const { ensureExploreData } = await import('./data');
    await expect(ensureExploreData()).rejects.toThrow('HTTP 503');
    await expect(ensureExploreData()).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });
});
