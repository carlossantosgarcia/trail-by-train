#!/usr/bin/env node
// Generic transit-provider build driver. Reads the central config in
// providers.config.mjs, downloads the GTFS feed (caching under .cache/<id>/),
// and orchestrates lib/{gtfs,emit-geojson,stops}.mjs to emit
// public/transit/<id>/{lines.geojson, stops.geojson, meta.json}.
//
// Usage:
//   node scripts/transit/build.mjs <id> [--refresh] [--keep-cache] [--force]
//   node scripts/transit/build.mjs all  [--refresh] [--keep-cache] [--force]
//
// --refresh     force a re-download of the GTFS zip even if cached
// --keep-cache  keep the extracted CSVs in .cache/ after the build
// --force       rebuild even when the feed hash matches the last build

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildServiceWindowsByDayType,
  computeRouteServiceStats,
  downloadGtfsArchives,
  extractArchives,
  hashArchives,
  observedWindow,
  readAllRows,
  readRows,
  ymdToIso,
} from './lib/gtfs.mjs';
import { toStopFeatures, writeFeatureCollection, writeMeta } from './lib/emit-geojson.mjs';
import {
  ON_SHAPE_METRES,
  ON_SHAPE_SHARE,
  distanceToGeometry,
  ledgerShapeLookup,
  mergeLineLedger,
  mergeStopLedger,
  readLedger,
  writeLedger,
} from './lib/ledger.mjs';
import { fetchCatalogue, resolveFeedUrl } from './lib/resolve-feed.mjs';
import { clusterStops } from './lib/stops.mjs';
import { archivedServiceKind, partitionRailRoutes, serviceKinds } from './lib/route-types.mjs';
import { dissolveRouteShapes } from './lib/dissolve.mjs';
import {
  ALL_DAYS,
  legacyServiceDays,
  serviceDays,
  stopServiceDays,
  trimServiceStats,
} from './lib/service-days.mjs';
import { usableFragments } from './lib/shape-quality.mjs';
import { findPfaedle, isStopToStop, matchPatterns, stopIndex } from './lib/estimate-shapes.mjs';
import { osmFileFor } from './lib/osm-extracts.mjs';
import { readBookingRules, summariseRules } from './lib/booking-rules.mjs';
import { resolveReservation } from './lib/reservation.mjs';
import { writeLinesPmtiles } from './lib/tile-lines.mjs';
import { PROVIDERS, getProviderConfig } from './providers.config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Version of the build's output rules. Bump it whenever a change to this
 * pipeline changes what it emits for an unchanged feed, so every provider is
 * rebuilt once rather than skipped until its publisher happens to republish.
 *   2 — rail routes (route_type 2, 100–117) left out of bus networks;
 *       lines carry `service_kind` (train / TER replacement coach).
 *   3 — the dataset's current file is fetched; a line without a shape
 *       borrows the ledger's (`shape_seen_on`); out-of-season feeds kept.
 *   4 — `is_low_freq` and the `runs_<day>` flags dropped; lines and stops
 *       carry `service_days`, the days of the week they run regularly.
 *   5 — lines with no usable shape, or a stop-to-stop one, are estimated
 *       with pfaedle over OpenStreetMap (`shape_estimated`).
 */
export const BUILD_VERSION = 5;
const REPO = resolve(HERE, '../..');
const CACHE_ROOT = resolve(HERE, '.cache');
// Road extracts are large and shared by every network: `TRANSIT_OSM_CACHE` can
// keep them somewhere a clean checkout does not wipe.
const OSM_CACHE = process.env.TRANSIT_OSM_CACHE || resolve(CACHE_ROOT, 'osm');

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));

// Mutable so an importing module (the weekly refresh) can drive `buildAll` with
// its own flags instead of whatever argv this process happens to carry.
let flags = new Set(argv.filter((a) => a.startsWith('--')));

/** Replace the flag set used by `buildOne`/`buildAll`. */
export function setBuildFlags(next) {
  flags = new Set(next);
}

async function buildOne(config) {
  const PROVIDER_ID = config.id;
  const t0 = Date.now();

  const cacheDir = resolve(CACHE_ROOT, PROVIDER_ID);
  // `gtfsUrl` is a string for the common case and an array when one network is
  // published as several archives (Nord 59, Oise 60). The single-archive path
  // keeps the historic `gtfs.zip` filename so existing caches stay valid.
  const gtfsUrls = Array.isArray(config.gtfsUrl) ? config.gtfsUrl : [config.gtfsUrl];
  const zipPathFor = (i) =>
    gtfsUrls.length === 1 ? resolve(cacheDir, 'gtfs.zip') : resolve(cacheDir, `gtfs-${i}.zip`);
  const zipPaths = gtfsUrls.map((_, i) => zipPathFor(i));
  const zipPath = zipPaths[0];
  const extractDir = resolve(cacheDir, 'extracted');
  const outDir = resolve(REPO, 'public/transit', PROVIDER_ID);
  const overridesPath = resolve(outDir, 'line-urls.json');
  const metaPath = `${outDir}/meta.json`;
  const previousMeta = readJsonOrNull(metaPath);
  const checkedOn = new Date().toISOString().slice(0, 10);

  // A cached archive downloaded from another URL is another edition.
  const urlChanged =
    gtfsUrls.length === 1 && !!previousMeta?.gtfs_url && previousMeta.gtfs_url !== gtfsUrls[0];
  let feedSha = null;
  if (flags.has('--refresh') || urlChanged || !zipPaths.every((p) => existsSync(p))) {
    const what = gtfsUrls.length === 1 ? 'GTFS feed' : `${gtfsUrls.length} GTFS archives`;
    console.log(`[${PROVIDER_ID}] downloading ${what}…`);
    feedSha = await downloadGtfsArchives(gtfsUrls, zipPathFor);
  } else {
    console.log(`[${PROVIDER_ID}] reusing cached ${cacheDir}`);
    feedSha = await hashArchives(zipPaths);
  }

  // A feed whose bytes have not moved cannot describe a different service, so
  // there is nothing to rebuild. Record that we looked — `last_checked_on` is
  // what keeps a stable feed from aging into a staleness warning that would be
  // reporting our own schedule rather than the operator's.
  //
  // A provider with no recorded digest always rebuilds, so this can never
  // suppress a first build or one whose artifacts predate feed hashing.
  //
  // A newer BUILD_VERSION rebuilds too: the feed is the same, but what the
  // pipeline makes of it is not.
  const previousSha =
    typeof previousMeta?.feed_sha256 === 'string' ? previousMeta.feed_sha256 : null;
  const sameBuild = previousMeta?.build_version === BUILD_VERSION;
  if (previousSha && previousSha === feedSha && sameBuild && !flags.has('--force')) {
    // Still out of season: last season's timetable is what the map shows, so
    // its age must keep showing — no fresh check date.
    const dormant = Boolean(previousMeta.dormant_since);
    await writeMeta(
      dormant
        ? { ...previousMeta, feed_sha256: feedSha }
        : { ...previousMeta, feed_sha256: feedSha, last_checked_on: checkedOn },
      metaPath,
    );
    if (!flags.has('--keep-cache')) {
      await rm(extractDir, { recursive: true, force: true });
    }
    console.log(
      `[${PROVIDER_ID}] feed unchanged since ${previousMeta.built_at?.slice(0, 10) ?? '?'} — skipped.`,
    );
    return {
      id: PROVIDER_ID,
      label: config.label,
      status: dormant ? 'dormant' : 'skipped',
      dormantSince: previousMeta.dormant_since ?? null,
      before: countsFromMeta(previousMeta),
      after: countsFromMeta(previousMeta),
    };
  }

  console.log(`[${PROVIDER_ID}] extracting required files…`);
  // GTFS-Flex booking rules are optional and most feeds omit them, so they are
  // pulled separately — listing them in requiredFiles would abort those builds.
  // For a multi-archive provider both happen inside extractArchives, which has
  // to see the optional list to merge it alongside the required files.
  //
  // shapes.txt is extracted when present rather than required: a feed that
  // stops shipping it can still draw the lines whose shapes the ledger holds.
  await extractArchives(
    zipPaths,
    extractDir,
    config.requiredFiles.filter((f) => f !== 'shapes.txt'),
    ['booking_rules.txt', 'shapes.txt'],
  );
  const bookingRules = await readBookingRules(`${extractDir}/booking_rules.txt`);

  console.log(`[${PROVIDER_ID}] reading routes/stops/calendar…`);
  // Trains are the rail overlay's job: a feed that bundles them with its
  // coaches (Zou publishes the Région Sud TER) must not draw them as buses.
  const allRoutes = await readAllRows(`${extractDir}/routes.txt`);
  const { kept: routes, rail: railRoutes } = partitionRailRoutes(allRoutes, {
    keepRail: config.keepRailRoutes ?? [],
  });
  const kindByRoute = serviceKinds(allRoutes);
  const railRouteIds = new Set(railRoutes.map((r) => r.route_id));
  if (railRoutes.length > 0) {
    console.log(
      `[${PROVIDER_ID}] leaving out ${railRoutes.length} rail route(s) (route_type 2/100–117): ` +
        railRoutes.map((r) => r.route_short_name || r.route_id).join(', '),
    );
  }
  const stops = await readAllRows(`${extractDir}/stops.txt`);
  const hasCalendar = config.requiredFiles.includes('calendar.txt');
  const hasCalendarDates = config.requiredFiles.includes('calendar_dates.txt');
  const hasShapes = existsSync(`${extractDir}/shapes.txt`);
  const hasFeedInfo = config.requiredFiles.includes('feed_info.txt');
  const calendar = hasCalendar ? await readAllRows(`${extractDir}/calendar.txt`) : [];
  const calendarDates = hasCalendarDates
    ? await readAllRows(`${extractDir}/calendar_dates.txt`)
    : [];
  const feedInfo = hasFeedInfo ? (await readAllRows(`${extractDir}/feed_info.txt`))[0] : null;

  console.log(`[${PROVIDER_ID}] reading trips…`);
  const trips = (await readAllRows(`${extractDir}/trips.txt`)).filter(
    (t) => !railRouteIds.has(t.route_id),
  );

  // No trips at all is a network between seasons (the ski shuttles publish
  // every file, headers only, until their winter timetable is out), not a
  // broken feed: a broken one fails at extraction or at the shapes check.
  // Keep last season's lines and say so, rather than count a failure every
  // week until winter.
  if (trips.length === 0) {
    if (!previousMeta) {
      throw new Error('feed publishes no trips and there is no earlier build to keep');
    }
    const dormantSince = previousMeta.dormant_since ?? checkedOn;
    await writeMeta(
      {
        ...previousMeta,
        feed_sha256: feedSha,
        build_version: BUILD_VERSION,
        gtfs_url: gtfsUrls.length === 1 ? gtfsUrls[0] : null,
        dormant_since: dormantSince,
      },
      metaPath,
    );
    if (!flags.has('--keep-cache')) await rm(extractDir, { recursive: true, force: true });
    console.log(
      `[${PROVIDER_ID}] feed publishes no trips — out of season since ${dormantSince}; previous data kept.`,
    );
    return {
      id: PROVIDER_ID,
      label: config.label,
      status: 'dormant',
      dormantSince,
      before: countsFromMeta(previousMeta),
      after: countsFromMeta(previousMeta),
    };
  }

  /** @type {Map<string, Array<[number, number]>>} */
  const shapesById = new Map();
  if (hasShapes) {
    console.log(`[${PROVIDER_ID}] streaming shapes…`);
    /** @type {Map<string, Array<{ seq:number, lng:number, lat:number }>>} */
    const shapeBuf = new Map();
    await readRows(`${extractDir}/shapes.txt`, (row) => {
      const id = row.shape_id;
      if (!id) return;
      let arr = shapeBuf.get(id);
      if (!arr) {
        arr = [];
        shapeBuf.set(id, arr);
      }
      arr.push({
        seq: Number(row.shape_pt_sequence),
        lng: Number(row.shape_pt_lon),
        lat: Number(row.shape_pt_lat),
      });
    });
    let rejectedShapes = 0;
    let splitShapes = 0;
    let droppedPoints = 0;
    for (const [id, pts] of shapeBuf) {
      pts.sort((a, b) => a.seq - b.seq);
      const coords = pts.map((p) => [+p.lng.toFixed(5), +p.lat.toFixed(5)]);
      // Two independent corruptions to guard against. A point that is not a
      // location at all (null island, swapped axes) splits the shape there,
      // keeping the valid geometry either side. Points published out of path
      // order draw as a scribble and are dropped rather than rendered wrong.
      const { fragments, invalidPoints, rejected } = usableFragments(coords);
      if (invalidPoints.length > 0) {
        splitShapes += 1;
        droppedPoints += invalidPoints.length;
        const where = invalidPoints.map(([lon, lat]) => `[${lon}, ${lat}]`).join(', ');
        console.warn(
          `[${PROVIDER_ID}] splitting shape ${id}: ${invalidPoints.length} point(s) ` +
            `outside the served area (${where}) -> ${fragments.length} fragment(s)`,
        );
      }
      for (const { quality } of rejected) {
        rejectedShapes += 1;
        console.warn(
          `[${PROVIDER_ID}] dropping shape ${id}: points are not in path order ` +
            `(${quality.lengthKm.toFixed(0)} km of zig-zag across a ` +
            `${quality.diagonalKm.toFixed(1)} km extent, ratio ${quality.ratio.toFixed(0)})`,
        );
      }
      if (fragments.length > 0) shapesById.set(id, fragments);
    }
    if (rejectedShapes > 0) {
      console.warn(
        `[${PROVIDER_ID}] ${rejectedShapes} shape(s) dropped as unusable; ` +
          `routes left without any shape will not be drawn`,
      );
    }
    if (splitShapes > 0) {
      console.warn(
        `[${PROVIDER_ID}] ${splitShapes} shape(s) split at ${droppedPoints} implausible ` +
          `point(s); affected routes are drawn either side of the gap`,
      );
    }
    shapeBuf.clear();
  }

  // Shapes are estimated where the feed has none to give, and where the one it
  // gives only joins the stops with straight lines. Without pfaedle the build
  // draws what it did before: published shapes, stop-to-stop ones included.
  const pfaedle = findPfaedle();
  const stopToStopShapes = new Set();
  if (pfaedle) {
    const nearStop = stopIndex(stops.map((s) => [Number(s.stop_lon), Number(s.stop_lat)]));
    for (const [id, fragments] of shapesById) {
      if (fragments.every((f) => isStopToStop(f, nearStop))) stopToStopShapes.add(id);
    }
    if (stopToStopShapes.size > 0) {
      console.log(
        `[${PROVIDER_ID}] ${stopToStopShapes.size} of ${shapesById.size} shape(s) only join ` +
          `their stops with straight lines`,
      );
    }
  }
  // Trips whose geometry has to come from somewhere other than the feed.
  const lacksRoadShape = (trip) =>
    !trip.shape_id || !shapesById.has(trip.shape_id) || stopToStopShapes.has(trip.shape_id);
  // Only a vehicle that keeps to the road can be routed over it: buses and
  // coaches, on-demand ones included, and trolleybuses — not a funicular,
  // lift or boat.
  const roadRouteIds = new Set(
    routes
      .filter((r) => {
        const t = Number(r.route_type);
        return t === 3 || t === 11 || t === 800 || (t >= 200 && t <= 299) || (t >= 700 && t <= 799);
      })
      .map((r) => r.route_id),
  );
  const estimateTripIds = new Set(
    pfaedle
      ? trips.filter((t) => roadRouteIds.has(t.route_id) && lacksRoadShape(t)).map((t) => t.trip_id)
      : [],
  );

  console.log(`[${PROVIDER_ID}] streaming stop_times…`);
  const firstStopByTrip = new Map();
  const lastStopByTrip = new Map();
  const stopRoutes = new Map();
  const tripStopIds = new Map();
  const tripMaxSeq = new Map();
  const tripMinSeq = new Map();
  // Which booking rules each trip references. GTFS-Flex hangs these off
  // stop_times, so this rides along in the pass we already make.
  const tripBookingRuleIds = new Map();
  // The ordered stops of trips that may be estimated, with their times.
  const estimateStopTimes = new Map();
  // Rows of the trains left out above are skipped too, so their stops and
  // booking rules say nothing about the buses.
  const railTripIds = new Set();
  if (railRouteIds.size > 0) {
    for (const t of await readAllRows(`${extractDir}/trips.txt`)) {
      if (railRouteIds.has(t.route_id)) railTripIds.add(t.trip_id);
    }
  }
  await readRows(`${extractDir}/stop_times.txt`, (row) => {
    const tripId = row.trip_id;
    if (!tripId || railTripIds.has(tripId)) return;
    const seq = Number(row.stop_sequence);
    // The first stop is the lowest sequence number, not number 1: GTFS only
    // requires the numbers to increase, and feeds start at 0, 1 or 2 (Altigo).
    // Keying on 1 dropped every trip of a feed starting at 2 from its line's
    // service summary, and took the second stop of a feed starting at 0.
    if (seq < (tripMinSeq.get(tripId) ?? Infinity)) {
      tripMinSeq.set(tripId, seq);
      firstStopByTrip.set(tripId, {
        stop_id: row.stop_id,
        departure_time: row.departure_time || row.arrival_time,
      });
    }
    const maxSeq = tripMaxSeq.get(tripId) ?? -1;
    if (seq > maxSeq) {
      tripMaxSeq.set(tripId, seq);
      lastStopByTrip.set(tripId, row.stop_id);
    }
    let set = tripStopIds.get(tripId);
    if (!set) {
      set = new Set();
      tripStopIds.set(tripId, set);
    }
    set.add(row.stop_id);
    if (estimateTripIds.has(tripId)) {
      let rows = estimateStopTimes.get(tripId);
      if (!rows) estimateStopTimes.set(tripId, (rows = []));
      rows.push({
        seq,
        stop_id: row.stop_id,
        arrival_time: row.arrival_time,
        departure_time: row.departure_time,
      });
    }
    const pickupRule = (row.pickup_booking_rule_id ?? '').trim();
    const dropOffRule = (row.drop_off_booking_rule_id ?? '').trim();
    if (pickupRule || dropOffRule) {
      let rules = tripBookingRuleIds.get(tripId);
      if (!rules) {
        rules = new Set();
        tripBookingRuleIds.set(tripId, rules);
      }
      if (pickupRule) rules.add(pickupRule);
      if (dropOffRule) rules.add(dropOffRule);
    }
  });

  // A feed "models booking" only when it both ships rules and attaches at
  // least one to a trip. A rule nobody references says nothing about any
  // particular line, so it cannot license a "no reservation needed" answer.
  const feedModelsBooking = bookingRules.size > 0 && tripBookingRuleIds.size > 0;
  if (bookingRules.size > 0) {
    console.log(
      `[${PROVIDER_ID}] booking rules: ${bookingRules.size} published, ` +
        `referenced by ${tripBookingRuleIds.size} trip(s)` +
        (feedModelsBooking ? '' : ' — orphaned, so reservation stays unknown'),
    );
  }

  /** @type {Map<string, Array<typeof trips[number]>>} */
  const tripsByRoute = new Map();
  for (const trip of trips) {
    let arr = tripsByRoute.get(trip.route_id);
    if (!arr) {
      arr = [];
      tripsByRoute.set(trip.route_id, arr);
    }
    arr.push(trip);
  }

  console.log(`[${PROVIDER_ID}] building service windows…`);
  const serviceWindows = buildServiceWindowsByDayType(calendar, calendarDates);

  // Collect the distinct shape variants per route. These are later dissolved
  // into one union geometry per route (shared trunk once, forks preserved)
  // rather than shipped as separate overlapping features.
  console.log(`[${PROVIDER_ID}] collecting per-shape variants…`);
  const shapesByRoute = new Map();
  for (const [routeId, ts] of tripsByRoute) {
    const perShape = new Map();
    for (const trip of ts) {
      if (!trip.shape_id) continue;
      const fragments = shapesById.get(trip.shape_id);
      if (!fragments) continue;
      // A shape split at an implausible point contributes each fragment as its
      // own variant. Dissolve unions the variants, so the route is drawn either
      // side of the gap the feed left. Keyed per fragment so the dedupe across
      // trips sharing a shape still holds.
      for (let i = 0; i < fragments.length; i++) {
        const coords = fragments[i];
        if (!coords || coords.length < 2) continue;
        const key = fragments.length === 1 ? trip.shape_id : `${trip.shape_id}#${i + 1}`;
        if (perShape.has(key)) continue;
        perShape.set(key, { coords, shapeId: trip.shape_id });
      }
    }
    if (perShape.size > 0) shapesByRoute.set(routeId, perShape);
  }

  const overrides = readOverridesOrNull(overridesPath, PROVIDER_ID);

  // The ledger, read before the routes so a route the feed gives no shape can
  // take the one recorded for it.
  const ledgerPath = `${outDir}/lines-ledger.geojson.gz`;
  const previousLines = flags.has('--reset-ledger') ? [] : await readLedger(ledgerPath);
  const recordedShape = ledgerShapeLookup(previousLines);
  let borrowedShapes = 0;
  const stopsById = new Map(stops.map((s) => [s.stop_id, s]));

  // What each route is drawn from, in order of preference: the feed's shapes;
  // for a route the feed gives none, the shape the ledger recorded while the
  // feed still published it; and otherwise an estimate. A stop-to-stop shape
  // gives way to an estimate of the same trips.
  const plans = new Map();
  const patterns = [];
  const routesById = new Map(routes.map((r) => [r.route_id, r]));
  for (const [routeId, routeTrips] of tripsByRoute) {
    const route = routesById.get(routeId);
    if (!route) continue;
    const all = shapesByRoute.get(routeId) ?? new Map();
    const roadVariants = new Map([...all].filter(([, v]) => !stopToStopShapes.has(v.shapeId)));
    const plan = { route, variants: all, borrowed: null, patternKeys: [] };
    plans.set(routeId, plan);
    if (all.size === 0 && previousLines.length > 0) {
      const stopPoints = [];
      for (const trip of routeTrips) {
        for (const id of tripStopIds.get(trip.trip_id) ?? []) {
          const st = stopsById.get(id);
          if (st) stopPoints.push([Number(st.stop_lon), Number(st.stop_lat)]);
        }
      }
      plan.borrowed = recordedShape(route, stopPoints);
      if (plan.borrowed) continue;
    }
    // A shapeless school variant of a line whose shapes already pass its
    // stops adds nothing but a second, estimated copy of the same road.
    const roadGeometry =
      roadVariants.size > 0
        ? { type: 'MultiLineString', coordinates: [...roadVariants.values()].map((v) => v.coords) }
        : null;
    const byKey = new Map();
    for (const trip of routeTrips) {
      const rows = (estimateStopTimes.get(trip.trip_id) ?? [])
        .filter((r) => stopsById.has(r.stop_id))
        .sort((a, b) => a.seq - b.seq);
      if (rows.length < 2) continue;
      const key = `${routeId}|${rows.map((r) => r.stop_id).join('>')}`;
      // One trip per stop pattern is routed; the stop-to-stop shapes of all
      // the pattern's trips are what its estimate replaces.
      if (byKey.has(key)) {
        if (stopToStopShapes.has(trip.shape_id)) byKey.get(key).shapeIds.add(trip.shape_id);
        continue;
      }
      const shapeIds = new Set(stopToStopShapes.has(trip.shape_id) ? [trip.shape_id] : []);
      byKey.set(key, { shapeIds });
      const points = rows
        .map((r) => stopsById.get(r.stop_id))
        .filter(Boolean)
        .map((s) => [Number(s.stop_lon), Number(s.stop_lat)]);
      if (points.length < 2) continue;
      if (roadGeometry) {
        const on = points.filter((p) => distanceToGeometry(p, roadGeometry) <= ON_SHAPE_METRES);
        if (on.length >= points.length * ON_SHAPE_SHARE) continue;
      }
      const pattern = { key, route, stops: rows, points, fill: shapeIds.size > 0, shapeIds };
      byKey.set(key, pattern);
      patterns.push(pattern);
      plan.patternKeys.push(key);
    }
  }

  // Route the patterns with pfaedle, on the OSM extracts their stops fall in.
  let estimates = new Map();
  if (patterns.length > 0) {
    const t = Date.now();
    const lines = new Set(patterns.map((p) => p.route.route_id)).size;
    try {
      const points = patterns.flatMap((p) => [
        ...p.points,
        ...p.points
          .slice(1)
          .map((q, i) => [(q[0] + p.points[i][0]) / 2, (q[1] + p.points[i][1]) / 2]),
      ]);
      const osm = await osmFileFor(points, OSM_CACHE, resolve(cacheDir, 'osm'), (m) =>
        console.log(`[${PROVIDER_ID}] ${m}`),
      );
      if (!osm.path) throw new Error(osm.reason);
      estimates = await matchPatterns({
        patterns,
        stopsById,
        osmPath: osm.path,
        workDir: resolve(cacheDir, 'pfaedle'),
        pfaedle,
      });
      // What was cut and why, for inspecting estimates; not published.
      writeFileSync(
        resolve(cacheDir, 'estimates.json'),
        JSON.stringify(
          patterns.map((p) => ({
            route_id: p.route.route_id,
            stops: p.stops.map((r) => {
              const st = stopsById.get(r.stop_id);
              return [Number(st.stop_lon), Number(st.stop_lat), st.stop_name];
            }),
            replaces_stop_to_stop: p.fill,
            ...(estimates.get(p.key) ?? { failed: true }),
          })),
        ),
      );
      let hops = 0;
      let cut = 0;
      for (const e of estimates.values()) {
        hops += e.hops;
        cut += e.cut;
      }
      console.log(
        `[${PROVIDER_ID}] estimated ${estimates.size} stop pattern(s) on ${lines} line(s) ` +
          `with pfaedle over ${osm.regions.join(' + ')} in ${((Date.now() - t) / 1000).toFixed(0)}s; ` +
          `${cut} of ${hops} hop(s) left out as unreliable`,
      );
    } catch (err) {
      // An estimate is a bonus: without one the build draws what the feed has.
      console.warn(`[${PROVIDER_ID}] could not estimate ${lines} line(s): ${err.message}`);
      estimates = new Map();
    }
  } else if (!pfaedle) {
    const missing = new Set(trips.filter(lacksRoadShape).map((t) => t.route_id)).size;
    if (missing > 0) {
      console.log(
        `[${PROVIDER_ID}] pfaedle not found: ${missing} line(s) with no road-following shape ` +
          `are not estimated`,
      );
    }
  }
  // Fold the estimates into each route's variants.
  for (const plan of plans.values()) {
    const parts = plan.patternKeys.flatMap((k) => estimates.get(k)?.parts ?? []);
    if (parts.length === 0) {
      plan.estimated = null;
      continue;
    }
    // A stop-to-stop shape is replaced once every pattern using it has an
    // estimate; one that does not keeps the operator's straight lines.
    const covered = new Set();
    const uncovered = new Set();
    for (const p of patterns) {
      if (p.route !== plan.route) continue;
      const into = estimates.get(p.key)?.parts.length ? covered : uncovered;
      for (const id of p.shapeIds) into.add(id);
    }
    const kept = new Map(
      [...plan.variants].filter(([, v]) => !covered.has(v.shapeId) || uncovered.has(v.shapeId)),
    );
    parts.forEach((coords, i) => kept.set(`estimated#${i + 1}`, { coords, shapeId: null }));
    plan.variants = kept;
    plan.estimated = kept.size === parts.length ? 'all' : 'part';
  }

  console.log(`[${PROVIDER_ID}] building route records…`);
  const outRoutes = [];
  let inputShapeCount = 0;
  for (const route of routes) {
    const routeId = route.route_id;
    const routeTrips = tripsByRoute.get(routeId);
    if (!routeTrips || routeTrips.length === 0) continue;
    const plan = plans.get(routeId);
    const variants = plan?.variants;
    const borrowed = plan?.borrowed ?? null;
    // A route with neither a shape, an estimate nor a recorded one is not drawn.
    if ((!variants || variants.size === 0) && !borrowed) continue;

    const stats = computeRouteServiceStats(routeTrips, firstStopByTrip, serviceWindows);
    const mergedActive = new Set();
    for (const trip of routeTrips) {
      const sw = serviceWindows.get(trip.service_id);
      if (!sw) continue;
      for (const d of sw.weekday) mergedActive.add(d);
      for (const d of sw.saturday) mergedActive.add(d);
      for (const d of sw.sunday) mergedActive.add(d);
    }
    const observed = observedWindow(mergedActive);
    // Roll the trips' booking-rule references up to the route: any trip that
    // must be booked makes the line a "book ahead" line.
    const routeRuleIds = new Set();
    for (const trip of routeTrips) {
      const rules = tripBookingRuleIds.get(trip.trip_id);
      if (rules) for (const id of rules) routeRuleIds.add(id);
    }
    const reservation = resolveReservation({
      route,
      predicate: config.reservationPredicate,
      evidence: { feedModelsBooking, routeReferencesRule: routeRuleIds.size > 0 },
      bookingDetail: summariseRules(routeRuleIds, bookingRules),
    });

    const longestByDir = new Map();
    for (const trip of routeTrips) {
      const len = tripMaxSeq.get(trip.trip_id) ?? 0;
      const key = trip.direction_id ?? '0';
      const cur = longestByDir.get(key);
      if (!cur || len > cur.len) longestByDir.set(key, { trip, len });
    }
    const endpointNames = [...longestByDir.values()]
      .slice(0, 2)
      .map(({ trip }) => stopsById.get(lastStopByTrip.get(trip.trip_id))?.stop_name ?? '');
    if (endpointNames.length === 1) {
      const t = longestByDir.values().next().value.trip;
      endpointNames.unshift(
        stopsById.get(firstStopByTrip.get(t.trip_id)?.stop_id)?.stop_name ?? '',
      );
    }
    while (endpointNames.length < 2) endpointNames.push('');

    const allStopIds = new Set();
    for (const trip of routeTrips) {
      const ids = tripStopIds.get(trip.trip_id);
      if (ids) for (const id of ids) allStopIds.add(id);
    }
    for (const stopId of allStopIds) {
      let set = stopRoutes.get(stopId);
      if (!set) {
        set = new Set();
        stopRoutes.set(stopId, set);
      }
      set.add(routeId);
    }

    const shortName = (route.route_short_name ?? '').trim();
    const longName = (route.route_long_name ?? '').trim();
    const days = serviceDays(routeTrips, serviceWindows);
    // Dissolve all shape variants into one union geometry per route: shared
    // trunk kept once, forks preserved. All variants carry identical route-
    // level properties, so collapsing to one Feature loses nothing but the
    // redundant overlapping polylines. See openspec union-transit-route-geometry.
    let geometry;
    if (borrowed) {
      // Recorded geometry, never made up from stops: see "Only networks that
      // can be drawn". The popup states how old it is.
      geometry = borrowed.geometry;
      borrowedShapes += 1;
    } else {
      inputShapeCount += variants.size;
      const members = dissolveRouteShapes(
        [...variants].map(([id, { coords }]) => ({ id, coords })),
      );
      if (members.length === 0) continue;
      geometry =
        members.length === 1
          ? { type: 'LineString', coordinates: members[0] }
          : { type: 'MultiLineString', coordinates: members };
    }
    outRoutes.push({
      provider_id: PROVIDER_ID,
      route_id: routeId,
      route_short_name: shortName,
      route_long_name: longName,
      color: route.route_color,
      text_color: route.route_text_color,
      reservation: reservation.status,
      reservation_detail: reservation.detail,
      observed_from: observed.observed_from,
      observed_to: observed.observed_to,
      stops_count: allStopIds.size,
      endpoints: endpointNames.slice(0, 2),
      // A day type the line only touches on odd dates reads "Pas de service".
      service: trimServiceStats(stats, days),
      service_days: days,
      timetable_url: overrides?.[shortName] ?? null,
      service_kind: kindByRoute.get(routeId) ?? null,
      shape_seen_on: borrowed?.shape_seen_on ?? null,
      shape_estimated: borrowed ? null : (plan.estimated ?? null),
      geometry,
    });
  }
  if (borrowedShapes > 0) {
    console.log(
      `[${PROVIDER_ID}] ${borrowedShapes} line(s) drawn with the shape the ledger recorded ` +
        `(the feed gives them none)`,
    );
  }

  console.log(`[${PROVIDER_ID}] building stop records…`);
  const routeMetaById = new Map(
    outRoutes.map((r) => [
      r.route_id,
      {
        route_id: r.route_id,
        short_name: r.route_short_name,
        color: r.color,
        reservation: r.reservation,
        service_days: r.service_days,
      },
    ]),
  );
  const outStops = [];
  for (const [stopId, routeSet] of stopRoutes) {
    const stop = stopsById.get(stopId);
    if (!stop) continue;
    const lng = Number(stop.stop_lon);
    const lat = Number(stop.stop_lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    const servingLines = [...routeSet].map((rid) => routeMetaById.get(rid)).filter(Boolean);
    if (servingLines.length === 0) continue;
    const colors = servingLines.map((l) => normaliseColorRaw(l.color));
    outStops.push({
      provider_id: PROVIDER_ID,
      stop_id: stopId,
      stop_name: (stop.stop_name ?? '').trim(),
      lng: +lng.toFixed(5),
      lat: +lat.toFixed(5),
      display_color: colors.length === 1 ? colors[0] : '#FFFFFF',
      serving_lines: servingLines.map((l, i) => ({
        route_id: l.route_id,
        short_name: l.short_name,
        color: colors[i],
        reservation: l.reservation ?? 'unknown',
        service_days: l.service_days,
      })),
      service_days: stopServiceDays(servingLines.map((l) => l.service_days)),
    });
  }

  const beforeMerge = outStops.length;
  const mergedStops = clusterStops(outStops);
  console.log(
    `[${PROVIDER_ID}] merged stops by (name, ≤75m proximity): ${beforeMerge} → ${mergedStops.length}`,
  );

  console.log(`[${PROVIDER_ID}] writing artifacts to ${outDir}…`);
  const lineFeatures = outRoutes.map((r) => {
    const service = r.service ?? { weekday: null, saturday: null, sunday: null };
    return {
      type: 'Feature',
      geometry: r.geometry,
      properties: {
        provider_id: r.provider_id,
        route_id: r.route_id,
        route_short_name: r.route_short_name ?? '',
        route_long_name: r.route_long_name ?? '',
        color: normaliseColorRaw(r.color),
        text_color: normaliseColorRaw(r.text_color),
        reservation: r.reservation ?? 'unknown',
        reservation_detail: r.reservation_detail ?? null,
        observed_from: r.observed_from ?? null,
        observed_to: r.observed_to ?? null,
        stops_count: r.stops_count ?? 0,
        endpoints: r.endpoints ?? ['', ''],
        service,
        timetable_url: r.timetable_url ?? null,
        service_days: r.service_days,
        service_kind: r.service_kind ?? null,
        shape_seen_on: r.shape_seen_on ?? null,
        shape_estimated: r.shape_estimated ?? null,
      },
    };
  });
  // A feed that yields no drawable route is broken, not empty-by-design: it
  // has lost its shapes, or the download returned something unusable. Bail
  // before writing anything, because the write path is destructive — tippecanoe
  // truncates lines.pmtiles before it rejects a zero-feature input, which would
  // leave this provider worse off than not building it at all. Failing here
  // keeps the last good artifacts, and `build.mjs all` carries on.
  if (outRoutes.length === 0) {
    throw new Error(
      `feed produced no route with usable geometry (${routes.length} routes read). ` +
        `Refusing to overwrite existing artifacts — check whether the feed still ships shapes.txt.`,
    );
  }

  const validFrom = ymdSafe(feedInfo?.feed_start_date);
  const validTo = ymdSafe(feedInfo?.feed_end_date);

  // Union this build with everything the ledger remembers, so lines the feed
  // has stopped publishing stay on the map carrying the date we last saw them.
  const buildDate = new Date().toISOString().slice(0, 10);
  const { features: unionLineFeatures, stats: lineStats } = mergeLineLedger({
    previous: previousLines,
    current: lineFeatures,
    buildDate,
    feedValidTo: validTo,
    providerId: PROVIDER_ID,
    excludedRouteIds: railRouteIds,
  });
  if (lineStats.archived > 0 || lineStats.revived > 0) {
    console.log(
      `[${PROVIDER_ID}] ledger: ${lineStats.live} live, ${lineStats.archived} archived ` +
        `(${lineStats.newlyArchived} newly absent, ${lineStats.revived} back in the feed)`,
    );
  }

  for (const f of unionLineFeatures) {
    if (f.properties.archived) {
      f.properties.service_kind = archivedServiceKind(f.properties, allRoutes);
      // Recorded before lines carried their days: the old per-day-type flags say.
      f.properties.service_days ??= legacyServiceDays(f.properties);
    }
    for (const key of ['runs_weekday', 'runs_saturday', 'runs_sunday', 'is_low_freq']) {
      delete f.properties[key];
    }
  }

  const archivedRouteIds = new Set(
    unionLineFeatures.filter((f) => f.properties.archived).map((f) => f.properties.route_id),
  );
  const previousStops = flags.has('--reset-ledger')
    ? []
    : await readStopFeaturesOrEmpty(`${outDir}/stops.geojson`);
  const { features: unionStopFeatures, stats: stopStats } = mergeStopLedger({
    previous: previousStops,
    current: toStopFeatures(mergedStops),
    archivedRouteIds,
    knownRouteIds: new Set(unionLineFeatures.map((f) => f.properties.route_id)),
    providerId: PROVIDER_ID,
  });
  // Stops kept from earlier builds carry no days: read them off their lines.
  const daysByRoute = new Map(
    unionLineFeatures.map((f) => [f.properties.route_id, f.properties.service_days]),
  );
  for (const f of unionStopFeatures) {
    const p = f.properties;
    for (const l of p.serving_lines ?? []) {
      l.service_days = daysByRoute.get(l.route_id) ?? l.service_days ?? ALL_DAYS;
    }
    p.service_days = stopServiceDays((p.serving_lines ?? []).map((l) => l.service_days));
    for (const key of ['runs_weekday', 'runs_saturday', 'runs_sunday', 'has_high_freq_line']) {
      delete p[key];
    }
  }

  await writeLinesPmtiles(
    unionLineFeatures,
    `${outDir}/lines.pmtiles`,
    `${cacheDir}/lines.tmp.geojson`,
  );
  await writeFeatureCollection(unionStopFeatures, `${outDir}/stops.geojson`);
  await writeLedger(ledgerPath, unionLineFeatures);
  const distinctRoutes = new Set(outRoutes.map((r) => r.route_id)).size;
  await writeMeta(
    {
      provider_id: PROVIDER_ID,
      label: config.label,
      attribution: config.attribution,
      built_at: new Date().toISOString(),
      last_checked_on: checkedOn,
      feed_sha256: feedSha,
      build_version: BUILD_VERSION,
      gtfs_url: gtfsUrls.length === 1 ? gtfsUrls[0] : null,
      excluded_rail_routes: railRoutes.length,
      feed_valid_from: validFrom,
      feed_valid_to: validTo,
      license: config.license,
      source_url: config.sourceUrl,
      line_count: distinctRoutes,
      estimated_line_count: outRoutes.filter((r) => r.shape_estimated).length,
      archived_line_count: lineStats.archived,
      shape_count: inputShapeCount,
      stop_count: mergedStops.length,
      archived_stop_count: stopStats.archived,
    },
    metaPath,
  );

  if (!flags.has('--keep-cache')) {
    await rm(extractDir, { recursive: true, force: true });
  }

  // A feed that keeps its ids but drops most of its lines is a regression on
  // the operator's side worth a look, not a failure: the dropped lines stay on
  // the map, archived.
  const previousLineCount = previousMeta?.line_count ?? 0;
  const warning =
    previousLineCount >= 4 && distinctRoutes * 2 < previousLineCount
      ? `feed shrank from ${previousLineCount} to ${distinctRoutes} lines; ` +
        `the others stay on the map as archived lines`
      : null;
  if (warning) console.warn(`[${PROVIDER_ID}] ${warning}`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const archivedNote = lineStats.archived > 0 ? ` (+${lineStats.archived} archived)` : '';
  console.log(
    `[${PROVIDER_ID}] done in ${elapsed}s — ${outRoutes.length} lines${archivedNote}, ${mergedStops.length} stops.`,
  );

  return {
    id: PROVIDER_ID,
    label: config.label,
    status: 'rebuilt',
    warning,
    excludedRail: railRoutes.length,
    before: countsFromMeta(previousMeta),
    after: {
      lines: distinctRoutes,
      archived: lineStats.archived,
      stops: mergedStops.length,
    },
  };
}

/** Line/stop counts as recorded in a `meta.json`, or nulls when there is none. */
function countsFromMeta(meta) {
  if (!meta) return { lines: null, archived: null, stops: null };
  return {
    lines: meta.line_count ?? null,
    archived: meta.archived_line_count ?? null,
    stops: meta.stop_count ?? null,
  };
}

function readJsonOrNull(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function ymdSafe(ymd) {
  if (!ymd || ymd.length !== 8) return null;
  return ymdToIso(ymd);
}

function normaliseColorRaw(raw) {
  if (!raw) return '#888888';
  const cleaned = String(raw).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return '#888888';
  return `#${cleaned.toUpperCase()}`;
}

/**
 * The previous run's `stops.geojson` doubles as the stop ledger — it is already
 * plain readable GeoJSON, so archived stops need no separate file the way
 * archived lines do.
 */
async function readStopFeaturesOrEmpty(path) {
  if (!existsSync(path)) return [];
  try {
    const fc = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(fc?.features) ? fc.features : [];
  } catch {
    return [];
  }
}

function readOverridesOrNull(path, providerId) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.warn(`[${providerId}] line-urls.json present but unreadable — ignoring`);
    return null;
  }
}

/**
 * Build each provider in turn, isolating failures. A provider that throws keeps
 * whatever artifacts it already had — the write paths refuse to overwrite with
 * unusable data — so one dead feed never degrades the rest of the map.
 *
 * Returns one outcome per provider, which `main` turns into the exit code and,
 * under GitHub Actions, a job summary.
 */
export async function buildAll(configs, { catalogue } = {}) {
  // One catalogue request per run, not per network.
  const cat = catalogue !== undefined ? catalogue : await fetchCatalogue();
  const outcomes = [];
  for (const base of configs) {
    const { url, reason } = resolveFeedUrl(base, cat);
    if (reason !== 'configured') {
      console.log(`[${base.id}] dataset's current file: ${url}`);
    }
    const cfg = url === base.gtfsUrl ? base : { ...base, gtfsUrl: url };
    try {
      outcomes.push(await buildOne(cfg));
    } catch (err) {
      console.error(`[${cfg.id}] build failed:`, err.message);
      outcomes.push({
        id: cfg.id,
        label: cfg.label,
        status: 'failed',
        error: err.message,
        before: null,
        after: null,
      });
    }
  }
  return outcomes;
}

/**
 * Each provider's refresh history, kept across runs in
 * public/transit/refresh-status.json (published with the transit data, so
 * the next run restores it). A failed provider keeps its previous artifacts,
 * which is right for the map but would let a dead feed age silently; this
 * record is what scripts/transit/report-stale.mjs alerts on.
 */
export function updateRefreshStatus(previous, outcomes, now) {
  const today = now.toISOString().slice(0, 10);
  const providers = { ...(previous?.providers ?? {}) };
  for (const o of outcomes) {
    const before = providers[o.id] ?? { last_success: null, consecutive_failures: 0 };
    // A warning is kept with its date until a newer one replaces it; the
    // report only shows recent ones.
    const warning = o.warning
      ? { warning: String(o.warning), warning_on: today }
      : { warning: before.warning ?? null, warning_on: before.warning_on ?? null };
    if (o.status === 'failed') {
      providers[o.id] = {
        ...before,
        last_attempt: today,
        consecutive_failures: (before.consecutive_failures ?? 0) + 1,
        last_error: String(o.error),
      };
    } else if (o.status === 'dormant') {
      // Out of season is a healthy answer from the feed, not a success that
      // refreshed the data: last_success stays where it was.
      providers[o.id] = {
        ...before,
        ...warning,
        last_attempt: today,
        consecutive_failures: 0,
        last_error: null,
        dormant_since: o.dormantSince ?? before.dormant_since ?? today,
      };
    } else {
      providers[o.id] = {
        ...warning,
        last_attempt: today,
        last_success: today,
        consecutive_failures: 0,
        last_error: null,
        dormant_since: null,
      };
    }
  }
  return { updated_at: now.toISOString(), providers };
}

async function main() {
  if (positional.length !== 1) {
    console.error(
      'Usage: node scripts/transit/build.mjs <id|all> [--refresh] [--keep-cache] [--force]',
    );
    process.exit(2);
  }
  const target = positional[0];
  const targets = target === 'all' ? PROVIDERS : [getProviderConfig(target)];
  const outcomes = await buildAll(targets);
  if (target === 'all') {
    const statusPath = resolve(
      fileURLToPath(new URL('../../public/transit/', import.meta.url)),
      'refresh-status.json',
    );
    const previous = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : null;
    writeFileSync(
      statusPath,
      JSON.stringify(updateRefreshStatus(previous, outcomes, new Date()), null, 1),
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) writeJobSummary(outcomes);
  if (outcomes.some((o) => o.status === 'failed')) process.exit(1);
}

/**
 * Markdown table of provider outcomes for the GitHub Actions run page, so a
 * dead feed is visible without reading the log. Failed providers kept their
 * previous artifacts (see buildAll), which is why the run still publishes.
 */
function writeJobSummary(outcomes) {
  const failed = outcomes.filter((o) => o.status === 'failed');
  const result = (o) => {
    if (o.status === 'failed') return `❌ ${String(o.error).replace(/\|/g, '\\|')}`;
    if (o.status === 'dormant') return `💤 out of season since ${o.dormantSince ?? '?'}`;
    return `✅ ${o.status}`;
  };
  const rows = outcomes.map(
    (o) =>
      `| ${o.label} | \`${o.id}\` | ${result(o)}${o.warning ? ` ⚠️ ${o.warning}` : ''}${o.excludedRail ? ` (${o.excludedRail} rail routes left out)` : ''} |`,
  );
  const md = [
    `### Transit feeds: ${outcomes.length - failed.length}/${outcomes.length} rebuilt`,
    failed.length ? '\nFailed providers keep the artifacts from the previous run.\n' : '',
    '| Provider | id | Result |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

// Only run when invoked directly — importing this module for `buildAll` must not
// trigger a build of whatever `process.argv` happens to hold.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('build failed:', err.message);
    process.exit(1);
  });
}
