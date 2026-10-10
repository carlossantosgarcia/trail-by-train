// Pure helpers for scripts/build-rail-stations.mjs: which stations trains call
// at, where they are, and how the sources merge into one station each. Kept
// free of I/O so they can be tested on small fixtures.

import { isRailRouteType } from '../transit/lib/route-types.mjs';

/** Two timetable entries closer than this are always the same station. */
export const CO_LOCATED_METRES = 50;

/** Entries of two feeds closer than this are the same station. */
export const SAME_STATION_METRES = 150;

/** Entries of two feeds with the same name closer than this are the same station. */
export const SAME_NAME_METRES = 400;

/** How far a register row may be from a station and still lend it its commune. */
export const REGISTER_MATCH_METRES = 1000;

// SNCF stop points are named after the mode that serves them, e.g.
// "StopPoint:OCETrain TER-87757724" or "StopPoint:OCECar TER-87757724". A road
// coach can sit on a trip the feed types as rail, so the stop point's own mode
// decides: a station whose only calls are by coach is not a train station.
const ROAD_STOP_POINT = /^StopPoint:OCE(Car|Navette)\b/;
const UIC_SUFFIX = /(\d{8})$/;

/**
 * Metres between two [lon, lat] points (equirectangular; exact enough at the
 * distances compared here).
 */
export function metres([lon1, lat1], [lon2, lat2]) {
  const k = Math.PI / 180;
  const x = (lon2 - lon1) * k * Math.cos(((lat1 + lat2) / 2) * k);
  const y = (lat2 - lat1) * k;
  return Math.hypot(x, y) * 6371000;
}

/** Trip ids whose route is a train (route_type 2 or 100–117). */
export function railTripIds(routes, trips) {
  const railRoutes = new Set(
    routes.filter((r) => isRailRouteType(r.route_type)).map((r) => r.route_id),
  );
  return new Set(trips.filter((t) => railRoutes.has(t.route_id)).map((t) => t.trip_id));
}

/**
 * Stations a train calls at, from one GTFS feed.
 *
 * `servedStopIds` are the stop ids that appear in stop_times on a rail trip.
 * A served platform resolves to its parent station when it has one, so a
 * station is one feature however many platforms or modes it has. The UIC code
 * is the last eight digits of an SNCF stop id; other feeds have none.
 *
 * Returns a Map keyed by station stop_id: { name, coord, uic }.
 */
export function servedStations(stops, servedStopIds) {
  const byId = new Map(stops.map((s) => [s.stop_id, s]));
  const out = new Map();
  for (const id of servedStopIds) {
    if (ROAD_STOP_POINT.test(id)) continue;
    const stop = byId.get(id);
    if (!stop) continue;
    const station = (stop.parent_station && byId.get(stop.parent_station)) || stop;
    if (out.has(station.stop_id)) continue;
    const lon = Number(station.stop_lon);
    const lat = Number(station.stop_lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || (lon === 0 && lat === 0)) continue;
    const uic = UIC_SUFFIX.exec(station.stop_id)?.[1] ?? UIC_SUFFIX.exec(id)?.[1] ?? null;
    out.set(station.stop_id, { name: station.stop_name.trim(), coord: [lon, lat], uic });
  }
  return out;
}

/** Nearest item to `coord` within `maxMetres`, or null. Linear; inputs are small. */
function nearest(items, coord, maxMetres, coordOf) {
  let best = null;
  let bestD = maxMetres;
  for (const item of items) {
    const d = metres(coord, coordOf(item));
    if (d <= bestD) {
      best = item;
      bestD = d;
    }
  }
  return best;
}

/** Lower-case, accent-free, letters and digits only: "Massy - Palaiseau" = "Massy-Palaiseau". */
export function nameKey(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Merge the stations of several sources into one list, French stations only.
 * Each source is a Map (or array) of { name, coord, uic } — or `uics`, when a
 * station has several codes, as in SNCF's list of passenger stations.
 *
 * Two entries are one station when they are within CO_LOCATED_METRES (SNCF
 * gives Ancenis and "Ancenis Bis" the same point; the shorter name is kept), or,
 * coming from different feeds, when they share a UIC code, are within
 * SAME_STATION_METRES, or carry the same name within SAME_NAME_METRES (SNCF's
 * "Massy-Palaiseau" and Transilien's "Massy - Palaiseau" stand 240 m apart).
 * Within one feed, two UIC codes further apart are two stations: Auber and
 * Haussmann Saint-Lazare are 250 m apart and both exist. `feeds` are in
 * priority order, SNCF first, so its name and position win.
 *
 * A station without a UIC code borrows one from a register row it sits on.
 *
 * `register` rows are { uic, commune, coord } from SNCF's "Liste des gares". It
 * lends each station its commune, but only from a row within
 * REGISTER_MATCH_METRES: the register is not maintained (Grasse sits in
 * Marseille there), so its positions are never used. A station with no row
 * nearby gets commune null.
 */
export function mergeStations(feeds, register) {
  const registerByUic = new Map();
  for (const row of register) {
    if (!registerByUic.has(row.uic)) registerByUic.set(row.uic, []);
    registerByUic.get(row.uic).push(row);
  }
  const communeFor = (station) => {
    const rows = station.uic ? (registerByUic.get(station.uic) ?? []) : [];
    const own = nearest(rows, station.coord, REGISTER_MATCH_METRES, (r) => r.coord);
    if (own) return own.commune;
    return nearest(register, station.coord, REGISTER_MATCH_METRES, (r) => r.coord)?.commune ?? null;
  };

  const out = [];
  const byUic = new Map();
  for (const [feedIndex, feed] of feeds.entries()) {
    for (const station of feed.values()) {
      const uics = station.uics ?? (station.uic ? [station.uic] : []);
      let uic = station.uic ?? uics[0] ?? null;
      if (!uic)
        uic = nearest(register, station.coord, SAME_STATION_METRES, (r) => r.coord)?.uic ?? null;
      // France only: SNCF also serves Geneva, Basel, Ventimiglia… whose UIC
      // codes carry their own country prefix. Monaco shares France's 87.
      if (uic && !uic.startsWith('87')) continue;

      const colocated = nearest(out, station.coord, CO_LOCATED_METRES, (s) => s.coord);
      if (colocated) {
        if (colocated.feedIndex === feedIndex && station.name.length < colocated.name.length) {
          colocated.name = station.name;
        }
        continue;
      }
      const key = nameKey(station.name);
      const earlier = out.filter((s) => s.feedIndex < feedIndex);
      if ([uic, ...uics].some((u) => u && byUic.get(u)?.feedIndex < feedIndex)) continue;
      if (nearest(earlier, station.coord, SAME_STATION_METRES, (s) => s.coord)) continue;
      const sameName = earlier.filter((s) => s.nameKey === key);
      if (nearest(sameName, station.coord, SAME_NAME_METRES, (s) => s.coord)) continue;

      const { uics: _u, ...rest } = station;
      const entry = { ...rest, uic, nameKey: key, feedIndex };
      for (const u of new Set([uic, ...uics])) if (u && !byUic.has(u)) byUic.set(u, entry);
      out.push(entry);
    }
  }
  return out.map(({ nameKey: _k, feedIndex: _f, ...s }) => ({ ...s, commune: communeFor(s) }));
}

/** GeoJSON features, sorted by name so the file diffs cleanly between builds. */
export function toFeatures(stations) {
  return stations
    .map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [round5(s.coord[0]), round5(s.coord[1])] },
      properties: { name: s.name, commune: s.commune, code_uic: s.uic },
    }))
    .sort(
      (a, b) =>
        a.properties.name.localeCompare(b.properties.name, 'fr') ||
        a.geometry.coordinates[0] - b.geometry.coordinates[0],
    );
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}
