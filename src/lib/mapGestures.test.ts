import { describe, expect, it } from 'vitest';
import {
  claimMapTap,
  publishMapPan,
  publishMapTap,
  subscribeMapGestures,
  type MapGesture,
} from './mapGestures';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('map gestures', () => {
  it('tells a tap a feature handled from a tap on empty map', async () => {
    const seen: MapGesture[] = [];
    const off = subscribeMapGestures((g) => seen.push(g));
    // The map's own click listener can run before the feature's.
    publishMapTap();
    claimMapTap();
    await tick();
    publishMapTap();
    await tick();
    publishMapPan();
    off();
    expect(seen).toEqual([
      { kind: 'tap', claimed: true },
      { kind: 'tap', claimed: false },
      { kind: 'pan' },
    ]);
  });
});
