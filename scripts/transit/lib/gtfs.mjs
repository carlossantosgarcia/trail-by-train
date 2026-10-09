// Shared GTFS helpers for the transit overlay build pipeline.
//
// Each helper reads a single GTFS file in streaming fashion so 100 MB+
// shapes.txt does not blow up Node's heap. The downstream provider build
// scripts orchestrate these helpers; everything provider-specific (download
// URL, attribution, search-URL template, filter rules) stays out of here.

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { spawn } from 'node:child_process';
import { parse } from 'csv-parse';

// ---------------------------------------------------------------------------
// Download + extract
// ---------------------------------------------------------------------------

/**
 * Download a GTFS zip to `destZip`. Streams to disk; no whole-file buffer.
 *
 * Returns the SHA-256 of the bytes written, which the weekly refresh compares
 * against the digest recorded in the provider's `meta.json` to decide whether
 * anything needs rebuilding. Hashing the archive rather than the extracted CSVs
 * is deliberately conservative: identical bytes cannot hold different data, so a
 * false "unchanged" is impossible. A publisher who rezips an identical feed just
 * causes the rebuild that used to happen unconditionally.
 */
const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_BACKOFF_MS = 2000;

/**
 * Is this failure worth retrying, or is the feed genuinely gone?
 *
 * Only transport-level faults and server-side errors retry. A 404 or 403 is a
 * fact about the feed and must reach the weekly report on the first run —
 * retrying it would delay the one signal that tells us a publisher has moved or
 * withdrawn their data.
 */
function isTransientDownloadFailure(err) {
  if (err?.permanent) return false;
  return true;
}

async function downloadOnce(url, destZip) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    const err = new Error(`GTFS download failed (${res.status}) ${url}`);
    // 5xx, 408 and 429 are the server having a moment; everything else in the
    // 4xx range is a statement about the resource.
    err.permanent = res.status < 500 && res.status !== 408 && res.status !== 429;
    throw err;
  }
  const hash = createHash('sha256');
  await pipeline(
    Readable.fromWeb(res.body),
    async function* (source) {
      for await (const chunk of source) {
        hash.update(chunk);
        yield chunk;
      }
    },
    createWriteStream(destZip),
  );
  const { size } = await stat(destZip);
  if (size < 1024) {
    const err = new Error(`GTFS download too small (${size} bytes) — likely an error page`);
    err.permanent = true;
    throw err;
  }
  return hash.digest('hex');
}

export async function downloadGtfs(url, destZip) {
  await mkdir(dirname(destZip), { recursive: true });
  // Retried because the archives are large and several arrive through redirect
  // chains: a 44 MB feed pulled while tippecanoe is tiling another provider was
  // observed to die mid-body with undici's "terminated", and succeeded on a
  // plain retry. A transient drop reported as breakage teaches us to ignore the
  // weekly report, which is the one thing that must stay trustworthy.
  let lastErr;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await downloadOnce(url, destZip);
    } catch (err) {
      lastErr = err;
      if (!isTransientDownloadFailure(err) || attempt === DOWNLOAD_ATTEMPTS) throw err;
      const cause = err.cause?.code ?? err.cause?.message ?? err.message;
      console.warn(
        `[gtfs] download attempt ${attempt}/${DOWNLOAD_ATTEMPTS} failed (${cause}) — retrying`,
      );
      await new Promise((r) => setTimeout(r, DOWNLOAD_BACKOFF_MS * attempt));
    }
  }
  throw lastErr;
}

/**
 * SHA-256 of a file already on disk, for the cached-zip path where no download
 * happened but the digest still has to be recorded.
 */
export async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Locating the GTFS inside the archive
// ---------------------------------------------------------------------------
//
// Publishers do not agree on what a "GTFS zip" contains. Three shapes turn up:
//
//   routes.txt, trips.txt, …            the common case
//   gtfs/routes.txt, gtfs/trips.txt     everything under one directory
//   20260803.zip, 20270101.zip          one archive per validity period
//
// Only the first ever worked here: `unzip` given a bare `routes.txt` matches
// nothing in the other two and exits 11, which reads as "feed is broken" when
// the feed is fine and merely packaged differently. Mobigo Jura switched to the
// third shape in August 2026; its siblings on the same cityway endpoints can
// follow at any time, so this resolves all three rather than special-casing one.

/** The file every GTFS feed must have — used to find where the feed lives. */
const GTFS_ANCHOR = 'routes.txt';
const MAX_NESTING = 3;

/** Entry names inside an archive, via `unzip -Z1` (zipinfo listing mode). */
async function listArchive(zipPath) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('unzip', ['-Z1', zipPath], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`unzip -Z1 exited ${code}`));
      resolvePromise(
        out
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
      );
    });
  });
}

/**
 * The directory prefix the GTFS files sit under ('' when they are at the top),
 * or null when this archive has no GTFS in it at all. The shallowest match
 * wins, so a feed that also ships a nested sample or backup copy resolves to
 * the real one.
 */
function gtfsPrefixOf(entries) {
  const depth = (e) => e.split('/').length;
  const hits = entries
    .filter((e) => e === GTFS_ANCHOR || e.endsWith(`/${GTFS_ANCHOR}`))
    .sort((a, b) => depth(a) - depth(b));
  if (!hits.length) return null;
  return hits[0].slice(0, hits[0].length - GTFS_ANCHOR.length);
}

/**
 * Order nested archives by how likely each is to be the feed in effect now.
 *
 * Publishers name these by the date the period starts (`20260803.zip` runs
 * until `20270101.zip` takes over), so the current one is the latest start that
 * is not in the future. If every period is still ahead, the earliest is the
 * nearest thing to current. Names that carry no date keep their listed order
 * and sort last, so a dated candidate is always preferred.
 */
function rankNestedArchives(entries, today) {
  const ymd = (name) => {
    const m = /(\d{8})/.exec(name.split('/').pop() ?? '');
    if (!m) return null;
    const [y, mo, d] = [m[1].slice(0, 4), m[1].slice(4, 6), m[1].slice(6, 8)];
    const t = Date.parse(`${y}-${mo}-${d}T00:00:00Z`);
    return Number.isFinite(t) ? t : null;
  };
  const zips = entries.filter((e) => /\.zip$/i.test(e));
  const dated = zips.map((n) => ({ n, d: ymd(n) })).filter((x) => x.d !== null);
  const undated = zips.filter((n) => ymd(n) === null);

  const current = dated.filter((x) => x.d <= today).sort((a, b) => b.d - a.d);
  const future = dated.filter((x) => x.d > today).sort((a, b) => a.d - b.d);
  return [...current, ...future].map((x) => x.n).concat(undated);
}

/**
 * Resolve an archive to the one actually holding the GTFS, unwrapping nested
 * archives as needed.
 *
 * Returns `{ zipPath, prefix }` — the archive to read and the directory prefix
 * to strip. Candidates are tried in preference order and each is verified to
 * contain the anchor before being accepted, so a publisher whose naming does
 * not match the date convention still resolves rather than failing outright.
 */
export async function resolveGtfsArchive(zipPath, workDir, depth = 0) {
  const entries = await listArchive(zipPath);

  const prefix = gtfsPrefixOf(entries);
  if (prefix !== null) return { zipPath, prefix };

  if (depth >= MAX_NESTING) {
    throw new Error(`GTFS archive nests deeper than ${MAX_NESTING} levels`);
  }

  const candidates = rankNestedArchives(entries, Date.now());
  if (!candidates.length) {
    throw new Error(
      `archive contains no ${GTFS_ANCHOR} and no nested archive ` +
        `(top-level entries: ${entries.slice(0, 5).join(', ') || 'none'})`,
    );
  }

  const errors = [];
  for (const candidate of candidates) {
    const innerDir = `${workDir}/nested-${depth}`;
    await mkdir(innerDir, { recursive: true });
    await new Promise((resolvePromise) => {
      const proc = spawn('unzip', ['-q', '-o', '-j', zipPath, candidate, '-d', innerDir], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      proc.on('error', () => resolvePromise());
      proc.on('close', () => resolvePromise());
    });
    const innerPath = `${innerDir}/${candidate.split('/').pop()}`;
    try {
      await stat(innerPath);
      const resolved = await resolveGtfsArchive(innerPath, innerDir, depth + 1);
      console.log(`  archive is nested — using ${candidate}`);
      return resolved;
    } catch (err) {
      errors.push(`${candidate}: ${err.message}`);
    }
  }
  throw new Error(`no nested archive held a usable GTFS — ${errors.join('; ')}`);
}

/**
 * Extract the listed files from a GTFS zip into `destDir`. Throws if any
 * required file is missing. Uses the system `unzip` binary (already used
 * elsewhere in the repo's scripts) to keep the dep footprint small.
 *
 * Returns the resolved archive so the caller can pull optional files from the
 * same place without paying to resolve it twice.
 */
export async function extractRequiredFiles(zipPath, destDir, requiredList) {
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });
  const resolved = await resolveGtfsArchive(zipPath, destDir);
  // -j junks paths, so a feed under a subdirectory lands flat in destDir and
  // every reader downstream stays oblivious to how it was packaged.
  const members = requiredList.map((name) => `${resolved.prefix}${name}`);
  await new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-q', '-o', '-j', resolved.zipPath, ...members, '-d', destDir], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`unzip exited ${code}`));
    });
  });
  for (const name of requiredList) {
    try {
      await stat(`${destDir}/${name}`);
    } catch {
      throw new Error(`GTFS feed is missing required file: ${name}`);
    }
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Multi-archive providers
// ---------------------------------------------------------------------------
//
// Some authorities publish one network as several archives. Nord (59) and Oise
// (60) each ship four, split by contract lot (`CAR_HDF_59_1`…`_4`) — operational
// packages, not places, so exposing them as four toggles would tell a user
// nothing. `gtfsUrl` therefore accepts an array, and these helpers make N
// archives look to the rest of the build exactly like one.
//
// Identifiers are namespaced per archive before merging. Two lots each
// numbering a route `1` is normal and must not collapse into a single line.

/** Which columns of each GTFS file hold ids that must be namespaced. */
const ID_FIELDS = {
  'agency.txt': ['agency_id'],
  'routes.txt': ['route_id', 'agency_id'],
  'trips.txt': ['route_id', 'service_id', 'trip_id', 'shape_id', 'block_id'],
  'stops.txt': ['stop_id', 'parent_station'],
  'stop_times.txt': [
    'trip_id',
    'stop_id',
    'pickup_booking_rule_id',
    'drop_off_booking_rule_id',
  ],
  'calendar.txt': ['service_id'],
  'calendar_dates.txt': ['service_id'],
  'shapes.txt': ['shape_id'],
  'transfers.txt': ['from_stop_id', 'to_stop_id'],
  'frequencies.txt': ['trip_id'],
  'booking_rules.txt': ['booking_rule_id'],
};

/** Minimal RFC-4180 field writer — csv-stringify is not a dependency here. */
function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Merge one GTFS file across several extracted archives into `destDir/<name>`.
 *
 * Streams row by row: `stop_times.txt` and `shapes.txt` run to hundreds of MB
 * and must never be held in memory. The column set is the union across archives,
 * so a lot that ships an extra optional column does not shift everyone's fields.
 */
async function mergeGtfsFile(name, srcDirs, destDir) {
  const idFields = ID_FIELDS[name] ?? [];
  const present = [];
  for (const { dir, token } of srcDirs) {
    try {
      await stat(`${dir}/${name}`);
      present.push({ dir, token });
    } catch {
      // This archive does not ship this file; the others may.
    }
  }
  if (present.length === 0) return false;

  // First pass for the header union. Cheap: csv-parse yields objects keyed by
  // column, so one row per archive is enough to learn its columns.
  const columns = [];
  const seen = new Set();
  for (const { dir } of present) {
    let first = null;
    await readRows(`${dir}/${name}`, (row) => {
      if (first === null) first = row;
    });
    for (const key of Object.keys(first ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  if (columns.length === 0) return false;

  const out = createWriteStream(`${destDir}/${name}`);
  const write = (line) =>
    out.write(line) ? Promise.resolve() : new Promise((r) => out.once('drain', r));
  await write(columns.join(',') + '\n');

  for (const { dir, token } of present) {
    await readRows(`${dir}/${name}`, (row) => {
      for (const f of idFields) {
        // Never namespace an empty value: an absent shape_id or parent_station
        // means "none", and prefixing it would invent an id that resolves to
        // nothing downstream.
        if (row[f]) row[f] = `${token}:${row[f]}`;
      }
      out.write(columns.map((c) => csvField(row[c])).join(',') + '\n');
    });
  }
  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });
  return true;
}

/**
 * Extract and merge one or more archives into `destDir`, leaving it looking
 * exactly like a single extracted feed.
 *
 * A single archive takes the original path verbatim — no parse, no rewrite, no
 * namespacing — so existing providers are bit-for-bit unaffected by this
 * feature. `feed_info.txt` is merged to the *intersection* of the archives'
 * validity windows, which is the only window during which the whole provider is
 * actually valid.
 */
export async function extractArchives(zipPaths, destDir, requiredList, optionalList = []) {
  if (zipPaths.length === 1) {
    const resolved = await extractRequiredFiles(zipPaths[0], destDir, requiredList);
    await extractOptionalFiles(resolved, destDir, optionalList);
    return resolved;
  }

  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });

  const srcDirs = [];
  for (const [i, zipPath] of zipPaths.entries()) {
    const dir = `${destDir}/__src${i}`;
    await mkdir(dir, { recursive: true });
    const resolved = await extractRequiredFiles(zipPath, dir, requiredList);
    await extractOptionalFiles(resolved, dir, optionalList);
    srcDirs.push({ dir, token: `a${i}` });
  }

  const names = new Set([...requiredList, ...optionalList, 'transfers.txt', 'frequencies.txt']);
  for (const name of names) {
    if (name === 'feed_info.txt') continue;
    await mergeGtfsFile(name, srcDirs, destDir);
  }

  await mergeFeedInfo(srcDirs, destDir);

  for (const name of requiredList) {
    if (name === 'feed_info.txt') continue;
    try {
      await stat(`${destDir}/${name}`);
    } catch {
      throw new Error(`merged GTFS feed is missing required file: ${name}`);
    }
  }
  for (const { dir } of srcDirs) await rm(dir, { recursive: true, force: true });
  return { zipPath: zipPaths[0], prefix: '' };
}

/**
 * Narrowest validity window across archives. Overstating it would let the
 * validity banner claim currency the least-current lot cannot support.
 */
async function mergeFeedInfo(srcDirs, destDir) {
  const rows = [];
  for (const { dir } of srcDirs) {
    try {
      await stat(`${dir}/feed_info.txt`);
    } catch {
      continue;
    }
    const r = await readAllRows(`${dir}/feed_info.txt`);
    if (r[0]) rows.push(r[0]);
  }
  if (rows.length === 0) return false;
  const starts = rows.map((r) => r.feed_start_date).filter(Boolean).sort();
  const ends = rows.map((r) => r.feed_end_date).filter(Boolean).sort();
  const merged = {
    ...rows[0],
    feed_start_date: starts.length ? starts[starts.length - 1] : '',
    feed_end_date: ends.length ? ends[0] : '',
  };
  const columns = Object.keys(merged);
  await new Promise((resolve, reject) => {
    const out = createWriteStream(`${destDir}/feed_info.txt`);
    out.write(columns.join(',') + '\n');
    out.write(columns.map((c) => csvField(merged[c])).join(',') + '\n');
    out.end((err) => (err ? reject(err) : resolve()));
  });
  return true;
}

/**
 * Download every archive of a provider and return one digest standing for the
 * whole set: the SHA-256 of the per-archive digests in order. A change in any
 * one archive moves it, so the "feed unchanged, skip rebuild" path keeps working
 * for multi-archive providers exactly as it does for single ones.
 *
 * An archive that fails to download fails the provider. Publishing a partial
 * network would read on the map as lines having been withdrawn.
 */
export async function downloadGtfsArchives(urls, zipPathFor) {
  const shas = [];
  for (const [i, url] of urls.entries()) {
    shas.push(await downloadGtfs(url, zipPathFor(i)));
  }
  if (shas.length === 1) return shas[0];
  return createHash('sha256').update(shas.join('')).digest('hex');
}

/** Same digest, for archives already cached on disk. */
export async function hashArchives(zipPaths) {
  const shas = [];
  for (const p of zipPaths) shas.push(await hashFile(p));
  if (shas.length === 1) return shas[0];
  return createHash('sha256').update(shas.join('')).digest('hex');
}

/**
 * Pull files we can use but do not depend on, without failing when the feed
 * omits them. Kept separate from `extractRequiredFiles` so an optional file
 * never has to be listed per provider in `requiredFiles` — where its absence
 * would abort the build.
 *
 * Must run after `extractRequiredFiles`, which clears the destination — and
 * takes the archive that call resolved, so a nested or subdirectory feed is
 * unwrapped once rather than once per lookup.
 */
export async function extractOptionalFiles(resolved, destDir, optionalList) {
  const { zipPath, prefix } = resolved;
  const present = [];
  for (const name of optionalList) {
    await new Promise((resolve) => {
      const proc = spawn('unzip', ['-q', '-o', '-j', zipPath, `${prefix}${name}`, '-d', destDir], {
        stdio: ['ignore', 'inherit', 'ignore'],
      });
      proc.on('error', () => resolve());
      proc.on('close', () => resolve());
    });
    try {
      await stat(`${destDir}/${name}`);
      present.push(name);
    } catch {
      // Feed does not ship it; that is a valid state, not an error.
    }
  }
  return present;
}

// ---------------------------------------------------------------------------
// Streaming row readers
// ---------------------------------------------------------------------------

/**
 * Stream rows from a GTFS CSV file. `onRow(record)` is called for each
 * parsed object; await resolution before returning.
 */
export async function readRows(filePath, onRow) {
  const gzipped = filePath.endsWith('.gz');
  const inStream = createReadStream(filePath);
  const sourceStream = gzipped ? inStream.pipe(createGunzip()) : inStream;
  const parser = sourceStream.pipe(
    parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      trim: true,
    }),
  );
  for await (const record of parser) {
    onRow(record);
  }
}

/** Convenience: collect all rows of a small GTFS file into an array. */
export async function readAllRows(filePath) {
  const rows = [];
  await readRows(filePath, (r) => rows.push(r));
  return rows;
}

// ---------------------------------------------------------------------------
// Calendars → per-service-id summary (D5)
// ---------------------------------------------------------------------------

const DAY_COLUMNS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
// 0 = Monday … 6 = Sunday — matches GTFS column order above. Used so we can
// derive day-of-week from a `YYYYMMDD` string without pulling in a date lib.
function dowFromYmd(ymd) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  // Sunday=0 → shift to Mon=0
  const js = new Date(Date.UTC(y, m, d)).getUTCDay();
  return (js + 6) % 7;
}

function ymdToIso(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/**
 * Build per-service summary: which day-types it covers and how many active
 * dates fall in each, plus the active date window. We bucket day-types as
 * weekday (Mon–Fri), saturday, sunday-or-holiday. `calendar_dates.txt`
 * exceptions are applied (type 1 = added service, type 2 = removed).
 */
export function buildServiceWindowsByDayType(calendar, calendarDates) {
  /** @type {Map<string, { weekday: Set<string>, saturday: Set<string>, sunday: Set<string>, windowStart: string|null, windowEnd: string|null }>} */
  const out = new Map();

  function bucketFor(dow) {
    if (dow <= 4) return 'weekday';
    if (dow === 5) return 'saturday';
    return 'sunday';
  }

  function ensure(serviceId) {
    let entry = out.get(serviceId);
    if (!entry) {
      entry = {
        weekday: new Set(),
        saturday: new Set(),
        sunday: new Set(),
        windowStart: null,
        windowEnd: null,
      };
      out.set(serviceId, entry);
    }
    return entry;
  }

  for (const row of calendar) {
    const serviceId = row.service_id;
    const start = row.start_date;
    const end = row.end_date;
    if (!serviceId || !start || !end) continue;
    const entry = ensure(serviceId);
    entry.windowStart = entry.windowStart && entry.windowStart < start ? entry.windowStart : start;
    entry.windowEnd = entry.windowEnd && entry.windowEnd > end ? entry.windowEnd : end;
    const activeDays = DAY_COLUMNS.map((c) => row[c] === '1');
    // Walk every date in [start, end] and bucket if activeDays says so.
    let cursor = start;
    while (cursor <= end) {
      const dow = dowFromYmd(cursor);
      if (activeDays[dow]) {
        entry[bucketFor(dow)].add(cursor);
      }
      cursor = nextDayYmd(cursor);
    }
  }

  for (const row of calendarDates) {
    const serviceId = row.service_id;
    const date = row.date;
    const type = row.exception_type;
    if (!serviceId || !date || !type) continue;
    const entry = ensure(serviceId);
    const bucket = bucketFor(dowFromYmd(date));
    if (type === '1') {
      entry[bucket].add(date);
      if (!entry.windowStart || date < entry.windowStart) entry.windowStart = date;
      if (!entry.windowEnd || date > entry.windowEnd) entry.windowEnd = date;
    } else if (type === '2') {
      entry[bucket].delete(date);
    }
  }

  return out;
}

function nextDayYmd(ymd) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6)) - 1;
  const d = Number(ymd.slice(6, 8));
  const next = new Date(Date.UTC(y, m, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

// ---------------------------------------------------------------------------
// Per-route service stats (D2 — directions merged)
// ---------------------------------------------------------------------------

function hhmmFromGtfsTime(t) {
  // GTFS allows hours ≥ 24 for trips that span midnight. We normalise to
  // 24h modulo by taking modulo 24 — popups only care about the wall-clock
  // first/last departure.
  const [h, m] = t.split(':');
  const hh = String(Number(h) % 24).padStart(2, '0');
  return `${hh}:${m}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Compute first/last/trips/avgGap per day-type for one route, both
 * directions merged. Returns `{ weekday, saturday, sunday }` of
 * `ServiceWindow | null`.
 */
export function computeRouteServiceStats(routeTrips, firstStopTimeByTrip, serviceWindows) {
  const dayBuckets = { weekday: [], saturday: [], sunday: [] };
  for (const trip of routeTrips) {
    const firstStop = firstStopTimeByTrip.get(trip.trip_id);
    if (!firstStop) continue;
    const sw = serviceWindows.get(trip.service_id);
    if (!sw) continue;
    const dep = firstStop.departure_time;
    if (!dep) continue;
    // Weight = number of active dates in this day-type bucket. Trips on a
    // service_id covering 20 weekdays contribute 1× per departure; a trip
    // that only runs 2 specific weekdays contributes proportionally less
    // — but for popup-grade stats we just count "does this trip run any
    // weekday at all?" and merge.
    if (sw.weekday.size > 0) dayBuckets.weekday.push(dep);
    if (sw.saturday.size > 0) dayBuckets.saturday.push(dep);
    if (sw.sunday.size > 0) dayBuckets.sunday.push(dep);
  }
  function summarise(deps) {
    if (deps.length === 0) return null;
    // By time, not as text: GTFS allows "9:05:00", which sorts after
    // "10:00:00" as a string and made the wrong departure first or last.
    const sorted = [...deps].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    const minutes = sorted.map(timeToMinutes);
    let avgGap = 0;
    if (minutes.length > 1) {
      let total = 0;
      for (let i = 1; i < minutes.length; i += 1) {
        total += minutes[i] - minutes[i - 1];
      }
      avgGap = Math.round(total / (minutes.length - 1));
    }
    return {
      firstDep: hhmmFromGtfsTime(sorted[0]),
      lastDep: hhmmFromGtfsTime(sorted.at(-1)),
      trips: sorted.length,
      avgGapMin: avgGap,
    };
  }
  return {
    weekday: summarise(dayBuckets.weekday),
    saturday: summarise(dayBuckets.saturday),
    sunday: summarise(dayBuckets.sunday),
  };
}

// ---------------------------------------------------------------------------
// TAD / seasonal detection (D5)
// ---------------------------------------------------------------------------

/**
 * Seasonal = effective service window (the union of all date sets across
 * all serviced day-types for this route) shorter than 180 days. We pass
 * in the already-merged window for the route.
 */
/**
 * The window of dates a route is actually active over, as published.
 *
 * This replaces the old `detectSeasonal`, which called a route "seasonal" when
 * its window was under 180 days. That conflated two unrelated things: a line
 * that genuinely only runs in winter, and a feed that only ever publishes a few
 * weeks ahead. Measured across the registered providers it misfired badly —
 * every single Zou! Proximité route came out "seasonal" purely because of the
 * publication horizon. So we no longer classify: we report the observed window
 * and let the freshness of the observation carry the uncertainty.
 */
export function observedWindow(activeDates) {
  if (!activeDates || activeDates.size === 0) {
    return { observed_from: null, observed_to: null, observed_days: 0 };
  }
  const sorted = [...activeDates].sort();
  const first = sorted[0];
  const last = sorted.at(-1);
  return {
    observed_from: ymdToIso(first),
    observed_to: ymdToIso(last),
    observed_days: daysBetween(first, last) + 1,
  };
}

function daysBetween(ymdA, ymdB) {
  const toMs = (s) =>
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
  return Math.round((toMs(ymdB) - toMs(ymdA)) / 86400000);
}

export { ymdToIso };
