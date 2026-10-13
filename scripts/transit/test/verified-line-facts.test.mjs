import { describe, expect, it, vi } from 'vitest';
import { applyVerifiedLineFact, VERIFIED_LINE_FACTS } from '../lib/verified-line-facts.mjs';

function route(id, shortName, days = '1111111') {
  return {
    route_id: id,
    route_short_name: shortName,
    service_days: days,
    reservation: 'unknown',
    reservation_detail: { message: 'Old feed detail' },
    service: { weekday: { trips: 1 }, saturday: { trips: 2 }, sunday: { trips: 3 } },
  };
}

describe('operator-verified line facts', () => {
  it('separates Aléop 102 from the Saturday reservation line R102', () => {
    const regular = route('102', '102');
    const demand = route('102-AD', 'R102');
    applyVerifiedLineFact('aleop', regular);
    applyVerifiedLineFact('aleop', demand);
    expect(regular.service_days).toBe('1111101');
    expect(regular.service.saturday).toBeNull();
    expect(regular.reservation).toBe('unknown');
    expect(demand.service_days).toBe('1111110');
    expect(demand.reservation).toBe('required');
    expect(demand.reservation_detail).toBeNull();
  });

  it('sets the documented weekday-only booking rule for BreizhGo 9611', () => {
    const line = route('239', '9611');
    applyVerifiedLineFact('breizhgo-car-29', line);
    expect(line.service_days).toBe('1111100');
    expect(line.reservation).toBe('required');
    expect(line.service.saturday).toBeNull();
    expect(line.service.sunday).toBeNull();
  });

  it('marks Aléop 214 as reservable even though only some pickup communes require it', () => {
    const line = route('214', '214');
    applyVerifiedLineFact('aleop', line);
    expect(line.service_days).toBe('1111110');
    expect(line.reservation).toBe('required');
  });

  it('keeps seasonal weekend service visible even when the current feed omits it', () => {
    const line = route('41', '41', '0010000');
    line.service.saturday = null;
    line.service.sunday = null;
    applyVerifiedLineFact('synchro-chambery', line);
    expect(line.service_days).toBe('1111111');
    expect(line.reservation).toBe('required');
    expect(line.service.saturday).toBeNull();
  });

  it('does not apply a route id to a different visible line', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const line = route('98', 'Other');
    expect(applyVerifiedLineFact('mreso-gresivaudan', line)).toBe(false);
    expect(line.service_days).toBe('1111111');
    expect(line.reservation).toBe('unknown');
    warn.mockRestore();
  });

  it('keeps every exception tied to an operator source', () => {
    expect(VERIFIED_LINE_FACTS.every((fact) => fact.source.startsWith('https://'))).toBe(true);
  });
});
