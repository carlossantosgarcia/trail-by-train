import { describe, expect, it } from 'vitest';
import { daysPredicate, runsOnSelected, toggleDay, weekendOnly, NO_DAYS } from './serviceDays';

describe('runsOnSelected', () => {
  it('passes everything when nothing is selected', () => {
    expect(runsOnSelected('0000000', NO_DAYS)).toBe(true);
  });

  it('needs every selected day', () => {
    expect(runsOnSelected('1111110', '0000011')).toBe(false);
    expect(runsOnSelected('1111111', '0000011')).toBe(true);
  });

  it('passes a stop when one of its patterns has every selected day', () => {
    expect(runsOnSelected('1111100,0000011', '0000011')).toBe(true);
    expect(runsOnSelected('1111110,0000001', '0000011')).toBe(false);
  });

  it('passes data built before masks', () => {
    expect(runsOnSelected(undefined, '0000011')).toBe(true);
  });
});

describe('daysPredicate', () => {
  it('is null with nothing selected', () => {
    expect(daysPredicate(NO_DAYS, 1)).toBeNull();
  });

  it('reads the second mask at offset 8', () => {
    const p = daysPredicate(toggleDay(NO_DAYS, 6), 2) as unknown[];
    expect(JSON.stringify(p)).toContain('14,15');
  });
});

describe('weekendOnly', () => {
  it('drops weekdays from a stored selection', () => {
    expect(weekendOnly('0010001')).toBe('0000001');
    expect(weekendOnly('1111100')).toBe(NO_DAYS);
  });
});
