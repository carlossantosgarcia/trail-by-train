#!/usr/bin/env node
// Assign every GR route a palette COLOUR INDEX by spatial graph colouring,
// and write the mapping to scripts/gr/gr-colour-index.json.
//
// Why indices and not colours: graph colouring answers "which routes must
// differ from each other"; a palette answers "what differing looks like".
// Keeping them apart means the palette can be swapped without recomputing anything, and this
// artifact never has to be regenerated for an aesthetic change.
//
// Why graph colouring and not the cycling that Explore uses: Explore only
// colours the handful of lines inside a drawn region, so cycling a palette in
// registry order is fine there. Every GR is on screen at once nationwide, so
// the requirement is spatial — two GRs at opposite ends of France sharing a
// colour is invisible and fine, two that cross is the bug. Measured on the
// 166-route network: cycling 12 colours still leaves 28 of 429 neighbouring
// pairs sharing a colour; graph colouring reaches zero with 7.
//
// Input:  scripts/gr/.cache/gr-routes.normalized.geojson  (from gr:fetch)
// Output: public/data/gr-colour-index.json
//
// The output lives in public/data/ rather than beside this script because it
// is a *served* asset, not just a build artifact: the app fetches it at
// runtime to colour GR lines. Vite copies public/ verbatim into dist/.
//
// This script does NOT touch public/data/gr-routes.pmtiles — the colour
// assignment deliberately lives outside the tiles so it stays diffable and
// does not churn an ~11 MB binary.
//
// Run: npm run gr:colours  [-- --colours=N]

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN_FILE = resolve(__dirname, '.cache/gr-routes.normalized.geojson');
const OUT_FILE = resolve(__dirname, '../../public/data/gr-colour-index.json');

/**
 * Grid cell size in degrees for the adjacency test. At French latitudes 0.1°
 * is roughly 7.9 km east-west and 11.1 km north-south. Two routes count as
 * adjacent when they both put a vertex in the same cell.
 *
 * Deliberately generous: it over-constrains (treating routes up to ~11 km
 * apart as needing different colours) rather than under-constrains. Exact
 * segment-to-segment distance would be more precise and far slower over 50 MB
 * of geometry, and buys nothing — the colouring already reaches zero
 * collisions under this stricter definition.
 */
const CELL_DEG = 0.1;

/** Default number of palette slots to spread routes across. */
const DEFAULT_COLOURS = 12;

function parseArgs(argv) {
  let colours = DEFAULT_COLOURS;
  for (const arg of argv.slice(2)) {
    const m = /^--colours=(\d+)$/.exec(arg);
    if (m) colours = Number(m[1]);
  }
  if (!Number.isInteger(colours) || colours < 1) {
    console.error(`error: --colours must be a positive integer, got ${colours}`);
    process.exit(1);
  }
  return { colours };
}

/** Walk LineString / MultiLineString coordinates, calling fn on each [lon, lat]. */
function eachVertex(coords, fn) {
  if (coords.length === 0) return;
  if (typeof coords[0] === 'number') {
    fn(coords);
    return;
  }
  for (const c of coords) eachVertex(c, fn);
}

function cellKey(lon, lat) {
  return `${Math.floor(lon / CELL_DEG)},${Math.floor(lat / CELL_DEG)}`;
}

async function main() {
  const { colours: targetColours } = parseArgs(process.argv);

  if (!existsSync(IN_FILE)) {
    console.error(`error: ${IN_FILE} not found`);
    console.error("  run 'npm run gr:fetch' first to produce the normalized GeoJSON");
    process.exit(1);
  }

  const fc = JSON.parse(await readFile(IN_FILE, 'utf8'));
  if (!Array.isArray(fc.features) || fc.features.length === 0) {
    console.error('error: input FeatureCollection has no features');
    process.exit(1);
  }

  // ---- Bin every vertex into grid cells, per ref.
  const cellsByRef = new Map();
  for (const f of fc.features) {
    const ref = f?.properties?.ref;
    if (typeof ref !== 'string' || ref.length === 0) continue;
    if (!cellsByRef.has(ref)) cellsByRef.set(ref, new Set());
    const set = cellsByRef.get(ref);
    eachVertex(f.geometry.coordinates, ([lon, lat]) => set.add(cellKey(lon, lat)));
  }

  const refs = [...cellsByRef.keys()].sort();
  if (refs.length === 0) {
    console.error('error: no features carried a usable `ref`');
    process.exit(1);
  }

  // ---- Adjacency: two refs are neighbours when they share a cell.
  const refsByCell = new Map();
  for (const [ref, cells] of cellsByRef) {
    for (const cell of cells) {
      if (!refsByCell.has(cell)) refsByCell.set(cell, new Set());
      refsByCell.get(cell).add(ref);
    }
  }
  const adjacency = new Map(refs.map((r) => [r, new Set()]));
  for (const shared of refsByCell.values()) {
    if (shared.size < 2) continue;
    const list = [...shared];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        adjacency.get(list[i]).add(list[j]);
        adjacency.get(list[j]).add(list[i]);
      }
    }
  }
  let adjacentPairs = 0;
  for (const [ref, neighbours] of adjacency) {
    for (const other of neighbours) if (ref < other) adjacentPairs += 1;
  }

  // ---- Balanced greedy colouring.
  //
  // Hardest-first (descending degree) is the standard greedy ordering and is
  // what keeps the colour count low. The tie-break is the part that matters
  // visually: among the indices no neighbour has taken, pick the one used
  // least so far. Plain greedy takes the lowest legal index every time, which
  // on this network yields {54,46,28,19,13,5,1} — a third of the GRs in one
  // hue, technically correct and visually poor.
  //
  // Zero adjacent collisions is the hard constraint; balance is only a
  // tie-break within it. If every index below targetColours is blocked by a
  // neighbour we extend past the target rather than emit a collision.
  const order = [...refs].sort((a, b) => {
    const d = adjacency.get(b).size - adjacency.get(a).size;
    return d !== 0 ? d : a.localeCompare(b);
  });

  const assigned = new Map();
  const usage = new Array(targetColours).fill(0);

  for (const ref of order) {
    const blocked = new Set();
    for (const other of adjacency.get(ref)) {
      const c = assigned.get(other);
      if (c !== undefined) blocked.add(c);
    }
    let best = -1;
    for (let i = 0; i < usage.length; i++) {
      if (blocked.has(i)) continue;
      if (best === -1 || usage[i] < usage[best]) best = i;
    }
    if (best === -1) {
      // Every slot is taken by a neighbour — grow the palette rather than
      // collide. With 12 slots and a max degree of ~36 this should not fire,
      // but correctness must not depend on that.
      best = usage.length;
      usage.push(0);
    }
    assigned.set(ref, best);
    usage[best] += 1;
  }

  // ---- Verify the hard constraint before writing anything.
  const collisions = [];
  for (const [ref, neighbours] of adjacency) {
    for (const other of neighbours) {
      if (ref < other && assigned.get(ref) === assigned.get(other)) {
        collisions.push(`${ref}/${other}`);
      }
    }
  }
  if (collisions.length > 0) {
    console.error(`error: ${collisions.length} adjacent pairs share a colour index`);
    console.error(`  examples: ${collisions.slice(0, 10).join(', ')}`);
    console.error('  refusing to write the artifact');
    process.exit(1);
  }

  // ---- Write, sorted by ref so diffs between builds stay readable.
  const out = {};
  for (const ref of refs) out[ref] = assigned.get(ref);
  await writeFile(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);

  const usedSlots = usage.filter((n) => n > 0).length;
  console.error('---');
  console.error(`[summary] refs assigned: ${refs.length}`);
  console.error(`[summary] adjacent pairs checked: ${adjacentPairs}`);
  console.error(`[summary] colliding pairs: ${collisions.length}`);
  console.error(`[summary] palette slots used: ${usedSlots} of ${targetColours} available`);
  console.error(`[summary] routes per index: ${JSON.stringify(usage)}`);
  console.error(`[done] ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
