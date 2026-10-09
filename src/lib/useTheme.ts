// Reading design tokens from JavaScript.
//
// Most chrome consumes tokens through CSS, but a few things are drawn by
// libraries that need literal colour strings — uPlot's axes and series, for
// one. Those read the computed custom property instead of hard-coding a hex,
// and re-read it when the theme changes.

import { useEffect, useState } from 'react';
import type { ResolvedTheme } from './themeStorage';

/**
 * Current value of a design token, e.g. `readToken('--ink')`.
 * Returns `fallback` before first paint or if the token is unknown.
 */
export function readToken(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * The theme actually on screen, tracked via the `data-theme` attribute that
 * index.html stamps and themeStorage updates. Use it as an effect dependency
 * so canvas-drawn chrome rebuilds when the palette flips.
 */
export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(el.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
