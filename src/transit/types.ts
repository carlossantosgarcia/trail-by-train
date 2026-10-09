// Runtime types for the public-transit overlay. The build-time pipeline
// emits GeoJSON whose feature.properties match the shapes below; the
// popup renders directly from these, with no provider-specific branching.

export interface ServiceWindow {
  firstDep: string;
  lastDep: string;
  trips: number;
  avgGapMin: number;
}

/**
 * Does this line have to be booked ahead?
 *
 * Three states, because a boolean could not tell "nobody needs to book" apart
 * from "the feed says nothing" — and the popup only rendered a badge when true,
 * so 99% of lines silently read as "just turn up". `unknown` is the default;
 * `not_required` needs a feed that demonstrably models booking. See
 * scripts/transit/lib/reservation.mjs.
 */
export type ReservationStatus = 'required' | 'not_required' | 'unknown';

/** How to book, when the answer is `required` and the feed says how. */
export interface ReservationDetail {
  message: string | null;
  phone: string | null;
  url: string | null;
  deadline: string | null;
}

export interface TransitLineProperties {
  provider_id: string;
  /**
   * One Feature per route. Its geometry is the dissolved union of all the
   * route's GTFS shape variants (a LineString, or a MultiLineString when the
   * route forks). See openspec change union-transit-route-geometry.
   */
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  color: string;
  text_color: string;
  reservation: ReservationStatus;
  reservation_detail: ReservationDetail | null;
  /**
   * The window of dates this line was published as active, as observed in the
   * feed. A fact, not a verdict: we no longer label lines "seasonal", because
   * that was inferred from a short active window and could not tell a
   * winter-only line apart from a feed that only publishes a few weeks ahead.
   */
  observed_from: string | null;
  observed_to: string | null;
  /**
   * True when the current feed no longer publishes this line. It stays on the
   * map — a bus that ran last winter is still evidence a trailhead is
   * reachable — but the UI ages it from `last_seen_on` so the reader can judge
   * how much to trust it. See scripts/transit/lib/ledger.mjs.
   */
  archived: boolean;
  /** ISO date of the last build whose feed still carried this line. */
  last_seen_on: string | null;
  /** Same instant as days-since-epoch, so map expressions can do arithmetic. */
  last_seen_day: number | null;
  /** The feed's own validity end when we last saw the line, if it declared one. */
  last_feed_valid_to: string | null;
  stops_count: number;
  endpoints: [string, string];
  service: {
    weekday: ServiceWindow | null;
    saturday: ServiceWindow | null;
    sunday: ServiceWindow | null;
  };
  timetable_url: string | null;
  runs_weekday: boolean;
  runs_saturday: boolean;
  runs_sunday: boolean;
  is_low_freq: boolean;
  /**
   * What the line is, when it is not a plain bus: `train` for a rail route a
   * network keeps on purpose (the Chemins de fer de Provence in Zou), and
   * `rail_replacement` for a coach the same feed also publishes as a train (a
   * TER replacement coach). Absent from data built before it existed.
   */
  service_kind?: 'train' | 'rail_replacement' | null;
}

export interface ServingLine {
  route_id: string;
  short_name: string;
  color: string;
  reservation: ReservationStatus;
  /** Set when the line no longer appears in the feed but still called here. */
  archived?: boolean;
}

export interface TransitStopProperties {
  provider_id: string;
  stop_id: string;
  stop_name: string;
  display_color: string;
  serving_lines: ServingLine[];
  runs_weekday: boolean;
  runs_saturday: boolean;
  runs_sunday: boolean;
  has_high_freq_line: boolean;
  /** True when no line still in the feed calls at this stop. */
  archived: boolean;
}

export interface TransitProviderMeta {
  provider_id: string;
  label: string;
  attribution: string;
  built_at: string;
  /**
   * When the feed was last downloaded and compared, whether or not that led to a
   * rebuild. Diverges from `built_at` exactly when the publisher has not
   * reissued the feed since. Absent on artifacts built before feed hashing.
   */
  last_checked_on?: string | null;
  feed_valid_from: string | null;
  feed_valid_to: string | null;
  license: string;
  source_url: string;
  line_count: number;
  stop_count: number;
  /** Lines the ledger remembers that the current feed no longer publishes. */
  archived_line_count?: number;
  archived_stop_count?: number;
}

export interface ProviderConfig {
  /** Stable id; used in layer ids, localStorage keys, and asset paths. */
  id: string;
  /** Short label shown in the toggle and validity banner. */
  label: string;
  /**
   * French administrative region this provider serves, spelled as the official
   * name (e.g. 'Auvergne-Rhône-Alpes'). The picker groups by it, so it is not
   * cosmetic — a provider without one cannot be found in the menu.
   *
   * A provider spanning several regions declares the region of the authority
   * that publishes it rather than a list: Fluo Grand Est covers ten departments
   * but is one region's network.
   */
  region: string;
  /** Long-form attribution for the MapLibre source. Also lives in meta.json. */
  attribution: string;
  /** Single per-provider line colour (D7). */
  lineColor: string;
  /** Public-path URL to the shipped PMTiles vector bundle for lines. */
  linesPmtilesUrl: string;
  /** Public-path URL to the shipped GeoJSON for stops. */
  stopsGeoJsonUrl: string;
  /** Public-path URL to meta.json (drives the validity banner). */
  metaUrl: string;
  /**
   * Search-link fallback used when a feature's `timetable_url` is null.
   * Should return a URL the user can paste into a browser.
   */
  timetableSearchUrl: (line: TransitLineProperties) => string;
  /**
   * Whether the provider's overlay is visible on first load when no
   * persisted toggle state exists. Cars Région Isère: true. New providers
   * default to false so existing users don't get a sudden flood of lines.
   */
  displayDefaultOn: boolean;
}
