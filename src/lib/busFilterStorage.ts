export type DayFilter = 'any' | 'weekday' | 'saturday' | 'sunday';

const DAY_KEY = 'hp:bus-day-filter';
const LOW_FREQ_KEY = 'hp:bus-hide-low-freq';
const SHOW_ARCHIVED_KEY = 'hp:bus-show-archived';

const DAY_DEFAULT: DayFilter = 'any';
const LOW_FREQ_DEFAULT = false;
// Lines the feed has stopped publishing are shown by default: a bus that ran
// last winter is still evidence a trailhead is reachable. They are drawn
// dashed and faded, and the popup says when we last saw them.
const SHOW_ARCHIVED_DEFAULT = true;

const DAY_VALUES: readonly DayFilter[] = ['any', 'weekday', 'saturday', 'sunday'];

export function readDayFilter(): DayFilter {
  try {
    const raw = window.localStorage.getItem(DAY_KEY);
    if (raw && (DAY_VALUES as readonly string[]).includes(raw)) return raw as DayFilter;
    return DAY_DEFAULT;
  } catch {
    return DAY_DEFAULT;
  }
}

export function writeDayFilter(value: DayFilter): void {
  try {
    window.localStorage.setItem(DAY_KEY, value);
  } catch {
    // Storage unavailable — runtime state remains authoritative.
  }
}

export function readHideLowFreq(): boolean {
  try {
    const raw = window.localStorage.getItem(LOW_FREQ_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return LOW_FREQ_DEFAULT;
  } catch {
    return LOW_FREQ_DEFAULT;
  }
}

export function writeHideLowFreq(value: boolean): void {
  try {
    window.localStorage.setItem(LOW_FREQ_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable.
  }
}

export function readShowArchived(): boolean {
  try {
    const raw = window.localStorage.getItem(SHOW_ARCHIVED_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return SHOW_ARCHIVED_DEFAULT;
  } catch {
    return SHOW_ARCHIVED_DEFAULT;
  }
}

export function writeShowArchived(value: boolean): void {
  try {
    window.localStorage.setItem(SHOW_ARCHIVED_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable.
  }
}
