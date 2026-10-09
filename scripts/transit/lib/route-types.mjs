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

/** Split routes.txt rows into the routes to draw and the rail routes left out. */
export function partitionRailRoutes(routes) {
  const kept = [];
  const rail = [];
  for (const r of routes) (isRailRouteType(r.route_type) ? rail : kept).push(r);
  return { kept, rail };
}
