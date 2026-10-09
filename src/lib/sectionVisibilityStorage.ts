const TRAINS_KEY = 'hp:trains-section-visible';
const BUSES_KEY = 'hp:buses-section-visible';

function read(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Storage unavailable.
  }
}

// Trains default ON — the section eye gates section-wide visibility, so
// the per-overlay toggles (rail network on by default, stations shown
// whenever the network is) are immediately effective on first paint.
export function readTrainsSectionVisible(): boolean {
  return read(TRAINS_KEY, true);
}

export function writeTrainsSectionVisible(value: boolean): void {
  write(TRAINS_KEY, value);
}

// Buses default ON — selecting providers should show them; hiding is opt-in.
export function readBusesSectionVisible(): boolean {
  return read(BUSES_KEY, true);
}

export function writeBusesSectionVisible(value: boolean): void {
  write(BUSES_KEY, value);
}
