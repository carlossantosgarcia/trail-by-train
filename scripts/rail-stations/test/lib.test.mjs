import { describe, expect, it } from 'vitest';
import { mergeStations, nameKey, railTripIds, servedStations, toFeatures } from '../lib.mjs';

const stop = (stop_id, stop_name, lon, lat, parent_station = '') => ({
  stop_id,
  stop_name,
  stop_lon: String(lon),
  stop_lat: String(lat),
  parent_station,
});

describe('railTripIds', () => {
  it('keeps trips on rail routes only', () => {
    const routes = [
      { route_id: 'ter', route_type: '2' },
      { route_id: 'car', route_type: '3' },
      { route_id: 'tgv', route_type: '101' },
    ];
    const trips = [
      { trip_id: 't1', route_id: 'ter' },
      { trip_id: 't2', route_id: 'car' },
      { trip_id: 't3', route_id: 'tgv' },
    ];
    expect([...railTripIds(routes, trips)].sort()).toEqual(['t1', 't3']);
  });
});

describe('servedStations', () => {
  const stops = [
    stop('StopArea:OCE87757724', 'Grasse', 6.925549, 43.653344),
    stop('StopPoint:OCETrain TER-87757724', 'Grasse', 6.925549, 43.653344, 'StopArea:OCE87757724'),
    stop('StopPoint:OCECar TER-87757724', 'Grasse', 6.925549, 43.653344, 'StopArea:OCE87757724'),
    stop('StopArea:OCE87615260', 'Quillan', 2.181787, 42.873947),
    stop('StopPoint:OCECar TER-87615260', 'Quillan', 2.181787, 42.873947, 'StopArea:OCE87615260'),
    stop('IDFM:1', 'Nation', 2.3959, 48.8482),
    stop('IDFM:q1', 'Nation', 2.3959, 48.8482, 'IDFM:1'),
  ];

  it('resolves platforms to their station and reads the UIC code', () => {
    const out = servedStations(
      stops,
      new Set(['StopPoint:OCETrain TER-87757724', 'StopPoint:OCECar TER-87757724']),
    );
    expect([...out.values()]).toEqual([
      { name: 'Grasse', coord: [6.925549, 43.653344], uic: '87757724' },
    ]);
  });

  it('ignores a station whose only calls are by coach', () => {
    expect(servedStations(stops, new Set(['StopPoint:OCECar TER-87615260'])).size).toBe(0);
  });

  it('accepts feeds without UIC codes', () => {
    expect([...servedStations(stops, new Set(['IDFM:q1'])).values()]).toEqual([
      { name: 'Nation', coord: [2.3959, 48.8482], uic: null },
    ]);
  });
});

describe('nameKey', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(nameKey('Massy - Palaiseau')).toBe(nameKey('Massy-Palaiseau'));
    expect(nameKey('Étampes')).toBe('etampes');
  });
});

describe('mergeStations', () => {
  const register = [
    // The register still places Grasse in Marseille.
    { uic: '87757724', commune: 'MARSEILLE', coord: [5.3806, 43.3027] },
    { uic: '87751008', commune: 'MARSEILLE', coord: [5.3806, 43.3027] },
    { uic: '87393579', commune: 'MASSY', coord: [2.2585, 48.7246] },
  ];

  it('never takes a commune from a register row far from the station', () => {
    const [grasse] = mergeStations(
      [[{ name: 'Grasse', coord: [6.9255, 43.6533], uic: '87757724' }]],
      register,
    );
    expect(grasse.commune).toBeNull();
  });

  it('takes the commune of a nearby register row', () => {
    const [stc] = mergeStations(
      [[{ name: 'Marseille Saint-Charles', coord: [5.3804, 43.3027], uic: '87751008' }]],
      register,
    );
    expect(stc.commune).toBe('MARSEILLE');
  });

  it('merges a later source into the station it shares a UIC, a spot or a name with', () => {
    const sncf = [{ name: 'Massy-Palaiseau', coord: [2.2585, 48.7246], uic: '87393579' }];
    const transilien = [
      // 240 m away, same name once normalised.
      { name: 'Massy - Palaiseau', coord: [2.2615, 48.7253], uic: null },
      // A different station 250 m from another: kept.
      { name: 'Massy - Verrières', coord: [2.2585, 48.727], uic: null },
    ];
    const listed = [
      { name: 'Massy Palaiseau', coord: [2.26, 48.73], uics: ['87393579', '87393580'] },
    ];
    const out = mergeStations([sncf, transilien, listed], register);
    expect(out.map((s) => s.name)).toEqual(['Massy-Palaiseau', 'Massy - Verrières']);
  });

  it('keeps two stations of one source 250 m apart, but collapses co-located ones', () => {
    const sncf = [
      { name: 'Auber', coord: [2.3292, 48.8723], uic: '87271007' },
      { name: 'Haussmann Saint-Lazare', coord: [2.3258, 48.8737], uic: '87381137' },
      { name: 'Ancenis Bis', coord: [-1.1773, 47.3687], uic: '87481192' },
      { name: 'Ancenis', coord: [-1.1773, 47.3687], uic: '87481193' },
    ];
    expect(mergeStations([sncf], []).map((s) => s.name)).toEqual([
      'Auber',
      'Haussmann Saint-Lazare',
      'Ancenis',
    ]);
  });

  it('leaves out stations outside France', () => {
    const sncf = [{ name: 'Genève', coord: [6.1423, 46.2104], uic: '85010082' }];
    expect(mergeStations([sncf], [])).toEqual([]);
  });
});

describe('toFeatures', () => {
  it('writes sorted points with name, commune and UIC', () => {
    const out = toFeatures([
      { name: 'Ranguin', coord: [6.9693134, 43.5691636], uic: '87757732', commune: 'MOUGINS' },
      { name: 'Grasse', coord: [6.925549, 43.653344], uic: '87757724', commune: 'GRASSE' },
    ]);
    expect(out.map((f) => f.properties.name)).toEqual(['Grasse', 'Ranguin']);
    expect(out[1]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [6.96931, 43.56916] },
      properties: { name: 'Ranguin', commune: 'MOUGINS', code_uic: '87757732' },
    });
  });
});
