import type { TrackSummary, TrackBbox } from '../gpx/types';

/** One night between two days of a multi-day curated hike. */
export interface CuratedHikeSleep {
  /** [lon, lat] of the day-end point — where the sleep marker is drawn. */
  coord: [number, number];
  /**
   * Human-readable name of the sleeping spot (refuge, bivouac, gîte…).
   * Absent when the source does not name it.
   */
  name?: string;
}

/** Per-day breakdown for a curated hike. Length 1 for single-day hikes. */
export interface CuratedHikeDay {
  /** 1-based. */
  dayIndex: number;
  distanceKm: number;
  ascentM: number;
  descentM: number;
  pointCount: number;
  /**
   * End-of-day rest stop. Present for every day except the last
   * (`dayIndex < days.length`); always absent for the final day.
   */
  sleep?: CuratedHikeSleep;
}

/**
 * Who published the hike. `community` is a hike contributed by the person
 * who walked it, with its track under an open licence.
 */
export type CuratedSource = 'nature-sans-voiture' | 'les-others' | 'mollow' | 'community';

/** A track the hike's author has licensed for the app to show and share. */
export interface CuratedTrack {
  /** Static-asset path of the GPX, relative to BASE_URL. */
  gpx: string;
  /** SPDX-style licence id, e.g. "CC-BY-4.0". */
  license: string;
}

/** One hike entry in the manifest, mirroring the JSON shape exactly. */
export interface CuratedHike {
  /** Namespaced as `<source>/<slug>` to keep ids unique across sources. */
  id: string;
  /** Which editor curated this hike. */
  source: CuratedSource;
  title: string;
  /** The author's own page for the hike (blog post or tour). Absent for a community hike with nothing to link to. */
  sourceUrl?: string;
  /** ISO timestamp the editorial post was published. May be null when the source has no date. */
  publishedAt: string | null;
  /** The author's Komoot tour, when they published one. Linked, never copied. */
  komootUrl?: string;
  /** Present only when the author licensed the route; then it is drawn on the map. */
  track?: CuratedTrack;
  /** [lon, lat] where the hike starts — normally a station or bus stop. */
  start: [number, number];
  /** [lon, lat] where it ends; equal to `start` for a loop. */
  end: [number, number];
  /** Editor-tagged duration in days (1, 2, 3, …). */
  durationDays: number;
  /**
   * Hex line colour for this hike, assigned deterministically from
   * `id` at build time. Lets overlapping curated tracks read as
   * distinct lines (e.g. Petite vs Grande Traversée des Cerces).
   */
  colour: string;
  /**
   * Per-day breakdown — `days.length` may differ from `durationDays`;
   * the runtime trusts this array for everything per-day-related.
   */
  days: CuratedHikeDay[];
  /** Free-form per-source tags (e.g. Mollow accessibility hints). Reserved for future filtering — runtime ignores in v1. */
  tags: string[];
  bbox: TrackBbox;
  summary: TrackSummary;
}

export interface CuratedManifest {
  version: number;
  generatedAt: string;
  sources: CuratedSource[];
  hikes: CuratedHike[];
}

export const KNOWN_CURATED_SOURCES: readonly CuratedSource[] = [
  'nature-sans-voiture',
  'les-others',
  'mollow',
  'community',
] as const;

export const CURATED_SOURCE_LABELS: Record<CuratedSource, string> = {
  'nature-sans-voiture': 'NSV',
  'les-others': 'Les Others',
  mollow: 'Mollow',
  community: 'Communauté',
};
