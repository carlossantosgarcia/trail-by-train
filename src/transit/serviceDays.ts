// Days of the week, as the build writes them (scripts/transit/lib/service-days.mjs):
// a 7-character mask, Monday first, "1111100" for Monday to Friday. A stop
// carries one mask per distinct pattern of its lines, comma-separated.
//
// The user's selection is a mask of the same shape, though the picker only
// offers Saturday and Sunday. A line passes when it runs on every selected day;
// nothing selected means no filter.

import type maplibregl from 'maplibre-gl';

export type DaySelection = string;

export const NO_DAYS: DaySelection = '0000000';
/** Masks a stop may carry before the build replaces them with their union. */
export const MAX_STOP_MASKS = 8;

export function isDaySelection(value: unknown): value is DaySelection {
  return typeof value === 'string' && /^[01]{7}$/.test(value);
}

/** Keeps Saturday and Sunday: the only days the picker offers. */
export function weekendOnly(sel: DaySelection): DaySelection {
  return `00000${sel.slice(5)}`;
}

export function selectedDays(sel: DaySelection): number[] {
  const out: number[] = [];
  for (let i = 0; i < 7; i += 1) if (sel[i] === '1') out.push(i);
  return out;
}

export function toggleDay(sel: DaySelection, day: number): DaySelection {
  return sel.slice(0, day) + (sel[day] === '1' ? '0' : '1') + sel.slice(day + 1);
}

/**
 * Whether a line or stop with these masks runs on every selected day. Data
 * built before masks existed has none and always passes.
 */
export function runsOnSelected(masks: string | null | undefined, sel: DaySelection): boolean {
  const days = selectedDays(sel);
  if (days.length === 0 || !masks) return true;
  return masks.split(',').some((m) => days.every((d) => m[d] === '1'));
}

/**
 * The same test as a MapLibre filter. Each mask takes 8 characters (7 days and
 * a comma), so mask j's day d sits at j*8+d; past the end, `slice` gives ''.
 */
export function daysPredicate(
  sel: DaySelection,
  maxMasks: number,
): maplibregl.FilterSpecification | null {
  const days = selectedDays(sel);
  if (days.length === 0) return null;
  const masks = ['coalesce', ['get', 'service_days'], '1111111'];
  const perMask = Array.from({ length: maxMasks }, (_, j) => [
    'all',
    ...days.map((d) => ['==', ['slice', masks, j * 8 + d, j * 8 + d + 1], '1']),
  ]);
  return (maxMasks === 1
    ? perMask[0]
    : ['any', ...perMask]) as unknown as maplibregl.FilterSpecification;
}
