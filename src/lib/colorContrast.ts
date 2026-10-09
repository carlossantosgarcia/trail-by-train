// Pick a legible text colour for a coloured background ("pill"). Used by the
// Explore route-number labels and the transit line chips, both of which draw a
// route number on a halo of the line's colour — dark numbers vanish on dark
// pills. Kept in src/lib (not a feature) so transit and features can share it.

/** Dark text colour for light pills. */
export const CONTRAST_DARK = '#0f172a';
/** Light text colour for dark pills. */
export const CONTRAST_LIGHT = '#ffffff';
/**
 * Normalized (0–1) relative-luminance cut-off. Biased slightly above the 0.5
 * midpoint so borderline mid-tones get white text, which is the safer choice
 * against the thin coloured halo. Single knob — retune here if the palette
 * gains lighter or darker entries.
 */
export const LUMINANCE_THRESHOLD = 0.55;

/** Parse `#rgb` or `#rrggbb` into [r, g, b] (0–255), or null if unparseable. */
function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Choose a dark or light text colour for a route number drawn on `hex`, based
 * on the pill's perceived (Rec. 709) luminance. Light pills → dark text; dark
 * pills → white text. Falls back to dark text for an unparseable colour.
 */
export function textColorFor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return CONTRAST_DARK;
  const [r, g, b] = rgb;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > LUMINANCE_THRESHOLD ? CONTRAST_DARK : CONTRAST_LIGHT;
}

/**
 * WCAG 2.1 relative luminance. Distinct from the Rec. 709 approximation
 * `textColorFor` uses above: that one is tuned for picking legible text on a
 * transit pill and is deliberately left alone, since retuning it would change
 * how every route label renders. This one is the real thing, used by the
 * contrast gate in scripts/check-contrast.mjs.
 */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two opaque colours, 1–21. Returns null if
 * either colour is unparseable.
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Composite a translucent colour over an opaque backdrop, returning the
 * opaque result. Chrome in this app is translucent over map tiles, so
 * contrast has to be measured against what the eye actually sees.
 */
export function compositeOver(fg: string, alpha: number, backdrop: string): string | null {
  const f = parseHex(fg);
  const b = parseHex(backdrop);
  if (!f || !b) return null;
  const mix = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
