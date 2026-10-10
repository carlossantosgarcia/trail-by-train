// Build public/rail-stations.geojson: the stations a passenger can take a train
// from.
//
// A station is published when either
//   - a train calls at it in SNCF's or Transilien's timetables (GTFS), or
//   - SNCF lists it among its passenger stations ("Gares de voyageurs").
// The timetables cover the next six months only, so the list is what keeps a
// summer-only line (Quiberon, the Côte Fleurie), a tram-train or a line shut
// for works on the map. The list in turn lacks a few halts the timetables
// have (the Train Jaune's request stops).
//
// "Liste des gares", which this layer used to come from, now lends communes
// only: it has not been updated since 2022. It places Grasse in Marseille,
// lacks the stations opened since (Ranguin, Le Bosquet, Mouans-Sartoux) and
// still lists some 270 stations no train calls at, Felletin and Aubusson among
// them.
//
// Sources: SNCF Open Data (ODbL); geo.api.gouv.fr for the commune of a station
// the register does not know (Licence Ouverte).
//
//   node scripts/build-rail-stations.mjs
//
// Requires: unzip. Run by the data workflow (.github/workflows/data.yml) or
// locally. Never invoked at runtime.

import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadGtfs, extractRequiredFiles, readAllRows, readRows } from './transit/lib/gtfs.mjs';
import { mergeStations, railTripIds, servedStations, toFeatures } from './rail-stations/lib.mjs';

const TIMETABLES = [
  {
    id: 'sncf',
    label: 'SNCF timetables (GTFS)',
    url: 'https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip',
  },
  {
    id: 'transilien',
    label: 'Transilien timetables (GTFS)',
    url: 'https://eu.ftp.opendatasoft.com/sncf/gtfs/transilien-gtfs.zip',
  },
];
const SNCF_API = 'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets';
const PASSENGER_STATIONS_URL = `${SNCF_API}/gares-de-voyageurs/exports/json?select=nom,codes_uic,position_geographique`;
const REGISTER_URL = `${SNCF_API}/liste-des-gares/exports/json?select=code_uic,commune,geo_point_2d`;
const COMMUNE_AT = (lon, lat) =>
  `https://geo.api.gouv.fr/communes?lon=${lon}&lat=${lat}&fields=nom&format=json`;

// A source that comes back nearly empty is broken, not a network that closed.
// Publishing it would wipe most stations off the map until the next build.
const MIN_SERVED = 2000;
const MIN_PASSENGER_STATIONS = 2000;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(REPO_ROOT, 'public/rail-stations.geojson');

async function fetchJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res.json();
}

async function readTimetable(feed, workDir) {
  const zip = join(workDir, `${feed.id}.zip`);
  const dir = join(workDir, feed.id);
  console.log(`  ${feed.id}: downloading ${feed.url}`);
  await downloadGtfs(feed.url, zip);
  await extractRequiredFiles(zip, dir, ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']);
  const [stops, routes, trips] = await Promise.all(
    ['stops.txt', 'routes.txt', 'trips.txt'].map((f) => readAllRows(join(dir, f))),
  );
  const rail = railTripIds(routes, trips);
  const served = new Set();
  await readRows(join(dir, 'stop_times.txt'), (r) => {
    if (rail.has(r.trip_id)) served.add(r.stop_id);
  });
  const stations = servedStations(stops, served);
  console.log(`  ${feed.id}: ${rail.size} train trips call at ${stations.size} stations`);
  return stations;
}

async function readPassengerStations() {
  const rows = await fetchJson(PASSENGER_STATIONS_URL, 'Gares de voyageurs');
  const stations = rows
    .filter((r) => r.position_geographique && r.nom)
    .map((r) => ({
      name: r.nom.trim(),
      coord: [r.position_geographique.lon, r.position_geographique.lat],
      uics: (r.codes_uic ?? '')
        .split(';')
        .map((u) => u.trim())
        .filter(Boolean),
    }));
  console.log(`  ${stations.length} passenger stations`);
  if (stations.length < MIN_PASSENGER_STATIONS) {
    throw new Error(
      `only ${stations.length} passenger stations listed (expected ≥ ${MIN_PASSENGER_STATIONS})`,
    );
  }
  return stations;
}

async function readRegister() {
  const rows = await fetchJson(REGISTER_URL, 'Liste des gares');
  return rows
    .filter((r) => r.geo_point_2d && r.code_uic && r.commune)
    .map((r) => ({
      uic: r.code_uic,
      commune: r.commune,
      coord: [r.geo_point_2d.lon, r.geo_point_2d.lat],
    }));
}

// About 80 stations have no register row nearby (RER-only stations in Paris,
// lines reopened since 2022, Grasse). Ask geo.api.gouv.fr which commune each is
// in, upper-cased like the register's. A station in no French commune is
// outside the app's scope and dropped: SNCF numbers Basel's French platforms,
// Le Locle and Monaco as French. A failed lookup leaves the commune empty
// rather than failing the build: it is a label, not a position.
async function fillCommunes(stations) {
  const missing = stations.filter((s) => !s.commune);
  const abroad = new Set();
  let filled = 0;
  for (const s of missing) {
    try {
      const res = await fetch(COMMUNE_AT(s.coord[0], s.coord[1]));
      if (!res.ok) continue;
      const [hit] = await res.json();
      if (!hit) abroad.add(s);
      if (!hit?.nom) continue;
      s.commune = hit.nom.toLocaleUpperCase('fr');
      filled += 1;
    } catch {
      // leave it empty
    }
  }
  return { missing: missing.length, filled, abroad };
}

const workDir = await mkdtemp(join(tmpdir(), 'rail-stations-'));
try {
  console.log('[1/3] timetables: stations a train calls at');
  const timetables = [];
  for (const feed of TIMETABLES) timetables.push(await readTimetable(feed, workDir));
  const served = mergeStations(timetables, []);
  if (served.length < MIN_SERVED) {
    throw new Error(`only ${served.length} stations in the timetables (expected ≥ ${MIN_SERVED})`);
  }
  const servedNames = new Set(served.map((s) => s.name));

  console.log('[2/3] SNCF lists: passenger stations, communes');
  const passengerStations = await readPassengerStations();
  const register = await readRegister();
  const merged = mergeStations([...timetables, passengerStations], register);
  const communes = await fillCommunes(merged);
  const stations = merged.filter((s) => !communes.abroad.has(s));
  console.log(
    `  ${communes.missing} stations away from any register row; ${communes.filled} communes found on geo.api.gouv.fr; ` +
      `${communes.abroad.size} outside France left out (${[...communes.abroad].map((s) => s.name).join(', ')})`,
  );

  console.log('[3/3] writing');
  const features = toFeatures(stations);
  const fc = {
    type: 'FeatureCollection',
    _build: {
      sources: [
        ...TIMETABLES.map((f) => f.label),
        'SNCF Gares de voyageurs',
        'SNCF Liste des gares (communes)',
        'geo.api.gouv.fr (communes)',
      ],
      built: new Date().toISOString().slice(0, 10),
    },
    features,
  };
  const tmp = `${OUT_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(fc));
  await rename(tmp, OUT_FILE);
  // The timetables come first in the merge, so a served station keeps its name.
  const listedOnly = features.filter((f) => !servedNames.has(f.properties.name)).length;
  const noCommune = features.filter((f) => !f.properties.commune).length;
  console.log(
    `\ndone. ${OUT_FILE}\n      ${features.length} stations: ${features.length - listedOnly} with a train in the timetables, ` +
      `${listedOnly} listed by SNCF with none (seasonal, tram-train, works); ${noCommune} without a commune`,
  );
} finally {
  await rm(workDir, { recursive: true, force: true });
}
