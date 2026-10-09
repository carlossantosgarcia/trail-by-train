import { describe, expect, it } from 'vitest';
import { isRailRouteType, partitionRailRoutes } from '../lib/route-types.mjs';

describe('isRailRouteType', () => {
  it('treats basic and extended rail types as rail', () => {
    for (const t of ['2', '100', '106', '117', 2]) expect(isRailRouteType(t)).toBe(true);
  });

  it('keeps buses, coaches, trams, metro, funiculars and cable cars', () => {
    for (const t of ['3', '0', '1', '5', '6', '7', '12', '200', '700', '715', '118', ''])
      expect(isRailRouteType(t)).toBe(false);
  });
});

describe('partitionRailRoutes', () => {
  it('drops the train and keeps the coach that shares its number', () => {
    const routes = [
      { route_id: 'SNC:K24:', route_short_name: 'K24', route_type: '2' },
      { route_id: 'SNC:P25:', route_short_name: 'P25', route_type: '2' },
      { route_id: 'SNC:P25::Coach', route_short_name: 'P25', route_type: '3' },
    ];
    const { kept, rail } = partitionRailRoutes(routes);
    expect(kept.map((r) => r.route_id)).toEqual(['SNC:P25::Coach']);
    expect(rail.map((r) => r.route_id)).toEqual(['SNC:K24:', 'SNC:P25:']);
  });
});

describe('mergeLineLedger with excluded routes', async () => {
  const { mergeLineLedger } = await import('../lib/ledger.mjs');
  const line = (route_id, short, long) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[5.7, 45.18], [5.72, 45.1], [5.8, 44.9]] },
    properties: { route_id, route_short_name: short, route_long_name: long, last_seen_on: '2026-10-02' },
  });
  const train = line('SNC:P25:', 'P25', 'Grenoble - Clelles - Veynes');
  const coach = line('SNC:P25::Coach', 'P25', 'Grenoble - Clelles - Veynes');

  it('forgets a train instead of archiving it, and keeps the coach live', () => {
    const { features } = mergeLineLedger({
      previous: [train, coach],
      current: [coach],
      buildDate: '2026-10-09',
      feedValidTo: null,
      providerId: 'zou',
      excludedRouteIds: new Set(['SNC:P25:']),
    });
    expect(features.map((f) => [f.properties.route_id, f.properties.archived])).toEqual([
      ['SNC:P25::Coach', false],
    ]);
  });

  it('still archives a bus line the feed stopped publishing', () => {
    const { features } = mergeLineLedger({
      previous: [coach],
      current: [],
      buildDate: '2026-10-09',
      feedValidTo: null,
      providerId: 'zou',
    });
    expect(features[0].properties.archived).toBe(true);
  });
});

describe('mergeStopLedger', async () => {
  const { mergeStopLedger } = await import('../lib/ledger.mjs');
  const stop = (id, lines) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [5.7, 45.18] },
    properties: { stop_id: id, stop_name: id, serving_lines: lines.map((route_id) => ({ route_id })) },
  });

  it('keeps an old stop for the lines still on the map, and only those', () => {
    const { features } = mergeStopLedger({
      previous: [stop('gare', ['SNC:P25:', 'BUS:1'])],
      current: [],
      archivedRouteIds: new Set(['BUS:1']),
      knownRouteIds: new Set(['BUS:1']),
      providerId: 'zou',
    });
    expect(features[0].properties.serving_lines.map((l) => l.route_id)).toEqual(['BUS:1']);
  });
});
