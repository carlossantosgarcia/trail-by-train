import { describe, expect, it } from 'vitest';
import { updateRefreshStatus } from '../build.mjs';
import { classifyProviders, renderReport, staleProviders } from '../report-stale.mjs';

const ok = (id) => ({ id, status: 'rebuilt' });
const failed = (id, error = 'HTTP 404') => ({ id, status: 'failed', error });
const day = (d) => new Date(`2026-10-${d}T04:00:00Z`);

describe('updateRefreshStatus', () => {
  it('counts consecutive failures and remembers the last success', () => {
    let s = updateRefreshStatus(null, [ok('a')], day('05'));
    s = updateRefreshStatus(s, [failed('a')], day('12'));
    s = updateRefreshStatus(s, [failed('a', 'unzip exited 11')], day('19'));
    expect(s.providers.a).toMatchObject({
      last_success: '2026-10-05',
      last_attempt: '2026-10-19',
      consecutive_failures: 2,
      last_error: 'unzip exited 11',
    });
  });

  it('resets once a refresh succeeds', () => {
    let s = updateRefreshStatus(null, [failed('a')], day('05'));
    s = updateRefreshStatus(s, [ok('a')], day('12'));
    expect(s.providers.a).toMatchObject({ consecutive_failures: 0, last_error: null });
  });

  it('keeps providers that were not part of this run', () => {
    let s = updateRefreshStatus(null, [ok('a'), ok('b')], day('05'));
    s = updateRefreshStatus(s, [failed('a')], day('12'));
    expect(s.providers.b.last_success).toBe('2026-10-05');
  });
});

describe('staleProviders', () => {
  it('flags three failures in a row', () => {
    let s = null;
    for (const d of ['05', '12', '19']) s = updateRefreshStatus(s, [failed('a')], day(d));
    expect(staleProviders(s, day('19')).map((p) => p.id)).toEqual(['a']);
  });

  it('flags a failing provider with no success for over three weeks', () => {
    const s = {
      providers: { a: { last_success: '2026-09-01', consecutive_failures: 1, last_error: 'x' } },
    };
    expect(staleProviders(s, day('05')).map((p) => p.id)).toEqual(['a']);
  });

  it('does not mistake a first failure with no history for a long outage', () => {
    const s = updateRefreshStatus(null, [failed('a')], day('09'));
    expect(staleProviders(s, day('09'))).toEqual([]);
  });

  it('leaves a single recent failure alone', () => {
    let s = updateRefreshStatus(null, [ok('a')], day('05'));
    s = updateRefreshStatus(s, [failed('a')], day('12'));
    expect(staleProviders(s, day('12'))).toEqual([]);
  });
});

describe('out of season and warnings', () => {
  const dormant = (id, since) => ({ id, status: 'dormant', dormantSince: since });
  const shrank = (id) => ({ id, status: 'rebuilt', warning: 'feed shrank from 21 to 2 lines' });

  it('counts no failure for a network between seasons', () => {
    let s = null;
    for (const d of ['05', '12', '19', '26'])
      s = updateRefreshStatus(s, [dormant('a', '2026-10-05')], day(d));
    expect(s.providers.a).toMatchObject({ consecutive_failures: 0, dormant_since: '2026-10-05' });
    expect(classifyProviders(s, day('26'))).toMatchObject({
      broken: [],
      toCheck: [],
      outOfSeason: [{ id: 'a' }],
    });
  });

  it('raises a network out of season for over 13 months', () => {
    const s = updateRefreshStatus(null, [dormant('a', '2025-09-01')], day('05'));
    expect(classifyProviders(s, day('05')).broken.map((p) => p.id)).toEqual(['a']);
  });

  it('clears out of season once the network rebuilds', () => {
    let s = updateRefreshStatus(null, [dormant('a', '2026-10-05')], day('05'));
    s = updateRefreshStatus(s, [ok('a')], day('12'));
    expect(s.providers.a.dormant_since).toBeNull();
  });

  it('keeps a warning for three weeks, then drops it from the report', () => {
    let s = updateRefreshStatus(null, [shrank('a')], day('01'));
    s = updateRefreshStatus(s, [ok('a')], day('08'));
    expect(classifyProviders(s, day('08')).toCheck.map((p) => p.id)).toEqual(['a']);
    expect(classifyProviders(s, new Date('2026-10-23T04:00:00Z')).toCheck).toEqual([]);
  });

  it('files only broken feeds; warnings and out of season go to the summary', () => {
    const s = updateRefreshStatus(null, [dormant('a', '2026-10-05'), shrank('b')], day('05'));
    const groups = classifyProviders(s, day('05'));
    expect(renderReport(groups)).toBe('');
    const summary = renderReport(groups, { summary: true });
    expect(summary).toContain('out of season');
    expect(summary).toContain('to check with the operator');
  });
});
