import { describe, expect, it } from 'vitest';
import {
  legacyServiceDays,
  serviceDays,
  stopServiceDays,
  trimServiceStats,
} from '../lib/service-days.mjs';

function ymd(d) {
  return d.toISOString().slice(0, 10).replaceAll('-', '');
}

// Dates from 2026-09-07 (a Monday) for `weeks` weeks, on the given days (0 = Monday).
function dates(weeks, days) {
  const out = [];
  for (let w = 0; w < weeks; w += 1) {
    for (const d of days) out.push(ymd(new Date(Date.UTC(2026, 8, 7 + w * 7 + d))));
  }
  return out;
}

function mask(...services) {
  const windows = new Map(
    services.map((ds, i) => [
      `s${i}`,
      { weekday: new Set(ds), saturday: new Set(), sunday: new Set() },
    ]),
  );
  return serviceDays(
    services.map((_, i) => ({ service_id: `s${i}` })),
    windows,
  );
}

describe('serviceDays', () => {
  it('reads a Monday-to-Friday line', () => {
    expect(mask(dates(20, [0, 1, 2, 3, 4]))).toBe('1111100');
  });

  it('drops a single Saturday in a year of weekdays', () => {
    expect(mask(dates(40, [0, 1, 2, 3, 4]), dates(1, [5]))).toBe('1111100');
  });

  it('keeps a summer of Saturdays', () => {
    expect(mask(dates(52, [0, 1, 2, 3, 4]), dates(9, [5]))).toBe('1111110');
  });

  it('keeps a day the line runs every week of a short feed', () => {
    expect(mask(dates(2, [5, 6]))).toBe('0000011');
  });

  it('reads a Wednesday-only line', () => {
    expect(mask(dates(30, [2]))).toBe('0010000');
  });
});

describe('stopServiceDays', () => {
  it('keeps the patterns no other covers', () => {
    expect(stopServiceDays(['1111100', '0000011', '1111100', '0010000'])).toBe('1111100,0000011');
  });

  it('keeps a single pattern as is', () => {
    expect(stopServiceDays(['1111111', '1111100'])).toBe('1111111');
  });
});

describe('legacy and stats', () => {
  it('maps the old flags', () => {
    expect(legacyServiceDays({ runs_weekday: true, runs_saturday: false, runs_sunday: true })).toBe(
      '1111101',
    );
  });

  it('drops the day types the mask excludes', () => {
    const s = { weekday: { trips: 4 }, saturday: { trips: 1 }, sunday: null };
    expect(trimServiceStats(s, '1111100')).toEqual({
      weekday: { trips: 4 },
      saturday: null,
      sunday: null,
    });
  });
});
