// Which days of the week a line runs, as a 7-character mask, Monday first:
// "1111100" runs Monday to Friday. See openspec `public-transit`, "Days a line
// runs".
//
// A day counts when the line runs on it regularly: on at least MIN_DATES dates,
// or on at least half of the weeks the line runs at all. That drops one-off
// dates (a Saturday before the start of term, a single event) and keeps a
// season's worth of summer Saturdays, which is what a hiker plans around.

export const MIN_DATES = 4;
export const ALL_DAYS = '1111111';
// Stops keep a few masks (one per distinct pattern of their lines); past this
// many, their union stands in for them.
export const MAX_STOP_MASKS = 8;

function dowFromYmd(ymd) {
  const js = new Date(
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8))),
  ).getUTCDay();
  return (js + 6) % 7;
}

function weekKey(ymd) {
  // Monday of the date's week: enough to count distinct weeks.
  const t = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
  return t - dowFromYmd(ymd) * 86_400_000;
}

/** Mask of the days `routeTrips` run on, from the service windows' dates. */
export function serviceDays(routeTrips, serviceWindows) {
  const dates = new Set();
  for (const trip of routeTrips) {
    const sw = serviceWindows.get(trip.service_id);
    if (!sw) continue;
    for (const bucket of [sw.weekday, sw.saturday, sw.sunday]) for (const d of bucket) dates.add(d);
  }
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  const weeks = new Set();
  for (const d of dates) {
    perDay[dowFromYmd(d)] += 1;
    weeks.add(weekKey(d));
  }
  return perDay.map((n) => (n > 0 && (n >= MIN_DATES || 2 * n >= weeks.size) ? '1' : '0')).join('');
}

/** Mask for a line recorded before masks existed, from its old per-day-type flags. */
export function legacyServiceDays(p) {
  return (
    (p.runs_weekday === false ? '00000' : '11111') +
    (p.runs_saturday === false ? '0' : '1') +
    (p.runs_sunday === false ? '0' : '1')
  );
}

function covers(a, b) {
  for (let i = 0; i < 7; i += 1) if (b[i] === '1' && a[i] !== '1') return false;
  return true;
}

/**
 * A stop's masks: one per distinct pattern among its lines, leaving out any a
 * broader one covers, comma-separated. A stop passes a day filter when one of
 * them has every selected day. Past MAX_STOP_MASKS, their union.
 */
export function stopServiceDays(masks) {
  const distinct = [...new Set(masks)].sort().reverse();
  const kept = distinct.filter(
    (m, i) => !distinct.some((o, j) => j !== i && o !== m && covers(o, m)),
  );
  if (kept.length <= MAX_STOP_MASKS) return kept.join(',');
  return [0, 1, 2, 3, 4, 5, 6].map((i) => (kept.some((m) => m[i] === '1') ? '1' : '0')).join('');
}

/** Drop a day type's summary when the mask says the line does not run that way. */
export function trimServiceStats(stats, mask) {
  if (!stats) return stats;
  return {
    weekday: mask.slice(0, 5).includes('1') ? stats.weekday : null,
    saturday: mask[5] === '1' ? stats.saturday : null,
    sunday: mask[6] === '1' ? stats.sunday : null,
  };
}
