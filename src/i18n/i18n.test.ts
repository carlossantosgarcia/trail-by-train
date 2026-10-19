import { describe, expect, it } from 'vitest';
import { detectLocale, t } from './index';
import { fr } from './fr';
import { en } from './en';

describe('detectLocale', () => {
  it('takes the first French or English preference', () => {
    expect(detectLocale(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLocale(['de-DE', 'en-GB', 'fr'])).toBe('en');
    expect(detectLocale(['FR-ca'])).toBe('fr');
  });

  it('falls back to English for any other language', () => {
    expect(detectLocale(['de-DE', 'it'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('t', () => {
  it('fills placeholders and leaves unknown ones as written', () => {
    expect(t('fresh.lastUpdate', { date: '02/08/2026' })).toBe('Dernière mise à jour : 02/08/2026');
    expect(t('fresh.lastUpdate')).toBe('Dernière mise à jour : {date}');
  });

  it('words plurals by count', () => {
    expect(t('transit.lines', { n: 1 })).toBe('1 ligne');
    expect(t('transit.lines', { n: 3 })).toBe('3 lignes');
  });
});

describe('dictionaries', () => {
  it('give every message in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const [k, v] of Object.entries(en)) {
      const s = typeof v === 'function' ? v({ n: 2 }) : v;
      expect(s.trim(), k).not.toBe('');
    }
  });

  it('keep the same placeholders in both', () => {
    const names = (m: unknown) =>
      typeof m === 'string' ? [...m.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort() : [];
    for (const k of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(names(en[k]), k).toEqual(names(fr[k]));
    }
  });
});
