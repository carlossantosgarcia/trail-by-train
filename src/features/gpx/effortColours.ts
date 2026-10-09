import type { MetricId } from './effort';

/**
 * Per-metric accent colour. Kept muted enough to coexist with the
 * panel's neutral palette — these tint the icon and the chip's
 * background only, not the numeric value itself.
 */
export const METRIC_COLOURS: Record<MetricId, string> = {
  naismith: '#2563eb', // blue-600 — classic walker, "time"
  tobler: '#0d9488', // teal-600 — gradient-aware, "terrain"
  minetti: '#d97706', // amber-600 — metabolic energy, "burn"
  effortKm: '#7c3aed', // violet-600 — flat-equivalent distance
};
