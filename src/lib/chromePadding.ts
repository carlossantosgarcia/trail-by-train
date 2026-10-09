// Map fit padding, derived from the chrome geometry rather than guessed.
//
// `fitBounds` frames a feature inside the *canvas*, which spans the whole
// viewport — including the area the docks cover. Padding those edges is what
// stops a track being fitted underneath the panel that describes it.
//
// The numbers come from the same custom properties the panels position
// themselves with (see src/tokens.css), so moving a dock moves the padding
// with it instead of leaving a stale literal behind.

import { readToken } from './useTheme';

/** Parse a px-valued token, falling back if it's unset or non-px. */
function px(name: string, fallback: number): number {
  const raw = readToken(name);
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && raw.endsWith('px') ? n : fallback;
}

function isMobile(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${px('--bp-mobile', 768)}px)`).matches
  );
}

export interface FitPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Padding that clears the app's chrome on the current viewport.
 *
 * `extra` adds breathing room on every edge for callers that want the feature
 * comfortably inside the frame rather than flush against the chrome.
 */
export function fitPadding(extra = 24): FitPadding {
  const gap = px('--dock-gap', 12);
  const dockW = px('--dock-w', 264);

  if (isMobile()) {
    // Docks are narrow overlays on mobile; the bottom sheet is what actually
    // eats the viewport, so the weight goes there.
    return {
      top: gap + 56 + extra,
      right: gap + extra,
      bottom: px('--sheet-peek', 56) + 44 + extra,
      left: gap + extra,
    };
  }

  return {
    // Left: the Tracks dock. Right: the controls panel, same width.
    top: gap + extra,
    right: gap + dockW + extra,
    bottom: px('--metrics-dock-h', 168) + extra,
    left: gap + dockW + extra,
  };
}
