// Shared, cached access to each provider's `line-stops.json`: every line's
// stops in calling order, and the line's full extent. The line card lists the
// stops from it, and framing a line reads its extent here, because the tiles
// only ever hold the part of the line already loaded.
//
// Data built before the file existed has none: callers then fall back to what
// the tiles hold, and the card shows only the two ends.

import { useEffect, useState } from 'react';
import { getProvider } from './index';

interface LineStopsFile {
  /** [stop_id, name, lon, lat], coordinates as integers of 1e-5°. */
  stops: [string, string, number, number][];
  lines: Record<
    string,
    {
      bbox: [number, number, number, number] | null;
      variants?: { dir: 0 | 1; trips: number; stops: number[] }[];
    }
  >;
}

export interface LineStop {
  id: string;
  name: string;
  lngLat: [number, number];
}

/** One way the line runs: its stops in order. */
export interface LineVariant {
  /** 0 reads from the card's first terminus to its second, 1 back. */
  dir: 0 | 1;
  /** How many trips in the feed run it (or a shorter run inside it). */
  trips: number;
  stops: LineStop[];
}

export interface LineStops {
  /** [west, south, east, north] in degrees, or null when unknown. */
  bbox: [number, number, number, number] | null;
  /** Each direction's variants, busiest first. */
  variants: LineVariant[];
  /** Distinct stops over every variant. */
  stopCount: number;
}

const cache = new Map<string, Promise<LineStopsFile | null>>();

function loadFile(providerId: string): Promise<LineStopsFile | null> {
  const cached = cache.get(providerId);
  if (cached) return cached;
  const provider = getProvider(providerId);
  if (!provider) return Promise.resolve(null);
  const pending = fetch(provider.lineStopsUrl)
    .then((res) => (res.ok ? (res.json() as Promise<LineStopsFile>) : null))
    .catch(() => null);
  cache.set(providerId, pending);
  return pending;
}

export async function loadLineStops(
  providerId: string,
  routeId: string,
): Promise<LineStops | null> {
  const file = await loadFile(providerId);
  const line = file?.lines[routeId];
  if (!file || !line) return null;
  const variants = (line.variants ?? []).map((v) => ({
    dir: v.dir,
    trips: v.trips,
    stops: v.stops.flatMap((i) => {
      const st = file.stops[i];
      return st
        ? [{ id: st[0], name: st[1], lngLat: [st[2] / 1e5, st[3] / 1e5] as [number, number] }]
        : [];
    }),
  }));
  return {
    bbox: line.bbox ? (line.bbox.map((v) => v / 1e5) as LineStops['bbox']) : null,
    variants,
    stopCount: new Set(variants.flatMap((v) => v.stops.map((st) => st.id))).size,
  };
}

/** The line's stops, or null while loading or when the data has none. */
export function useLineStops(providerId: string, routeId: string): LineStops | null {
  const [value, setValue] = useState<{ key: string; stops: LineStops | null } | null>(null);
  const key = `${providerId}\u0000${routeId}`;
  useEffect(() => {
    let cancelled = false;
    loadLineStops(providerId, routeId).then((stops) => {
      if (!cancelled) setValue({ key, stops });
    });
    return () => {
      cancelled = true;
    };
  }, [providerId, routeId, key]);
  return value?.key === key ? value.stops : null;
}
