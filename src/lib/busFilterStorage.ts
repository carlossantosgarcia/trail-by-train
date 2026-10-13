import { isDaySelection, NO_DAYS, weekendOnly, type DaySelection } from '../transit/serviceDays';

// A new key: the old one held a single day type ('weekday', 'saturday'…).
const DAY_KEY = 'hp:bus-days';
const SHOW_ARCHIVED_KEY = 'hp:bus-show-archived';

const DAY_DEFAULT: DaySelection = NO_DAYS;
// Lines the feed has stopped publishing are shown by default: a bus that ran
// last winter is still evidence a trailhead is reachable. They are drawn
// dashed and faded, and the popup says when we last saw them.
const SHOW_ARCHIVED_DEFAULT = true;

export function readDayFilter(): DaySelection {
  try {
    const raw = window.localStorage.getItem(DAY_KEY);
    // A weekday stored by an earlier picker is dropped.
    if (isDaySelection(raw)) return weekendOnly(raw);
    return DAY_DEFAULT;
  } catch {
    return DAY_DEFAULT;
  }
}

export function writeDayFilter(value: DaySelection): void {
  try {
    window.localStorage.setItem(DAY_KEY, value);
  } catch {
    // Storage unavailable — runtime state remains authoritative.
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
