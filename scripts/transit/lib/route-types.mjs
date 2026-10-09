// Which GTFS routes a bus network draws.
//
// Some feeds bundle trains with their coaches — the Zou feed publishes the
// Région Sud TER trains (K24 Avignon – Lyon – Mâcon, …) next to its buses. Trains
// are the rail overlay's job, so routes whose route_type is rail are left out.
// Road coaches that reuse a train's number (Zou's "P25 coach", route_type 3) are
// buses and stay; so do trams, metro, funiculars and cable cars, which no rail
// overlay covers.

/** GTFS rail: the basic type 2, and the extended types 100–117. */
export function isRailRouteType(routeType) {
  const t = Number(routeType);
  return t === 2 || (t >= 100 && t <= 117);
}

/**
 * Split routes.txt rows into the routes to draw and the rail routes left out.
 * `keepRail` lists route_id prefixes of rail routes to keep anyway — trains
 * the rail overlay does not draw (the Chemins de fer de Provence, `CFP:`).
 */
export function partitionRailRoutes(routes, { keepRail = [] } = {}) {
  const kept = [];
  const rail = [];
  for (const r of routes) {
    const isRail = isRailRouteType(r.route_type);
    const exempt = isRail && keepRail.some((prefix) => String(r.route_id).startsWith(prefix));
    (isRail && !exempt ? rail : kept).push(r);
  }
  return { kept, rail };
}

const twinKey = (r) =>
  `${(r.route_short_name ?? '').trim().toLowerCase()}|${(r.route_long_name ?? '').trim().toLowerCase()}`;

/**
 * What a drawn route is, beyond "a bus": `train` for a rail route kept as an
 * exception, `rail_replacement` for a road route the same feed also publishes
 * as a train (same number and name: Zou's TER replacement coaches), else null.
 * `allRoutes` is the whole routes.txt, trains included.
 */
/**
 * Label a line feature that is no longer in the feed (an archived ledger entry)
 * by the same rule: a coach whose train the feed still publishes is still a
 * replacement coach.
 */
export function archivedServiceKind(props, allRoutes) {
  if (props?.service_kind) return props.service_kind;
  const key = twinKey(props ?? {});
  return allRoutes.some((r) => isRailRouteType(r.route_type) && twinKey(r) === key)
    ? 'rail_replacement'
    : null;
}

export function serviceKinds(allRoutes) {
  const trainKeys = new Set(allRoutes.filter((r) => isRailRouteType(r.route_type)).map(twinKey));
  const kinds = new Map();
  for (const r of allRoutes) {
    if (isRailRouteType(r.route_type)) kinds.set(r.route_id, 'train');
    else if (trainKeys.has(twinKey(r))) kinds.set(r.route_id, 'rail_replacement');
  }
  return kinds;
}
