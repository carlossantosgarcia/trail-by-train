import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBasemap, writeBasemap } from './basemapStorage';
import { DEFAULT_BASE_LAYER_ID } from '../layers/ignBaseLayers';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('basemap storage', () => {
  it('starts on the default, and returns the basemap last written', () => {
    const localStorage = fakeStorage();
    vi.stubGlobal('window', { localStorage });
    expect(readBasemap()).toBe(DEFAULT_BASE_LAYER_ID);
    writeBasemap('opentopo');
    expect(localStorage.data.get('hp.basemap')).toBe('opentopo');
    expect(readBasemap()).toBe('opentopo');
  });

  it('falls back to the default for a basemap that no longer exists', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage({ 'hp.basemap': 'scan25' }) });
    expect(readBasemap()).toBe(DEFAULT_BASE_LAYER_ID);
  });

  it('treats unusable storage as nothing saved, without throwing', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    vi.stubGlobal('window', { localStorage: throwing });
    expect(readBasemap()).toBe(DEFAULT_BASE_LAYER_ID);
    expect(() => writeBasemap('street')).not.toThrow();
  });
});
