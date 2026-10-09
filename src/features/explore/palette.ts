// Categorical palette for Explore's per-line colouring. Carto Bold — a
// qualitative palette designed for maps, with good hue spread and no warm
// pile-up.

import type { ExploreProviderGroup } from './data';

export const CARTO_BOLD = [
  '#7F3C8D',
  '#11A579',
  '#3969AC',
  '#E73F74',
  '#80BA5A',
  '#008695',
  '#F2B701',
  '#E68310',
  '#CF1C90',
  '#f97b72',
  '#4b4b8f',
  '#A5AA99',
] as const;

/**
 * Assign a distinct palette colour to every matched line, in a deterministic
 * order (provider groups as given — registry order — then the lines within
 * each, already sorted by short name). Cycles when a region matches more lines
 * than the palette has colours; the repeated route number + tap-to-isolate
 * disambiguate the repeats. Mutates each line's `color` in place.
 */
export function assignLineColors(providers: ExploreProviderGroup[]): void {
  let i = 0;
  for (const provider of providers) {
    for (const line of provider.lines) {
      line.color = CARTO_BOLD[i % CARTO_BOLD.length];
      i += 1;
    }
  }
}
