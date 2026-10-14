import { describe, expect, it } from 'vitest';
import { describeMatch, isStopToStop, stopIndex } from '../lib/estimate-shapes.mjs';
import { regionsFor } from '../lib/osm-extracts.mjs';
import { ledgerShapeLookup } from '../lib/ledger.mjs';

// Along the 45° parallel, 0.001° of longitude is about 79 m.
const M = 0.001 / 78.7;
const at = (m) => [6 + m * M, 45];

/** A matched shape with a vertex every 50 m from 0 to `len` metres. */
function road(len, skip = []) {
  const out = [];
  for (let d = 0; d <= len; d += 50) {
    if (skip.some(([a, b]) => d > a && d < b)) continue;
    const [lon, lat] = at(d);
    out.push({ lon, lat, sd: d });
  }
  return out;
}
const stop = (d, offset = 0) => {
  const [lon, lat] = at(d);
  return { lon, lat: lat + offset * (1 / 110540), sd: d };
};

describe('describeMatch', () => {
  it("draws pfaedle's line whole", () => {
    const r = describeMatch(road(2000), [stop(0), stop(800), stop(2000)]);
    expect(r.straight).toBe(0);
    expect(r.parts).toHaveLength(1);
    expect(r.parts[0]).toHaveLength(41);
  });

  it("keeps and counts a hop with no vertex: pfaedle's straight-line fallback", () => {
    const r = describeMatch(road(3000, [[1000, 2000]]), [
      stop(0),
      stop(1000),
      stop(2000),
      stop(3000),
    ]);
    expect(r.straight).toBe(1);
    expect(r.straightHops).toEqual([2]);
    expect(r.parts).toHaveLength(1);
  });

  it('does not count a short straight hop, which a real street can be', () => {
    const r = describeMatch(road(1000, [[400, 650]]), [stop(0), stop(400), stop(650), stop(1000)]);
    expect(r.straight).toBe(0);
  });

  it('counts a stop placed more than 100 m away, and still draws its hops', () => {
    const r = describeMatch(road(3000), [stop(0), stop(1000), stop(2000, 150), stop(3000)]);
    expect(r.moved).toBe(1);
    expect(r.parts).toHaveLength(1);
  });
});

describe('isStopToStop', () => {
  const stops = [0, 3000, 6000, 9000].map(at);
  const nearStop = stopIndex(stops);

  it('flags a shape whose vertices are its stops', () => {
    expect(isStopToStop(stops, nearStop)).toBe(true);
  });

  it('does not flag a shape that follows a road between its stops', () => {
    const coords = [];
    for (let d = 0; d <= 9000; d += 40) coords.push([at(d)[0], 45 + Math.sin(d / 500) * 0.002]);
    expect(isStopToStop(coords, nearStop)).toBe(false);
  });
});

describe('regionsFor', () => {
  const square = (id, x0, y0, x1, y1) => ({
    id,
    polygons: [
      [
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
          [x0, y0],
        ],
      ],
    ],
  });
  const regions = [
    square('rhone-alpes', 4, 44, 7, 46.3),
    square('switzerland', 5.9, 46.2, 10.5, 47.8),
  ];

  it('adds a neighbouring country a line reaches, largest share first', () => {
    const got = regionsFor(
      [
        [6.1, 45.9],
        [6.12, 46.0],
        [6.14, 46.24], // in both
        [6.14, 46.4], // Geneva side only
      ],
      regions,
    );
    expect(got.map((r) => r.id)).toEqual(['rhone-alpes', 'switzerland']);
  });
});

describe('ledgerShapeLookup and estimates', () => {
  it('never reuses an estimated shape as if the network had published it', () => {
    const lookup = ledgerShapeLookup([
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [6.6, 44.9],
            [6.64, 44.9],
          ],
        },
        properties: { route_id: 'L1', shape_estimated: 'all', last_seen_on: '2026-10-01' },
      },
    ]);
    expect(lookup({ route_id: 'L1' }, [[6.6, 44.9]])).toBeNull();
  });
});
