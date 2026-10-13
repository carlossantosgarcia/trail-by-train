// Operator-verified exceptions to GTFS-derived route labels. A feed can put
// special-day trips on the wrong route, omit seasonal service while it is out
// of season, or fail to encode reservation rules. These entries are deliberately
// specific to a provider, route id and visible line number. Recheck the source
// PDF when the operator publishes a new edition.

export const VERIFIED_LINE_FACTS = [
  {
    providerId: 'aleop',
    routeId: '101',
    shortName: '101',
    days: { saturday: false, sunday: true },
    source: 'https://aleop.paysdelaloire.fr/file/37292/download?token=S_1iF-Et',
    sourcePeriod: '2026-09-01 to 2027-08-31',
    reason: 'The timetable has Sunday/holiday trips, but no Saturday trips.',
  },
  {
    providerId: 'aleop',
    routeId: '102',
    shortName: '102',
    days: { saturday: false, sunday: true },
    source: 'https://aleop.paysdelaloire.fr/file/39207/download?token=XYM2Iofx',
    sourcePeriod: '2026-09-01 to 2027-08-31',
    reason: 'The 102 timetable has Sunday trips; Saturday trips are on the separate R102.',
  },
  {
    providerId: 'aleop',
    routeId: '102-AD',
    shortName: 'R102',
    days: { saturday: true, sunday: false },
    reservation: 'required',
    source: 'https://aleop.paysdelaloire.fr/file/39209/download?token=-YL0_H-5',
    sourcePeriod: '2026-09-01 to 2027-08-31',
    reason: 'R102 is the separate Saturday service and its timetable requires booking.',
  },
  {
    providerId: 'aleop',
    routeId: '214',
    shortName: '214',
    days: { saturday: true, sunday: false },
    reservation: 'required',
    source: 'https://aleop.paysdelaloire.fr/file/36057/download?token=jsb4huBU',
    sourcePeriod: '2026-08-24 to 2027-07-02',
    reason: 'Saturday trips run; no Sunday service. Booking is mandatory from listed communes.',
  },
  {
    providerId: 'breizhgo-car-29',
    routeId: '239',
    shortName: '9611',
    days: { saturday: false, sunday: false },
    reservation: 'required',
    source:
      'https://finistere.transdev-bretagne.com/system/files/documents/1229811%20L9611%20Brest%203%20volets-BAT1_0.pdf',
    sourcePeriod: '2026-09-01 to 2026-12-12',
    reason: 'All trips are marked Monday–Friday; the TAD instructions require prior booking.',
  },
  {
    providerId: 'synchro-chambery',
    routeId: '41',
    shortName: '41',
    // Summer's operator sheet says Monday through Sunday. The current GTFS
    // only has an isolated autumn trip and cannot express this seasonal week.
    serviceDays: '1111111',
    reservation: 'required',
    source: 'https://storage.googleapis.com/is-wp-3-prod/uploads-prod/2026/06/FH-Ete2026-41.pdf',
    reservationSource:
      'https://storage.googleapis.com/is-wp-3-prod/uploads-prod/2025/12/FH-Ligne-41-Hiver-2526.pdf',
    sourcePeriod: 'Summer 2026; booking rule from winter 2025–26',
    reason: 'Seasonal line: daily in summer and weekends in winter. Winter trips require booking.',
  },
  {
    providerId: 'mreso-gresivaudan',
    routeId: '98',
    shortName: 'N98',
    days: { saturday: true, sunday: true },
    reservation: 'not_required',
    source: 'https://www.reso-m.fr/ftp/fiche_horaires/fiche_horaires_2014/HORAIRES_ETE_N98.pdf',
    reservationSource:
      'https://www.reso-m.fr/cms_viewFile.php?idtf=5177&path=Destinations-Neige-brochure-2024-12-02.pdf',
    sourcePeriod: 'Summer 2026; booking evidence from winter 2024–25',
    reason:
      'Weekend trips in season; the operator separates N98 (tickets aboard) from reservable ski lines.',
  },
];

/** Apply a verified fact to one route-shaped record. Returns true on a match. */
export function applyVerifiedLineFact(providerId, route) {
  const fact = VERIFIED_LINE_FACTS.find(
    (item) => item.providerId === providerId && item.routeId === route.route_id,
  );
  if (!fact) return false;
  if (route.route_short_name?.trim() !== fact.shortName) {
    console.warn(
      `[${providerId}] skipped verified facts for route ${fact.routeId}: ` +
        `expected ${fact.shortName}, got ${route.route_short_name}`,
    );
    return false;
  }
  if (fact.days || fact.serviceDays) {
    const mask = route.service_days;
    if (typeof mask !== 'string' || !/^[01]{7}$/.test(mask)) {
      console.warn(
        `[${providerId}] skipped day facts for route ${fact.routeId}: no valid service_days`,
      );
    } else {
      route.service_days =
        fact.serviceDays ??
        mask.slice(0, 5) + (fact.days.saturday ? '1' : '0') + (fact.days.sunday ? '1' : '0');
      if (route.service && route.service_days[5] === '0') route.service.saturday = null;
      if (route.service && route.service_days[6] === '0') route.service.sunday = null;
    }
  }
  if (fact.reservation) {
    route.reservation = fact.reservation;
    route.reservation_detail = null;
  }
  return true;
}
