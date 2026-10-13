// Cluster co-located same-name stops into one merged stop. GTFS feeds
// typically emit one stop per pole (each direction of travel), so two
// stops named "X" sitting 10–40m apart usually represent the same place.
// Merging them shrinks the rendered point cloud and removes the visual
// overdraw at high zoom. The helper is provider-agnostic — it operates
// on the output-record shape produced by per-provider build scripts.

import { stopServiceDays } from './service-days.mjs';

const EARTH_RADIUS_M = 6_371_008.8;

function normaliseName(name) {
  return String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function haversineMetres(a, b) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(sa));
}

/**
 * @param {Array<object>} stops  Per-stop output records (post per-stop boolean computation).
 *   Each must have: stop_id, stop_name, lng, lat, serving_lines (each with its
 *   service_days), service_days.
 * @param {{ thresholdMetres?: number }} [opts]
 * @returns {Array<object>}  Merged stops, same shape, with display_color recomputed.
 */
export function clusterStops(stops, { thresholdMetres = 75 } = {}) {
  // Bucket by normalised name.
  const byName = new Map();
  for (const s of stops) {
    const k = normaliseName(s.stop_name);
    let arr = byName.get(k);
    if (!arr) {
      arr = [];
      byName.set(k, arr);
    }
    arr.push(s);
  }

  const merged = [];
  for (const group of byName.values()) {
    // Deterministic order: sort by stop_id ascending so the canonical id
    // is stable across rebuilds.
    group.sort((a, b) => (a.stop_id < b.stop_id ? -1 : a.stop_id > b.stop_id ? 1 : 0));

    /** @type {Array<{ members: Array<object>, centroid: [number, number] }>} */
    const clusters = [];
    for (const s of group) {
      const pt = [s.lng, s.lat];
      let placed = false;
      for (const c of clusters) {
        if (haversineMetres(pt, c.centroid) <= thresholdMetres) {
          c.members.push(s);
          // Update running centroid as the mean of all members.
          const n = c.members.length;
          c.centroid = [
            c.centroid[0] + (pt[0] - c.centroid[0]) / n,
            c.centroid[1] + (pt[1] - c.centroid[1]) / n,
          ];
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push({ members: [s], centroid: pt });
    }

    for (const c of clusters) {
      merged.push(mergeMembers(c.members));
    }
  }

  return merged;
}

function mergeMembers(members) {
  // Already sorted by stop_id; first member is canonical.
  const first = members[0];
  if (members.length === 1) return first;

  // Mean coordinates, computed fresh from members (the running centroid
  // in clusterStops is good enough but we recompute for cleanliness).
  let sumLng = 0;
  let sumLat = 0;
  for (const m of members) {
    sumLng += m.lng;
    sumLat += m.lat;
  }
  const lng = +(sumLng / members.length).toFixed(5);
  const lat = +(sumLat / members.length).toFixed(5);

  // Dedup serving_lines by route_id, preserving first-seen order.
  const seen = new Set();
  const servingLines = [];
  for (const m of members) {
    for (const l of m.serving_lines ?? []) {
      if (seen.has(l.route_id)) continue;
      seen.add(l.route_id);
      servingLines.push(l);
    }
  }

  const display_color =
    servingLines.length === 1 ? servingLines[0].color : '#FFFFFF';


  return {
    ...first,
    lng,
    lat,
    serving_lines: servingLines,
    display_color,
    service_days: stopServiceDays(servingLines.map((l) => l.service_days)),
  };
}
