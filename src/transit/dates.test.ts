import { describe, expect, it } from 'vitest';
import { daysUntil, todayInFrance } from './dates';

describe('daysUntil', () => {
  // 31 October 2026 is a Saturday in CET (UTC+1).
  const last = '2026-10-31';

  it('keeps a feed valid all through its last day, in French time', () => {
    expect(daysUntil(last, new Date('2026-10-30T23:30:00Z'))).toBe(0); // 00:30 in Paris
    expect(daysUntil(last, new Date('2026-10-31T11:00:00Z'))).toBe(0); // noon
    expect(daysUntil(last, new Date('2026-10-31T22:30:00Z'))).toBe(0); // 23:30
  });

  it('calls it expired from the next day', () => {
    expect(daysUntil(last, new Date('2026-10-31T23:30:00Z'))).toBe(-1); // 00:30 on 1 Nov
  });

  it('counts whole days ahead', () => {
    expect(daysUntil(last, new Date('2026-10-01T09:00:00Z'))).toBe(30);
  });

  it('reads today in France, not in UTC', () => {
    expect(todayInFrance(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15'); // CEST
  });
});
