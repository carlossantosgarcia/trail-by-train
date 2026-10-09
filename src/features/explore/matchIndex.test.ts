import { describe, expect, it } from 'vitest';
import { matchIndex, type ExploreIndex } from './matchIndex';

const E5 = (x: number) => Math.round(x * 1e5);
const index: ExploreIndex = {
  version: 1,
  providers: [
    {
      id: 'drome',
      lines: [
        ['r1', '25004'],
        ['r2', 'D29'],
      ],
      // One stop in Die (served by both lines), one far away in Valence.
      stops: [
        [E5(5.37), E5(44.75), 0, 1],
        [E5(4.89), E5(44.93), 1],
      ],
    },
    { id: 'zou', lines: [['z1', 'P4']], stops: [[E5(5.9), E5(44.56), 0]] },
  ],
  stations: [
    [E5(5.369), E5(44.751), 'Die', 'Die'],
    [E5(4.89), E5(44.93), 'Valence Ville', 'Valence'],
  ],
};
// A square of about 10 km around Die.
const ring: [number, number][] = [
  [5.3, 44.7],
  [5.45, 44.7],
  [5.45, 44.8],
  [5.3, 44.8],
];

describe('matchIndex', () => {
  it('returns every line calling at a stop inside the ring, once', () => {
    const m = matchIndex(index, ring);
    expect(m.lines).toEqual({
      drome: [
        ['r1', '25004'],
        ['r2', 'D29'],
      ],
    });
  });

  it('leaves out providers with no stop inside', () => {
    expect(matchIndex(index, ring).lines.zou).toBeUndefined();
  });

  it('returns the stations inside, in degrees', () => {
    expect(matchIndex(index, ring).stations).toEqual([['Die', 'Die', 5.369, 44.751]]);
  });

  it('matches nothing in an empty area', () => {
    const sea: [number, number][] = [
      [3, 43],
      [3.1, 43],
      [3.1, 43.1],
    ];
    expect(matchIndex(index, sea)).toEqual({ lines: {}, stations: [] });
  });
});
