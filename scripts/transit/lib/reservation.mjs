// Does this line have to be booked ahead? — answered in three states.
//
// The old model was a boolean, `on_demand`, set by matching a route id or a
// free-text description. Because the popup only rendered a badge when it was
// true, a line nobody needs to book and a line whose feed says nothing about
// booking looked identical. Only 28 of 3,679 shipped lines carried the flag, so
// the map effectively told every reader "just turn up" without evidence.
//
// So: `required`, `not_required`, `unknown`, and `unknown` is the default.
// `not_required` is an assertion and needs grounds — a feed that models booking
// (it ships booking rules AND attaches at least one to a trip) and records none
// for this line is genuinely saying "no booking". A feed with no flex data at
// all is saying nothing, and every line in it stays `unknown`.
//
// A feed that ships a rule it never references is the awkward middle case, and
// it is real: `mreso-gresivaudan` publishes one booking rule — with a phone
// number and the deadline "au plus tard la veille avant 18 h" — that none of
// its 10,101 stop-time rows reference. Its FLEXO lines really are
// reservation-only, but the feed does not say so anywhere we can read, so they
// stay `unknown`. Attaching that rule to lines we merely suspect would be a
// guess dressed as data.

export const RESERVATION_REQUIRED = 'required';
export const RESERVATION_NOT_REQUIRED = 'not_required';
export const RESERVATION_UNKNOWN = 'unknown';

const RESERVATION_IN_DESC = /réservation|reservation|à la demande|sur réservation/;

/**
 * @typedef {'required'|'not_required'|'unknown'} ReservationStatus
 * @typedef {{ feedModelsBooking: boolean, routeReferencesRule: boolean }} ReservationEvidence
 */

/**
 * Conservative default, used by the urban networks.
 *
 * Returns `not_required` only on the strength of feed-level evidence, never
 * from the mere absence of a route-level signal.
 *
 * @param {Record<string, string>} route
 * @param {ReservationEvidence} evidence
 * @returns {ReservationStatus}
 */
export function detectReservationDefault(route, evidence) {
  if (evidence.routeReferencesRule) return RESERVATION_REQUIRED;
  // NeTEx-derived feeds tag flexible lines in the route id itself — a
  // universal-strong signal in transport.data.gouv.fr-published feeds.
  if (typeof route.route_id === 'string' && route.route_id.includes(':FlexibleLine:')) {
    return RESERVATION_REQUIRED;
  }
  return evidence.feedModelsBooking ? RESERVATION_NOT_REQUIRED : RESERVATION_UNKNOWN;
}

/**
 * For providers whose `route_type: 715` entries document their reservation
 * terms in `route_desc` (the Cars Région convention). Never infers TAD from
 * `route_type` alone: some operators use the GTFS-extended types for unrelated
 * categories such as school services.
 *
 * @param {Record<string, string>} route
 * @param {ReservationEvidence} evidence
 * @returns {ReservationStatus}
 */
export function detectReservationFlexibleOr715WithReservation(route, evidence) {
  const base = detectReservationDefault(route, evidence);
  if (base === RESERVATION_REQUIRED) return base;
  const type = Number(route.route_type);
  const desc = (route.route_desc || '').toLowerCase();
  if (type === 715 && RESERVATION_IN_DESC.test(desc)) return RESERVATION_REQUIRED;
  return base;
}

/**
 * Resolve one route, and pick the detail to show when the answer is yes.
 * Booking-rule detail is preferred over `route_desc`: it is structured, and it
 * carries the phone number and deadline that free text usually does not.
 */
export function resolveReservation({ route, predicate, evidence, bookingDetail }) {
  const status = predicate(route, evidence);
  if (status !== RESERVATION_REQUIRED) return { status, detail: null };
  if (bookingDetail) return { status, detail: bookingDetail };
  const desc = (route.route_desc || '').trim();
  return { status, detail: desc ? { message: desc, phone: null, url: null, deadline: null } : null };
}
