/**
 * Okabe–Ito categorical palette — colour-blind safe, 8 distinct entries.
 * Used to auto-assign distinct colours to newly loaded tracks.
 */
export const PALETTE: readonly string[] = [
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#009E73', // bluish green
  '#CC79A7', // reddish purple
  '#E69F00', // orange
  '#56B4E9', // sky blue
  '#F0E442', // yellow
  '#000000', // black
] as const;

/** Pick the next palette colour that isn't already in use, cycling if needed. */
export function nextColour(existing: readonly string[]): string {
  const used = new Set(existing);
  for (const c of PALETTE) {
    if (!used.has(c)) return c;
  }
  // All taken — fall back to indexing by count modulo palette length.
  return PALETTE[existing.length % PALETTE.length];
}

/**
 * Pick `count` palette colours, each distinct from `existing` and from the
 * other picks in the same call (up to palette size). Cycling behaviour
 * matches `nextColour` once the palette is exhausted.
 *
 * Pure function — call once at the entry point of a batch add to pre-reserve
 * colours, then hand each parser task its own colour. Avoids the race where
 * parallel `nextColour(state.tracks…)` calls all see the same snapshot.
 */
export function nextNColours(existing: readonly string[], count: number): string[] {
  const accumulator = [...existing];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const colour = nextColour(accumulator);
    result.push(colour);
    accumulator.push(colour);
  }
  return result;
}
