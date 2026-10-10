import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A browser history with only what backStack touches. back() fires popstate
// asynchronously, as browsers do.
function fakeBrowser() {
  const entries: unknown[] = [null];
  let index = 0;
  const listeners: ((e: { state: unknown }) => void)[] = [];
  const pop = () => {
    for (const fn of listeners) fn({ state: entries[index] });
  };
  const history = {
    get state() {
      return entries[index];
    },
    pushState(state: unknown) {
      entries.splice(index + 1);
      entries.push(state);
      index += 1;
    },
    back() {
      if (index === 0) return;
      index -= 1;
      setTimeout(pop, 0);
    },
  };
  const window = {
    addEventListener: (_: string, fn: (e: { state: unknown }) => void) => listeners.push(fn),
  };
  return { history, window, length: () => index };
}

let browser: ReturnType<typeof fakeBrowser>;
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.resetModules();
  browser = fakeBrowser();
  vi.stubGlobal('history', browser.history);
  vi.stubGlobal('window', browser.window);
});
afterEach(() => vi.unstubAllGlobals());

describe('pushBack', () => {
  it('closes the topmost surface on back, and only that one', async () => {
    const { pushBack } = await import('./backStack');
    const closed: string[] = [];
    pushBack(() => closed.push('sheet'));
    pushBack(() => closed.push('line'));
    browser.history.back();
    await tick();
    expect(closed).toEqual(['line']);
    browser.history.back();
    await tick();
    expect(closed).toEqual(['line', 'sheet']);
  });

  it('consumes its entry when closed by other means', async () => {
    const { pushBack } = await import('./backStack');
    const close = vi.fn();
    const release = pushBack(close);
    expect(browser.length()).toBe(1);
    release();
    await tick();
    expect(browser.length()).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });

  it('does not close a surface released out of order', async () => {
    const { pushBack } = await import('./backStack');
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = pushBack(first);
    pushBack(second);
    releaseFirst();
    browser.history.back();
    await tick();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it('waits for its own back before pushing again', async () => {
    const { pushBack } = await import('./backStack');
    const release = pushBack(() => {});
    release();
    // Reopened before the back above has landed.
    const reopened = vi.fn();
    pushBack(reopened);
    await tick();
    expect(reopened).not.toHaveBeenCalled();
    expect(browser.length()).toBe(1);
    browser.history.back();
    await tick();
    expect(reopened).toHaveBeenCalledOnce();
  });
});
