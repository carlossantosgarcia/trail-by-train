// How much to trust a line that is no longer in its feed.
//
// A GTFS feed only publishes the offer of the moment, so lines disappear from
// it routinely — a winter shuttle is simply absent all summer. We keep those
// lines on the map (see scripts/transit/lib/ledger.mjs) and let the reader
// judge them by a single observable fact: how long ago we last saw the line in
// a published feed.
//
// This deliberately replaces the old "seasonal" flag, which guessed at a
// line's nature from a short active-date window. That guess could not
// distinguish a genuinely winter-only line from a feed with a short
// publication horizon, and misfired on entire networks. An observation date
// makes no claim it cannot support.
//
// The age is computed when the map is drawn rather than baked into the tiles,
// so the wording cannot itself go stale between rebuilds.

const MS_PER_DAY = 86400000;

export type FreshnessTier = 'current' | 'recent' | 'uncertain' | 'stale';

export interface Freshness {
  tier: FreshnessTier;
  /** Whole days since the line was last seen in a feed; null if unknown. */
  ageDays: number | null;
  /** Short French label for badges. */
  label: string;
  /** Short caveat for the popup; null when the line is current. The date is
   *  not repeated here — the "Dernière mise à jour" pill carries it. */
  note: string | null;
}

/** Day thresholds between tiers. */
export const RECENT_DAYS = 90;
export const UNCERTAIN_DAYS = 365;

export function todayDayNumber(now: Date = new Date()): number {
  return Math.floor(now.getTime() / MS_PER_DAY);
}

function isoToFr(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : null;
}

/**
 * When did we last receive a feed carrying this line?
 *
 * One pill answers this for both states. A line still published reports the
 * provider's last build; an archived one reports `last_seen_on`, the last build
 * whose feed still carried it. Either way the question is the same — how old is
 * what you are looking at — so it gets one answer, coloured by how old.
 *
 * Computed at render time, like every other age here: a baked "3 months ago" is
 * wrong by next quarter.
 */
export type UpdateTier = 'fresh' | 'recent' | 'ageing' | 'stale';

export interface LastUpdate {
  iso: string;
  ageDays: number;
  tier: UpdateTier;
  /** Pill text, e.g. "Dernière mise à jour : 02/08/2026". */
  label: string;
  /** "Horaires publiés jusqu'au …" when the feed declares an end date. */
  publishedUntil: string | null;
  /**
   * "Vérifié le …" — present only for a live line whose feed was confirmed
   * unchanged more recently than it was built. Null when the two coincide, so
   * a freshly rebuilt provider states one date rather than two.
   */
  checkedOn: string | null;
}

// A published timetable a month old is normal; a year old means nobody has
// rebuilt through a season change, which is exactly when bus offers move.
const FRESH_DAYS = 30;
const AGEING_DAYS = 90;
const STALE_DAYS = 365;

export function lastUpdateOf(
  line: {
    archived?: boolean;
    last_seen_on?: string | null;
    last_feed_valid_to?: string | null;
  },
  meta: {
    built_at?: string;
    last_checked_on?: string | null;
    feed_valid_to?: string | null;
  } | null,
  now: Date = new Date(),
): LastUpdate | null {
  const iso = line.archived ? (line.last_seen_on ?? null) : (meta?.built_at?.slice(0, 10) ?? null);
  if (!iso) return null;

  // What the pill *shows* is when this data was produced. What colours it is how
  // long ago we last confirmed the feed — for a live line those differ whenever
  // the publisher simply has not reissued an unchanged feed, and reddening on
  // the build date alone would report our own refresh schedule as the
  // operator's staleness.
  //
  // An archived line is exempt: it genuinely ages no matter how recently we
  // checked, because the feed has stopped carrying it.
  const checkedIso = line.archived ? null : (meta?.last_checked_on ?? null);
  const ageIso = checkedIso ?? iso;

  const day = Math.floor(Date.parse(`${ageIso}T00:00:00Z`) / MS_PER_DAY);
  if (!Number.isFinite(day)) return null;
  const ageDays = Math.max(0, todayDayNumber(now) - day);
  const tier: UpdateTier =
    ageDays <= FRESH_DAYS
      ? 'fresh'
      : ageDays <= AGEING_DAYS
        ? 'recent'
        : ageDays <= STALE_DAYS
          ? 'ageing'
          : 'stale';
  const validTo = line.archived ? (line.last_feed_valid_to ?? null) : (meta?.feed_valid_to ?? null);
  return {
    iso,
    ageDays,
    tier,
    label: `Dernière mise à jour : ${isoToFr(iso)}`,
    publishedUntil: validTo ? `Horaires publiés jusqu'au ${isoToFr(validTo)}` : null,
    checkedOn: checkedIso && checkedIso !== iso ? `Vérifié le ${isoToFr(checkedIso)}` : null,
  };
}

export function freshnessOf(
  line: { archived?: boolean; last_seen_day?: number | null; last_seen_on?: string | null },
  today: number = todayDayNumber(),
): Freshness {
  if (!line.archived) {
    return { tier: 'current', ageDays: 0, label: 'Horaire actuel', note: null };
  }

  const lastSeen = typeof line.last_seen_day === 'number' ? line.last_seen_day : null;
  const ageDays = lastSeen === null ? null : Math.max(0, today - lastSeen);

  if (ageDays === null) {
    return {
      tier: 'stale',
      ageDays: null,
      label: 'Hors horaire actuel',
      note: "Cette ligne n'est plus publiée par l'opérateur. À vérifier avant de partir.",
    };
  }

  const tier: FreshnessTier =
    ageDays <= RECENT_DAYS ? 'recent' : ageDays <= UNCERTAIN_DAYS ? 'uncertain' : 'stale';

  const note =
    tier === 'recent'
      ? "Cette ligne n'est pas dans l'horaire publié en ce moment."
      : tier === 'uncertain'
        ? "Cette ligne n'est plus publiée. Elle peut être saisonnière — rien ne garantit qu'elle circule à nouveau. À vérifier auprès de l'opérateur."
        : "Cette ligne n'est plus publiée depuis longtemps et a peut-être été supprimée. À vérifier auprès de l'opérateur.";

  return { tier, ageDays, label: 'Hors horaire actuel', note };
}
