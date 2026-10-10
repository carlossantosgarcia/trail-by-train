// Per-provider line ledger.
//
// A GTFS feed only ever describes the offer it currently publishes. When an
// operator swaps its winter edition for its summer one, lines simply vanish
// from the download — and because a rebuild replaces `lines.pmtiles` wholesale,
// they vanish from the map too. That is wrong for a hike planner: a bus that
// ran last winter is still evidence you can reach a trailhead by bus.
//
// The ledger is the durable record. Every build writes each line it saw —
// geometry included — to `lines-ledger.geojson.gz`, and the next build unions
// the feed's current lines with everything the ledger remembers. Lines the feed
// no longer carries are re-emitted with `archived: true` and the date we last
// saw them.
//
// Geometry has to be captured while the line is still in the feed: once it is
// gone, there is nowhere left to read it from. `lines.pmtiles` cannot serve as
// that record — tiling simplifies geometry per zoom level and is lossy.
//
// We deliberately record *when we saw a line*, not whether we think it is
// seasonal. "Seasonal" was previously inferred from a short active-date window,
// which conflates a genuinely winter-only line with a feed that only publishes
// a few weeks ahead — for some providers that misfired on every single route.
// How long ago we last saw a line is an observation, not an inference, and the
// UI turns it into an uncertainty the reader can judge.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { repairGeometry } from './shape-quality.mjs';

const MS_PER_DAY = 86400000;

/** Days since the epoch — the integer form map expressions can do maths on. */
export function isoToDayNumber(iso) {
  if (!iso) return null;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / MS_PER_DAY) : null;
}

export async function readLedger(path) {
  if (!existsSync(path)) return [];
  try {
    const raw = gunzipSync(await readFile(path)).toString('utf8');
    const fc = JSON.parse(raw);
    return Array.isArray(fc?.features) ? fc.features : [];
  } catch (err) {
    throw new Error(`ledger at ${path} is unreadable (${err.message})`);
  }
}

export async function writeLedger(path, features) {
  await mkdir(dirname(path), { recursive: true });
  const json = JSON.stringify({ type: 'FeatureCollection', features });
  await writeFile(path, gzipSync(Buffer.from(json, 'utf8'), { level: 9 }));
  return features.length;
}

function nameKey(props) {
  const short = (props?.route_short_name ?? '').trim().toLowerCase();
  const long = (props?.route_long_name ?? '').trim().toLowerCase();
  return short || long ? `${short}|${long}` : null;
}

/**
 * Guard against a feed that regenerates its ids between editions. Without it,
 * every rebuild would file the whole network as "archived" and re-add it under
 * new ids, doubling the ledger each time. Throwing is deliberate: `build.mjs`
 * isolates a provider failure and leaves its previous artifacts in place, so a
 * loud stop is safer than silent unbounded growth.
 *
 * `matchedCount` is how many live entries matched one already in the ledger.
 * Regenerated ids leave nearly all of them unmatched. A feed that merely
 * dropped lines keeps its ids, so its live entries match: that is a shrink,
 * which the ledger exists to absorb, not churn.
 */
export function assertNoRunawayChurn(kind, liveCount, archivedCount, providerId, matchedCount = 0) {
  const floor = kind === 'stops' ? 200 : 30;
  if (archivedCount <= floor) return;
  // With nothing live there is no ratio to judge and nothing to double: a feed
  // that published nothing this time simply archives what it had, and stays
  // that size on every later build. Only a feed that re-adds its network under
  // fresh ids can actually run away, and that requires live entries.
  if (liveCount === 0) return;
  if (archivedCount <= liveCount * 3) return;
  if (matchedCount * 2 >= liveCount) return;
  throw new Error(
    `${kind} ledger churn: ${archivedCount} archived vs ${liveCount} live for ${providerId}. ` +
      `The feed most likely regenerated its ids. Re-run with --reset-ledger once the ` +
      `matching key is fixed, or the ledger will double every build.`,
  );
}

/**
 * Union this build's lines with everything the ledger remembers.
 *
 * Returns the full feature set — it is both what gets tiled and what gets
 * written back as the next ledger, so live lines keep refreshing their
 * geometry while absent ones keep the last geometry we captured.
 */
export function mergeLineLedger({
  previous,
  current,
  buildDate,
  feedValidTo,
  providerId,
  excludedRouteIds = new Set(),
}) {
  // Repair or drop ledger entries whose geometry is unusable. The ledger holds
  // a line's last captured geometry indefinitely, so anything corrupt that got
  // in before these checks existed would be kept forever and drawn as an
  // archived line — a scribble is no better dashed than solid.
  //
  // Mirrors the build's two remedies: an implausible point splits the geometry
  // and the rest is kept; points out of path order discard the entry.
  const usable = [];
  let splitEntries = 0;
  let splitPoints = 0;
  for (const f of previous) {
    const repaired = repairGeometry(f?.geometry);
    if (!repaired) continue;
    if (repaired.invalidPoints > 0) {
      splitEntries += 1;
      splitPoints += repaired.invalidPoints;
      usable.push({ ...f, geometry: repaired.geometry });
    } else {
      usable.push(f);
    }
  }
  const discarded = previous.length - usable.length;
  if (discarded > 0) {
    console.warn(
      `[${providerId}] dropping ${discarded} ledger entr${discarded === 1 ? 'y' : 'ies'} ` +
        `whose stored geometry is not in path order`,
    );
  }
  if (splitEntries > 0) {
    console.warn(
      `[${providerId}] splitting ${splitEntries} ledger entr${splitEntries === 1 ? 'y' : 'ies'} ` +
        `at ${splitPoints} point(s) outside the served area`,
    );
  }
  // Routes the build now leaves out on purpose (trains in a bus feed) are
  // forgotten, not archived: they were never bus lines. Removed before name
  // matching too, so a coach sharing a train's name cannot inherit its entry.
  previous = usable.filter((f) => !excludedRouteIds.has(f?.properties?.route_id));
  const purged = usable.length - previous.length;
  if (purged > 0) {
    console.log(
      `[${providerId}] removing ${purged} ledger entr${purged === 1 ? 'y' : 'ies'} for routes now left out`,
    );
  }

  const prevById = new Map();
  const prevByName = new Map();
  for (const f of previous) {
    const p = f.properties ?? {};
    if (p.route_id) prevById.set(p.route_id, f);
    const nk = nameKey(p);
    if (nk && !prevByName.has(nk)) prevByName.set(nk, f);
  }

  const claimed = new Set();
  const live = [];
  let revived = 0;
  for (const f of current) {
    const p = f.properties;
    // Match on route_id first. Some feeds renumber their routes between
    // editions, so fall back to the line's name — otherwise the same bus
    // would be filed twice, once live and once archived forever.
    let prev = prevById.get(p.route_id);
    if (!prev) {
      const nk = nameKey(p);
      if (nk) prev = prevByName.get(nk);
    }
    if (prev) {
      claimed.add(prev);
      if (prev.properties?.archived) revived += 1;
    }
    live.push({
      ...f,
      properties: {
        ...p,
        archived: false,
        first_seen_on: prev?.properties?.first_seen_on ?? buildDate,
        last_seen_on: buildDate,
        last_seen_day: isoToDayNumber(buildDate),
        last_feed_valid_to: feedValidTo ?? null,
      },
    });
  }

  const archived = [];
  let newlyArchived = 0;
  for (const f of previous) {
    if (claimed.has(f)) continue;
    const p = f.properties ?? {};
    if (!p.archived) newlyArchived += 1;
    archived.push({
      ...f,
      properties: {
        ...p,
        archived: true,
        // Keep whatever we knew when we last saw it: last_seen_on is what the
        // UI ages, so it must not be bumped just because we rebuilt today.
        first_seen_on: p.first_seen_on ?? p.last_seen_on ?? null,
        last_seen_on: p.last_seen_on ?? null,
        last_seen_day: p.last_seen_day ?? isoToDayNumber(p.last_seen_on),
        last_feed_valid_to: p.last_feed_valid_to ?? null,
      },
    });
  }

  assertNoRunawayChurn('line', live.length, archived.length, providerId, claimed.size);

  return {
    features: [...live, ...archived],
    stats: {
      live: live.length,
      archived: archived.length,
      revived,
      newlyArchived,
    },
  };
}

/**
 * Same idea for stops: a line we keep on the map needs its stops, or there is
 * no way to see where it actually goes. Stops still served by the live network
 * additionally inherit the archived lines that used to call there.
 */
export function mergeStopLedger({
  previous,
  current,
  archivedRouteIds,
  knownRouteIds,
  providerId,
}) {
  const currentById = new Map(current.map((f) => [f.properties.stop_id, f]));
  const previousById = new Map(previous.map((f) => [f.properties?.stop_id, f]));

  const out = [];
  for (const f of current) {
    const prev = previousById.get(f.properties.stop_id);
    let serving = f.properties.serving_lines ?? [];
    if (prev) {
      const known = new Set(serving.map((l) => l.route_id));
      const carried = (prev.properties?.serving_lines ?? [])
        .filter((l) => archivedRouteIds.has(l.route_id) && !known.has(l.route_id))
        .map((l) => ({ ...l, archived: true }));
      if (carried.length > 0) serving = [...serving, ...carried];
    }
    out.push({
      ...f,
      properties: { ...f.properties, serving_lines: serving, archived: false },
    });
  }

  let archivedCount = 0;
  let orphaned = 0;
  const matched = current.filter((f) => previousById.has(f.properties.stop_id)).length;
  for (const f of previous) {
    const id = f.properties?.stop_id;
    if (!id || currentById.has(id)) continue;
    // Only keep a vanished stop if some line on the map still calls there.
    // Otherwise it is a dot with nothing attached — which happens when the
    // stop's only line was dropped for unusable geometry rather than archived.
    const serving = f.properties?.serving_lines ?? [];
    if (!serving.some((l) => knownRouteIds.has(l.route_id))) {
      orphaned += 1;
      continue;
    }
    archivedCount += 1;
    out.push({
      ...f,
      properties: {
        ...f.properties,
        // Only lines still on the map: one dropped since (a train left out, a
        // route with no usable geometry) must not linger in the stop's list.
        serving_lines: serving
          .filter((l) => knownRouteIds.has(l.route_id))
          .map((l) => ({ ...l, archived: true })),
        archived: true,
      },
    });
  }

  if (orphaned > 0) {
    console.warn(
      `[${providerId}] dropping ${orphaned} stop(s) left with no line on the map`,
    );
  }
  assertNoRunawayChurn('stops', current.length, archivedCount, providerId, matched);

  return { features: out, stats: { live: current.length, archived: archivedCount, orphaned } };
}

/** Stops farther than this from a recorded shape are not on it. */
export const ON_SHAPE_METRES = 200;
/** Share of a line's stops that must be on a recorded shape to reuse it. */
export const ON_SHAPE_SHARE = 0.9;

/** Metres from [lon, lat] `p` to the nearest point of `geometry`. */
export function distanceToGeometry(p, geometry) {
  const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110540;
  let best = Infinity;
  for (const part of parts) {
    for (let i = 1; i < part.length; i++) {
      const ax = (part[i - 1][0] - p[0]) * kx;
      const ay = (part[i - 1][1] - p[1]) * ky;
      const bx = (part[i][0] - p[0]) * kx;
      const by = (part[i][1] - p[1]) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/**
 * Geometry the ledger recorded for a line, for a feed that no longer ships
 * shapes. Returns `(route, stopPoints) => { geometry, shape_seen_on } | null`.
 *
 * The line is found as the ledger merge finds it — by route_id, then by name.
 * Its geometry is reused only when at least ON_SHAPE_SHARE of the stops the
 * line serves today lie within ON_SHAPE_METRES of it: the evidence that the
 * line still runs that way. Endpoints would not do: a school variant at either
 * end changes them without changing the route. `shape_seen_on` is when that
 * shape was last published: kept from an entry that was itself borrowed,
 * otherwise the day the entry was last seen.
 */
export function ledgerShapeLookup(previous) {
  const byId = new Map();
  const byName = new Map();
  for (const f of previous) {
    const p = f?.properties ?? {};
    if (p.route_id && !byId.has(p.route_id)) byId.set(p.route_id, f);
    const nk = nameKey(p);
    if (nk && !byName.has(nk)) byName.set(nk, f);
  }
  return (route, stopPoints) => {
    const nk = nameKey(route);
    const f = byId.get(route.route_id) ?? (nk ? byName.get(nk) : undefined);
    if (!f || stopPoints.length === 0) return null;
    const repaired = repairGeometry(f.geometry);
    if (!repaired) return null;
    const on = stopPoints.filter((pt) => distanceToGeometry(pt, repaired.geometry) <= ON_SHAPE_METRES);
    if (on.length < stopPoints.length * ON_SHAPE_SHARE) return null;
    const p = f.properties ?? {};
    return { geometry: repaired.geometry, shape_seen_on: p.shape_seen_on ?? p.last_seen_on ?? null };
  };
}
