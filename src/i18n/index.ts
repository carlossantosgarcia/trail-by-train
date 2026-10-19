// The interface language: French or English.
//
// No library: two flat dictionaries, `fr` being the reference and `en` typed
// against it, so a key missing from either fails the type check. Components
// read strings with `useT()`, which also re-renders them when the language
// changes; code outside React calls `t()` when it builds its DOM, so a popup
// opened after a switch is in the new language.
//
// Only the interface is translated. Data — line and stop names, hike titles,
// operator notes — is shown as published.

import { useSyncExternalStore } from 'react';
import { fr, type Messages, type Params } from './fr';
import { en } from './en';

export type Locale = 'fr' | 'en';
export const LOCALES: readonly Locale[] = ['fr', 'en'];
export type MessageKey = keyof Messages;

const KEY = 'hp.lang';
const DICTS: Record<Locale, Messages> = { fr, en };

function isLocale(v: unknown): v is Locale {
  return v === 'fr' || v === 'en';
}

/** The browser's first French or English preference; English otherwise. */
export function detectLocale(languages: readonly string[]): Locale {
  for (const l of languages) {
    const base = l.toLowerCase().slice(0, 2);
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function readLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* fall through to detection */
  }
  const nav = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return detectLocale(nav.filter(Boolean));
}

let locale: Locale = typeof window === 'undefined' ? 'fr' : readLocale();
const listeners = new Set<() => void>();

function stamp(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = t('app.title');
}

export function getLocale(): Locale {
  return locale;
}

export function setLocale(value: Locale): void {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* the choice lasts for this visit only */
  }
  if (value === locale) return;
  locale = value;
  stamp();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, () => locale);
}

/** A message in the current language, `{name}` placeholders filled from `params`. */
export function t(key: MessageKey, params: Params = {}): string {
  const m = DICTS[locale][key] ?? fr[key];
  const s = typeof m === 'function' ? m(params) : m;
  return s.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in params ? String(params[name]) : all,
  );
}

/** `t`, re-rendering the calling component when the language changes. */
export function useT(): typeof t {
  useLocale();
  return t;
}

/** BCP 47 tag for Intl formatting in the current language. */
export function intlLocale(): string {
  return locale === 'fr' ? 'fr-FR' : 'en-GB';
}

stamp();

/** A YYYY-MM-DD calendar date: 17/10/2026 in French, 17 Oct 2026 in English. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (locale === 'fr') return `${d}/${m}/${y}`;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
