import { afterEach, describe, expect, it, vi } from 'vitest';
import { TUTORIAL_VERSION, readTutorialSeen, writeTutorialSeen } from './tutorialStorage';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('tutorial storage', () => {
  it('is unseen in a fresh browser, and seen once written', () => {
    const localStorage = fakeStorage();
    vi.stubGlobal('window', { localStorage });
    expect(readTutorialSeen()).toBe(false);
    writeTutorialSeen();
    expect(localStorage.data.get('tutorial.seen')).toBe(String(TUTORIAL_VERSION));
    expect(readTutorialSeen()).toBe(true);
  });

  it('shows again when an older version was seen', () => {
    vi.stubGlobal('window', {
      localStorage: fakeStorage({ 'tutorial.seen': String(TUTORIAL_VERSION - 1) }),
    });
    expect(readTutorialSeen()).toBe(false);
  });

  it('treats unusable storage as unseen without throwing', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    vi.stubGlobal('window', { localStorage: throwing });
    expect(readTutorialSeen()).toBe(false);
    expect(() => writeTutorialSeen()).not.toThrow();
  });
});
