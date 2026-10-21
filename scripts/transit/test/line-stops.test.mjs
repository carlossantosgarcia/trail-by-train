import { describe, expect, it } from 'vitest';
import {
  addTripStop,
  buildLineStops,
  firstDirection,
  foldVariants,
  isSubsequence,
  orderedTripStops,
  routePatterns,
} from '../lib/line-stops.mjs';

const stop = (id, name, lon, lat) => ({
  properties: { stop_id: id, stop_name: name },
  geometry: { coordinates: [lon, lat] },
});
const line = (routeId, coordinates) => ({
  properties: { route_id: routeId },
  geometry: { type: 'LineString', coordinates },
});

describe('orderedTripStops', () => {
  it('sorts by stop_sequence, not by row order', () => {
    const rows = new Map();
    addTripStop(rows, 't', 3, 'c');
    addTripStop(rows, 't', 1, 'a');
    addTripStop(rows, 't', 2, 'b');
    expect(orderedTripStops(rows.get('t'))).toEqual(['a', 'b', 'c']);
  });
});

describe('firstDirection', () => {
  it('reads first the direction ending at the second endpoint', () => {
    const byDir = new Map([
      ['0', { trip: 'out', len: 9 }],
      ['1', { trip: 'back', len: 8 }],
    ]);
    expect(firstDirection(byDir)).toBe('1');
    expect(firstDirection(new Map([['0', { trip: 'only', len: 3 }]]))).toBe('0');
  });
});

describe('routePatterns', () => {
  it('counts the trips of each distinct pattern, per direction', () => {
    const rows = new Map();
    const trip = (id, dir, stops) => {
      stops.forEach((s, i) => addTripStop(rows, id, i + 1, s));
      return { trip_id: id, direction_id: dir };
    };
    const trips = [
      trip('a', '1', ['A', 'B', 'C']),
      trip('b', '1', ['A', 'B', 'C']),
      trip('c', '0', ['C', 'B', 'A']),
    ];
    expect(routePatterns(trips, rows, '1')).toEqual([
      { dir: 0, trips: 2, stops: ['A', 'B', 'C'] },
      { dir: 1, trips: 1, stops: ['C', 'B', 'A'] },
    ]);
  });
});

describe('foldVariants', () => {
  it('folds short turns and skipped stops into the run that contains them', () => {
    expect(isSubsequence(['A', 'C'], ['A', 'B', 'C'])).toBe(true);
    expect(isSubsequence(['C', 'A'], ['A', 'B', 'C'])).toBe(false);
    const out = foldVariants([
      { dir: 0, trips: 5, stops: ['A', 'B', 'C', 'D'] },
      { dir: 0, trips: 3, stops: ['A', 'B'] },
      { dir: 0, trips: 9, stops: ['A', 'B', 'X'] },
    ]);
    // The branch to X is busier, so it comes first; A–B counts for A–D.
    expect(out).toEqual([
      { dir: 0, trips: 9, stops: ['A', 'B', 'X'] },
      { dir: 0, trips: 8, stops: ['A', 'B', 'C', 'D'] },
    ]);
  });
});

describe('buildLineStops', () => {
  const stopFeatures = [stop('A', 'Gare', 5.7, 45.1), stop('B', 'Mairie', 5.8, 45.2)];

  it('follows merged stops and drops a repeated call', () => {
    const out = buildLineStops({
      lineFeatures: [
        line('1', [
          [5.7, 45.1],
          [5.9, 45.3],
        ]),
      ],
      patternsByRoute: new Map([['1', [{ dir: 0, trips: 4, stops: ['A', 'A2', 'B'] }]]]),
      aliases: new Map([['A2', 'A']]),
      stopFeatures,
      previous: null,
    });
    expect(out.stops).toEqual([
      ['A', 'Gare', 570000, 4510000],
      ['B', 'Mairie', 580000, 4520000],
    ]);
    expect(out.lines['1']).toEqual({
      bbox: [570000, 4510000, 590000, 4530000],
      variants: [{ dir: 0, trips: 4, stops: [0, 1] }],
    });
  });

  it("keeps an archived line's variants from the last build", () => {
    const out = buildLineStops({
      lineFeatures: [
        line('old', [
          [5.7, 45.1],
          [5.8, 45.2],
        ]),
      ],
      patternsByRoute: new Map(),
      aliases: new Map(),
      stopFeatures,
      previous: {
        stops: [
          ['B', 'Mairie', 0, 0],
          ['A', 'Gare', 0, 0],
        ],
        lines: { old: { bbox: null, variants: [{ dir: 0, trips: 2, stops: [1, 0] }] } },
      },
    });
    expect(out.lines.old.variants).toEqual([{ dir: 0, trips: 2, stops: [0, 1] }]);
    expect(out.stops.map((s) => s[0])).toEqual(['A', 'B']);
  });
});
