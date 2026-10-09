import { describe, expect, it } from 'vitest';
import { buildServiceWindowsByDayType, computeRouteServiceStats } from '../lib/gtfs.mjs';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const weekdays = Object.fromEntries(DAYS.map((d, i) => [d, i < 5 ? '1' : '0']));

describe('buildServiceWindowsByDayType', () => {
  // Week of Monday 2 to Sunday 8 November 2026.
  const calendar = [{ service_id: 'WK', start_date: '20261102', end_date: '20261108', ...weekdays }];

  it('buckets a weekday service by day type', () => {
    const sw = buildServiceWindowsByDayType(calendar, []).get('WK');
    expect(sw.weekday.size).toBe(5);
    expect(sw.saturday.size).toBe(0);
    expect(sw.sunday.size).toBe(0);
  });

  it('applies removed and added dates from calendar_dates', () => {
    const exceptions = [
      { service_id: 'WK', date: '20261111', exception_type: '1' }, // outside the window, added
      { service_id: 'WK', date: '20261103', exception_type: '2' }, // removed
      { service_id: 'WK', date: '20261108', exception_type: '1' }, // a Sunday, added
    ];
    const sw = buildServiceWindowsByDayType(calendar, exceptions).get('WK');
    expect(sw.weekday.has('20261103')).toBe(false);
    expect(sw.weekday.has('20261111')).toBe(true);
    expect(sw.sunday.has('20261108')).toBe(true);
    expect(sw.windowEnd).toBe('20261111');
  });

  it('supports feeds that only use calendar_dates', () => {
    const sw = buildServiceWindowsByDayType([], [
      { service_id: 'X', date: '20261107', exception_type: '1' },
    ]).get('X');
    expect(sw.saturday.has('20261107')).toBe(true);
  });
});

describe('computeRouteServiceStats', () => {
  const service = new Map([
    ['WK', { weekday: new Set(['20261102']), saturday: new Set(), sunday: new Set() }],
  ]);
  const trip = (id) => ({ trip_id: id, service_id: 'WK' });

  it('sorts departures by time, including unpadded hours', () => {
    const first = new Map([
      ['a', { departure_time: '10:00:00' }],
      ['b', { departure_time: '9:05:00' }],
      ['c', { departure_time: '18:30:00' }],
    ]);
    const s = computeRouteServiceStats([trip('a'), trip('b'), trip('c')], first, service);
    expect(s.weekday).toMatchObject({ firstDep: '09:05', lastDep: '18:30', trips: 3 });
  });

  it('reports no service as null, not as an empty window', () => {
    const first = new Map([['a', { departure_time: '07:00:00' }]]);
    const s = computeRouteServiceStats([trip('a')], first, service);
    expect(s.saturday).toBeNull();
    expect(s.sunday).toBeNull();
  });

  it('wraps times past midnight onto the clock', () => {
    const first = new Map([['a', { departure_time: '25:10:00' }]]);
    expect(computeRouteServiceStats([trip('a')], first, service).weekday.firstDep).toBe('01:10');
  });
});
