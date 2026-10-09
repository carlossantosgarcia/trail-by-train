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
  mergeLineLedger,
  mergeStopLedger,
  readLedger,
  writeLedger,
} from './lib/ledger.mjs';
import { clusterStops } from './lib/stops.mjs';
import { archivedServiceKind, partitionRailRoutes, serviceKinds } from './lib/route-types.mjs';
import { dissolveRouteShapes } from './lib/dissolve.mjs';
import { usableFragments } from './lib/shape-quality.mjs';
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
 */
export const BUILD_VERSION = 2;
const REPO = resolve(HERE, '../..');
const CACHE_ROOT = resolve(HERE, '.cache');

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

  let feedSha = null;
  if (flags.has('--refresh') || !zipPaths.every((p) => existsSync(p))) {
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
  const previousSha = typeof previousMeta?.feed_sha256 === 'string' ? previousMeta.feed_sha256 : null;
  const sameBuild = previousMeta?.build_version === BUILD_VERSION;
  if (previousSha && previousSha === feedSha && sameBuild && !flags.has('--force')) {
    await writeMeta({ ...previousMeta, feed_sha256: feedSha, last_checked_on: checkedOn }, metaPath);
    if (!flags.has('--keep-cache')) {
      await rm(extractDir, { recursive: true, force: true });
    }
    console.log(`[${PROVIDER_ID}] feed unchanged since ${previousMeta.built_at?.slice(0, 10) ?? '?'} — skipped.`);
    return {
      id: PROVIDER_ID,
      label: config.label,
      status: 'skipped',
      before: countsFromMeta(previousMeta),
      after: countsFromMeta(previousMeta),
    };
  }

  console.log(`[${PROVIDER_ID}] extracting required files…`);
  // GTFS-Flex booking rules are optional and most feeds omit them, so they are
  // pulled separately — listing them in requiredFiles would abort those builds.
  // For a multi-archive provider both happen inside extractArchives, which has
  // to see the optional list to merge it alongside the required files.
  await extractArchives(zipPaths, extractDir, config.requiredFiles, ['booking_rules.txt']);
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
  const hasShapes = config.requiredFiles.includes('shapes.txt');
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

  console.log(`[${PROVIDER_ID}] streaming stop_times…`);
  const firstStopByTrip = new Map();
  const lastStopByTrip = new Map();
  const stopRoutes = new Map();
  const tripStopIds = new Map();
  const tripMaxSeq = new Map();
  // Which booking rules each trip references. GTFS-Flex hangs these off
  // stop_times, so this rides along in the pass we already make.
  const tripBookingRuleIds = new Map();
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
    if (seq === 1) {
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
        perShape.set(key, coords);
      }
    }
    if (perShape.size > 0) shapesByRoute.set(routeId, perShape);
  }

  const overrides = readOverridesOrNull(overridesPath, PROVIDER_ID);

  console.log(`[${PROVIDER_ID}] building route records…`);
  const stopsById = new Map(stops.map((s) => [s.stop_id, s]));
  const outRoutes = [];
  let inputShapeCount = 0;
  for (const route of routes) {
    const routeId = route.route_id;
    const routeTrips = tripsByRoute.get(routeId);
    if (!routeTrips || routeTrips.length === 0) continue;
    const variants = shapesByRoute.get(routeId);
    if (!variants || variants.size === 0) continue;

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
      endpointNames.unshift(stopsById.get(firstStopByTrip.get(t.trip_id)?.stop_id)?.stop_name ?? '');
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
    const wkTrips = stats?.weekday?.trips ?? 0;
    const saTrips = stats?.saturday?.trips ?? 0;
    const suTrips = stats?.sunday?.trips ?? 0;
    const isLowFreq =
      wkTrips > 0 && wkTrips <= config.lowFreqThreshold && saTrips === 0 && suTrips === 0;
    // Dissolve all shape variants into one union geometry per route: shared
    // trunk kept once, forks preserved. All variants carry identical route-
    // level properties, so collapsing to one Feature loses nothing but the
    // redundant overlapping polylines. See openspec union-transit-route-geometry.
    inputShapeCount += variants.size;
    const members = dissolveRouteShapes(
      [...variants].map(([id, coords]) => ({ id, coords })),
    );
    if (members.length === 0) continue;
    const geometry =
      members.length === 1
        ? { type: 'LineString', coordinates: members[0] }
        : { type: 'MultiLineString', coordinates: members };
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
      service: stats,
      timetable_url: overrides?.[shortName] ?? null,
      is_low_freq: isLowFreq,
      service_kind: kindByRoute.get(routeId) ?? null,
      geometry,
    });
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
        runs_weekday: (r.service?.weekday?.trips ?? 0) > 0,
        runs_saturday: (r.service?.saturday?.trips ?? 0) > 0,
        runs_sunday: (r.service?.sunday?.trips ?? 0) > 0,
        is_low_freq: Boolean(r.is_low_freq),
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
    const runsWeekday = servingLines.some((l) => l.runs_weekday);
    const runsSaturday = servingLines.some((l) => l.runs_saturday);
    const runsSunday = servingLines.some((l) => l.runs_sunday);
    const hasHighFreq = servingLines.some((l) => !l.is_low_freq);
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
      })),
      runs_weekday: runsWeekday,
      runs_saturday: runsSaturday,
      runs_sunday: runsSunday,
      has_high_freq_line: hasHighFreq,
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
        runs_weekday: (service.weekday?.trips ?? 0) > 0,
        runs_saturday: (service.saturday?.trips ?? 0) > 0,
        runs_sunday: (service.sunday?.trips ?? 0) > 0,
        is_low_freq: Boolean(r.is_low_freq),
        service_kind: r.service_kind ?? null,
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
  const ledgerPath = `${outDir}/lines-ledger.geojson.gz`;
  const buildDate = new Date().toISOString().slice(0, 10);
  const previousLines = flags.has('--reset-ledger') ? [] : await readLedger(ledgerPath);
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
      excluded_rail_routes: railRoutes.length,
      feed_valid_from: validFrom,
      feed_valid_to: validTo,
      license: config.license,
      source_url: config.sourceUrl,
      line_count: distinctRoutes,
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

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const archivedNote =
    lineStats.archived > 0 ? ` (+${lineStats.archived} archived)` : '';
  console.log(
    `[${PROVIDER_ID}] done in ${elapsed}s — ${outRoutes.length} lines${archivedNote}, ${mergedStops.length} stops.`,
  );

  return {
    id: PROVIDER_ID,
    label: config.label,
    status: 'rebuilt',
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
export async function buildAll(configs) {
  const outcomes = [];
  for (const cfg of configs) {
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
    providers[o.id] =
      o.status === 'failed'
        ? {
            ...before,
            last_attempt: today,
            consecutive_failures: (before.consecutive_failures ?? 0) + 1,
            last_error: String(o.error),
          }
        : { last_attempt: today, last_success: today, consecutive_failures: 0, last_error: null };
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
    const statusPath = resolve(fileURLToPath(new URL('../../public/transit/', import.meta.url)), 'refresh-status.json');
    const previous = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : null;
    writeFileSync(statusPath, JSON.stringify(updateRefreshStatus(previous, outcomes, new Date()), null, 1));
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
  const rows = outcomes.map(
    (o) =>
      `| ${o.label} | \`${o.id}\` | ${o.status === 'failed' ? `❌ ${String(o.error).replace(/\|/g, '\\|')}` : `✅ ${o.status}`}${o.excludedRail ? ` (${o.excludedRail} rail routes left out)` : ''} |`,
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
