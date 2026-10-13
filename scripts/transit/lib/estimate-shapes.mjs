// Estimated shapes for lines a feed gives no usable geometry.
//
// Some feeds ship no shapes.txt (Altigo since 2026-09), leave some trips
// without a shape, or publish "shapes" that only join the stops with straight
// lines (most of the Corsican and Hauts-de-France coaches): one vertex per
// stop, cutting across valleys. For those trips the build asks pfaedle
// (https://github.com/ad-freiburg/pfaedle) to route the stops along the roads
// of OpenStreetMap, and draws the result as an *estimated* line.
//
// pfaedle is good on most hops, and fails in two ways the study behind this
// (2026-10) found it can be caught at:
//
//   - It cannot reach the next stop on a road (a road missing from OSM, one
//     tagged out of the bus profile, a border the extract stops at) and draws
//     a straight segment instead: no vertex between the two stops.
//   - It snaps a stop to a road far from where the stop is, typically a bus
//     station or school yard: the hops either side of it then go wrong a
//     quarter of the time, against 4 % for a stop placed within 25 m.
//
// Those hops are cut rather than drawn — the same rule the build applies to a
// published shape with a hole in it. When the feed's own straight-line shape
// is being replaced, its stop-to-stop segment fills the cut instead: that is
// the geometry the operator published, and no worse than before.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { readAllRows, readRows } from './gtfs.mjs';

/** A stop pfaedle placed further than this from where it is moves its hops. */
export const MOVED_STOP_METRES = 100;
/** A vertex-free hop longer than this is pfaedle's straight-line fallback. */
export const STRAIGHT_HOP_METRES = 300;

/** Stop-to-stop detection: vertices this close to a stop are "on" it. */
const ON_STOP_METRES = 25;
/** …and a shape is stop-to-stop when this share of its vertices is on a stop… */
const ON_STOP_SHARE = 0.8;
/** …while having fewer vertices per km than any road-following shape. */
const MAX_POINTS_PER_KM = 3;

function metres(a, b) {
  const kx = 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 110540);
}

/**
 * Index of stop positions answering "is there a stop within ON_STOP_METRES".
 * @param {Array<[number, number]>} points lon/lat
 */
export function stopIndex(points) {
  const cell = 0.001; // ~80–110 m, larger than the radius
  const grid = new Map();
  for (const p of points) {
    const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(p);
  }
  return (p) => {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (metres(p, q) <= ON_STOP_METRES) return true;
        }
      }
    }
    return false;
  };
}

/**
 * Whether a shape only joins stops with straight lines, rather than following
 * roads: nearly every vertex is a stop, and vertices are too sparse for any
 * bend. Measured on the study feeds, this matches 72 of the 83 Haute-Corse
 * shapes and none of the road-following ones elsewhere.
 *
 * @param {Array<[number, number]>} coords
 * @param {(p: [number, number]) => boolean} nearStop from `stopIndex`
 */
export function isStopToStop(coords, nearStop) {
  if (coords.length < 3) return true;
  let km = 0;
  for (let i = 1; i < coords.length; i++) km += metres(coords[i - 1], coords[i]) / 1000;
  const on = coords.filter(nearStop).length;
  return (
    on / coords.length >= ON_STOP_SHARE && coords.length / Math.max(km, 0.1) < MAX_POINTS_PER_KM
  );
}

/** Point at distance `d` along a shape whose vertices carry cumulative `sd`. */
function pointAt(shape, d) {
  if (d <= shape[0].sd) return [shape[0].lon, shape[0].lat];
  for (let i = 1; i < shape.length; i++) {
    const a = shape[i - 1];
    const b = shape[i];
    if (d <= b.sd) {
      const t = b.sd > a.sd ? (d - a.sd) / (b.sd - a.sd) : 0;
      return [a.lon + t * (b.lon - a.lon), a.lat + t * (b.lat - a.lat)];
    }
  }
  const z = shape[shape.length - 1];
  return [z.lon, z.lat];
}

/** The part of `shape` between distances `from` and `to`, end points included. */
function slice(shape, from, to) {
  const out = [pointAt(shape, from)];
  for (const v of shape) if (v.sd > from && v.sd < to) out.push([v.lon, v.lat]);
  out.push(pointAt(shape, to));
  return out;
}

const round = ([lon, lat]) => [+lon.toFixed(5), +lat.toFixed(5)];

/**
 * Cut a matched trip at the hops pfaedle got wrong in a way we can detect.
 *
 * @param {Array<{ lon:number, lat:number, sd:number }>} shape pfaedle's shape
 * @param {Array<{ lon:number, lat:number, sd:number }>} stops the trip's stops,
 *   in order, with pfaedle's shape_dist_traveled
 * @param {{ fill?: boolean }} opts `fill` joins a cut hop with the straight
 *   stop-to-stop segment the feed published, instead of leaving a gap
 * @returns {{ parts: Array<Array<[number, number]>>, hops: number, cut: number,
 *   moved: number, straight: number, cutHops: number[],
 *   placed: Array<[number, number]> }}
 */
export function cutAtFailures(shape, stops, { fill = false } = {}) {
  const placed = stops.map((s) => pointAt(shape, s.sd));
  const moved = stops.map((s, i) => metres([s.lon, s.lat], placed[i]) > MOVED_STOP_METRES);
  const parts = [];
  let cur = null;
  let cut = 0;
  let straight = 0;
  const cutHops = [];
  const push = (coords) => {
    if (!cur) {
      cur = [];
      parts.push(cur);
    }
    for (const c of coords) {
      const r = round(c);
      const last = cur[cur.length - 1];
      if (!last || last[0] !== r[0] || last[1] !== r[1]) cur.push(r);
    }
  };
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1].sd;
    const to = stops[i].sd;
    const part = to > from ? slice(shape, from, to) : [placed[i - 1], placed[i]];
    let len = 0;
    for (let k = 1; k < part.length; k++) len += metres(part[k - 1], part[k]);
    const isStraight = part.length === 2 && len > STRAIGHT_HOP_METRES;
    if (isStraight) straight += 1;
    if (!moved[i - 1] && !moved[i] && !isStraight) {
      push(part);
      continue;
    }
    cut += 1;
    cutHops.push(i);
    if (fill) {
      // The published segment runs stop to stop; join it to the matched
      // geometry either side where that geometry ends.
      const a = moved[i - 1] ? [stops[i - 1].lon, stops[i - 1].lat] : placed[i - 1];
      const b = moved[i] ? [stops[i].lon, stops[i].lat] : placed[i];
      push([a, b]);
    } else {
      cur = null;
    }
  }
  return {
    parts: parts.filter((p) => p.length >= 2),
    hops: stops.length - 1,
    cut,
    moved: moved.filter(Boolean).length,
    straight,
    // For inspection: hop i joins stops i-1 and i; where pfaedle put each stop.
    cutHops,
    placed: placed.map(round),
  };
}

/** Quote a CSV field when it needs it. */
function csv(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function writeCsv(path, header, rows) {
  const lines = [header.join(','), ...rows.map((r) => header.map((h) => csv(r[h])).join(','))];
  await writeFile(path, `${lines.join('\n')}\n`);
}

/**
 * pfaedle's transport modes: a coach (route_type 200–299) is matched on the
 * coach profile, everything else in a bus network as a bus.
 */
function pfaedleRouteType(t) {
  const n = Number(t);
  return n >= 200 && n <= 299 ? 200 : 3;
}

/**
 * Whether a usable pfaedle binary is on hand. `PFAEDLE` names it (default:
 * `pfaedle` on PATH); `PFAEDLE_CONFIG` optionally names its configuration,
 * which an installed pfaedle finds by itself.
 */
export function findPfaedle() {
  const bin = process.env.PFAEDLE || 'pfaedle';
  const r = spawnSync(bin, ['--version'], { stdio: 'ignore' });
  return r.error || r.status !== 0 ? null : bin;
}

/**
 * Route one representative trip per stop pattern with pfaedle.
 *
 * @param {object} args
 * @param {Array<{ key:string, route:object, stops:Array<{ stop_id:string,
 *   arrival_time:string, departure_time:string }>, fill:boolean }>} args.patterns
 * @param {Map<string, object>} args.stopsById GTFS stops.txt rows
 * @param {string} args.osmPath OSM extract covering the patterns
 * @param {string} args.workDir scratch directory (wiped)
 * @param {string} args.pfaedle binary
 * @returns {Promise<Map<string, ReturnType<typeof cutAtFailures>>>} by pattern key
 */
export async function matchPatterns({ patterns, stopsById, osmPath, workDir, pfaedle }) {
  const inDir = resolve(workDir, 'in');
  const outDir = resolve(workDir, 'out');
  await rm(workDir, { recursive: true, force: true });
  await mkdir(inDir, { recursive: true });

  const routes = new Map();
  const usedStops = new Set();
  const trips = [];
  const stopTimes = [];
  patterns.forEach((p, n) => {
    routes.set(p.route.route_id, p.route);
    const tripId = `p${n}`;
    trips.push({ route_id: p.route.route_id, service_id: 'all', trip_id: tripId });
    p.stops.forEach((s, i) => {
      usedStops.add(s.stop_id);
      stopTimes.push({
        trip_id: tripId,
        arrival_time: s.arrival_time || s.departure_time,
        departure_time: s.departure_time || s.arrival_time,
        stop_id: s.stop_id,
        stop_sequence: i + 1,
      });
    });
  });
  await writeCsv(
    `${inDir}/agency.txt`,
    ['agency_id', 'agency_name', 'agency_url', 'agency_timezone'],
    [
      {
        agency_id: 'a',
        agency_name: 'a',
        agency_url: 'https://example.org',
        agency_timezone: 'Europe/Paris',
      },
    ],
  );
  await writeCsv(
    `${inDir}/routes.txt`,
    ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'],
    [...routes.values()].map((r) => ({
      route_id: r.route_id,
      agency_id: 'a',
      // pfaedle matches line names against OSM route relations.
      route_short_name: r.route_short_name ?? '',
      route_long_name: r.route_long_name ?? '',
      route_type: pfaedleRouteType(r.route_type),
    })),
  );
  await writeCsv(
    `${inDir}/stops.txt`,
    ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
    [...usedStops].map((id) => {
      const s = stopsById.get(id);
      return { stop_id: id, stop_name: s.stop_name, stop_lat: s.stop_lat, stop_lon: s.stop_lon };
    }),
  );
  await writeCsv(
    `${inDir}/calendar.txt`,
    [
      'service_id',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'start_date',
      'end_date',
    ],
    [
      {
        service_id: 'all',
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1,
        sunday: 1,
        start_date: '20200101',
        end_date: '20991231',
      },
    ],
  );
  await writeCsv(`${inDir}/trips.txt`, ['route_id', 'service_id', 'trip_id'], trips);
  await writeCsv(
    `${inDir}/stop_times.txt`,
    ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
    stopTimes,
  );

  const args = ['-D', '-m', 'bus,coach', '-x', osmPath, '-o', outDir, '-d', workDir];
  if (process.env.PFAEDLE_CONFIG) args.push('-c', process.env.PFAEDLE_CONFIG);
  args.push(inDir);
  const r = spawnSync(pfaedle, args, { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (r.error || r.status !== 0 || !existsSync(`${outDir}/shapes.txt`)) {
    const tail = (r.stderr ?? '').trim().split('\n').slice(-3).join(' | ');
    throw new Error(`pfaedle failed (status ${r.status}): ${r.error?.message ?? tail}`);
  }

  const shapes = new Map();
  await readRows(`${outDir}/shapes.txt`, (row) => {
    let a = shapes.get(row.shape_id);
    if (!a) shapes.set(row.shape_id, (a = []));
    a.push({
      seq: Number(row.shape_pt_sequence),
      lon: Number(row.shape_pt_lon),
      lat: Number(row.shape_pt_lat),
      sd: Number(row.shape_dist_traveled),
    });
  });
  for (const a of shapes.values()) a.sort((x, y) => x.seq - y.seq);
  const shapeOfTrip = new Map(
    (await readAllRows(`${outDir}/trips.txt`)).map((t) => [t.trip_id, t.shape_id]),
  );
  const placedByTrip = new Map();
  await readRows(`${outDir}/stop_times.txt`, (row) => {
    let a = placedByTrip.get(row.trip_id);
    if (!a) placedByTrip.set(row.trip_id, (a = []));
    a.push({
      seq: Number(row.stop_sequence),
      id: row.stop_id,
      sd: Number(row.shape_dist_traveled),
    });
  });

  const result = new Map();
  patterns.forEach((p, n) => {
    const tripId = `p${n}`;
    const shape = shapes.get(shapeOfTrip.get(tripId));
    const placed = placedByTrip.get(tripId);
    if (!shape || shape.length < 2 || !placed || placed.some((s) => !Number.isFinite(s.sd))) return;
    placed.sort((a, b) => a.seq - b.seq);
    const stops = placed.map((s) => {
      const st = stopsById.get(s.id);
      return { lon: Number(st.stop_lon), lat: Number(st.stop_lat), sd: s.sd };
    });
    result.set(p.key, cutAtFailures(shape, stops, { fill: p.fill }));
  });
  return result;
}
