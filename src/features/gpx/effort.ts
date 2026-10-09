// Pure, dependency-free effort / duration estimates for a GPX track.
// Same module is consumed by the browser sidebar and could be exercised
// from any offline tool (Node, benchmark).
//
// Four metrics are surfaced:
//
//   - Effort km        (FFRando-style flat-equivalent distance)
//   - Naismith time    (classic walker)
//   - Tobler time      (gradient-aware velocity model, off-trail)
//   - Minetti cost     (metabolic energy from gradient polynomial)
//
// Each metric also exports a `MetricDef` with the formula text,
// reference, and limitations — so the explainer popover renders the
// same source of truth as the math.

import type { TrackSummary } from './types';

export type MetricId = 'effortKm' | 'naismith' | 'tobler' | 'minetti';

/**
 * Body mass assumed by the Minetti walking-cost calculation. Set to a
 * mid-population default; doubles or halves linearly. Documented in
 * the popover so users can mentally re-scale.
 */
export const BODY_MASS_KG = 70;

/**
 * Clamp slope `i = dz/dx` into the range over which Minetti et al.
 * (2002) fitted their polynomial. Extrapolating the quintic outside
 * this range produces absurd numbers (cost rockets at >±60 % grade).
 */
export const MINETTI_GRADIENT_CLAMP = 0.5;

/**
 * Steps shorter than this are skipped in per-sample integrations
 * (Tobler / Minetti). Sub-GPS-noise stair-steps would otherwise turn
 * into divide-by-zero or nonsensically steep gradients.
 */
export const MIN_STEP_M = 1;

export interface EffortSample {
  /** Distance from the previous sample in the same segment, in metres. */
  distFromPrevM: number;
  /** Signed elevation change to the previous sample, in metres. May be 0. */
  deltaEleM: number;
}

export interface EffortInputs {
  distanceKm: number;
  ascentM: number;
  descentM: number;
  /** Per-sample list. When absent, only summary-based metrics are returned. */
  samples?: ReadonlyArray<EffortSample>;
}

export interface EffortMetrics {
  effortKm: number;
  naismithHours: number;
  toblerHours: number | null;
  minettiKJ: number | null;
  minettiKcal: number | null;
}

export interface MetricDef {
  id: MetricId;
  /** Long human-readable name. */
  label: string;
  /** Compact label suitable for the sidebar chip. */
  shortLabel: string;
  /** One-sentence plain-English definition. */
  definition: string;
  /** Formula in monospace-friendly text. */
  formulaText: string;
  /** External reference (Wikipedia or paper landing page). */
  referenceUrl: string;
  /** Short label for the reference link. */
  referenceLabel: string;
  /** At least one explicit caveat. */
  limitations: string[];
}

export const EFFORT_METRIC_DEFS: Record<MetricId, MetricDef> = {
  effortKm: {
    id: 'effortKm',
    label: 'Effort km',
    shortLabel: 'km-eff',
    definition: 'Flat-equivalent distance: how far this hike "feels" if it were on flat ground.',
    formulaText: 'effort_km = distance_km + ascent_m / 100',
    referenceUrl: 'https://www.ffrandonnee.fr/_137/calculer-une-randonnee.aspx',
    referenceLabel: 'FFRando — Calculer une randonnée',
    limitations: [
      '100 m of climb ≈ 1 km flat is a rule of thumb, not a physical law.',
      'Ignores descent entirely (a 1 000 m descent costs you very little here).',
      'No correction for trail surface, weather, altitude, or fatigue.',
    ],
  },
  naismith: {
    id: 'naismith',
    label: 'Naismith time',
    shortLabel: 'Naismith',
    definition:
      'Walking-time estimate by William Naismith (1892): 5 km/h on the flat, +1 hour per 600 m of ascent.',
    formulaText: 't_hours = distance_km / 5 + ascent_m / 600',
    referenceUrl: 'https://en.wikipedia.org/wiki/Naismith%27s_rule',
    referenceLabel: "Wikipedia — Naismith's rule",
    limitations: [
      'Assumes a steady fit walker; many walkers are slower in practice.',
      'No descent term (Aitken/Langmuir refinements add one, not used here).',
      'No correction for trail surface, weather, altitude, fatigue, or rest stops.',
    ],
  },
  tobler: {
    id: 'tobler',
    label: 'Tobler time',
    shortLabel: 'Tobler',
    definition:
      'Walking-time estimate by Waldo Tobler (1993): velocity is a function of local slope, fastest at a ~5 % downhill grade.',
    formulaText: 'v_kmh = 6 · exp(-3.5 · |slope + 0.05|);  t_total = Σ step_km / v_kmh',
    referenceUrl: 'https://en.wikipedia.org/wiki/Tobler%27s_hiking_function',
    referenceLabel: "Wikipedia — Tobler's hiking function",
    limitations: [
      'Originally fitted to off-trail walking; trails may be faster.',
      'No fatigue, rest, altitude, surface, or weather model.',
      'Per-step gradients can be noisy; we still feed raw step deltas.',
    ],
  },
  minetti: {
    id: 'minetti',
    label: 'Minetti cost',
    shortLabel: 'Minetti',
    definition:
      'Estimated metabolic energy of walking the route, by integrating Minetti et al. (2002) per-metre cost-of-walking as a function of gradient.',
    formulaText:
      'e_J_per_kg = 155.4·i^5 - 30.4·i^4 - 43.3·i^3 + 46.3·i^2 + 19.5·i + 3.6\n' +
      'E_kJ = (Σ step_m · e_J_per_kg) · body_mass_kg / 1000',
    referenceUrl: 'https://doi.org/10.1152/japplphysiol.01177.2001',
    referenceLabel: 'Minetti et al. 2002 — J Appl Physiol',
    limitations: [
      `Gradient is clamped to ±${(MINETTI_GRADIENT_CLAMP * 100).toFixed(0)} %; ` +
        'the quintic explodes beyond that range.',
      `Body mass is assumed ${BODY_MASS_KG} kg — energy scales linearly, so multiply if yours differs.`,
      'Walking only; the cost of jogging or carrying a heavy pack is different.',
      'No fatigue, altitude, surface, or weather model.',
    ],
  },
};

/**
 * Tobler velocity in km/h at a given (signed) slope, expressed as a
 * tangent (dz/dx). Fastest at slope = -0.05 (5 % downhill).
 */
function toblerVelocityKmh(slope: number): number {
  return 6 * Math.exp(-3.5 * Math.abs(slope + 0.05));
}

/**
 * Minetti walking energy cost in J/kg per metre travelled along the
 * track, as a function of (signed) slope `i`. Clamps `i` to
 * ±MINETTI_GRADIENT_CLAMP before evaluating the polynomial — see
 * design.md (D4) and the popover's Limitations.
 */
function minettiJoulesPerKgPerMetre(slope: number): number {
  const i = Math.max(-MINETTI_GRADIENT_CLAMP, Math.min(MINETTI_GRADIENT_CLAMP, slope));
  const i2 = i * i;
  const i3 = i2 * i;
  const i4 = i3 * i;
  const i5 = i4 * i;
  return 155.4 * i5 - 30.4 * i4 - 43.3 * i3 + 46.3 * i2 + 19.5 * i + 3.6;
}

export function computeEffort(inputs: EffortInputs): EffortMetrics {
  const effortKm = inputs.distanceKm + inputs.ascentM / 100;
  const naismithHours = inputs.distanceKm / 5 + inputs.ascentM / 600;

  let toblerHours: number | null = null;
  let minettiKJ: number | null = null;

  if (inputs.samples && inputs.samples.length > 0) {
    let tHours = 0;
    let eJoulesPerKg = 0;
    let countedAny = false;

    for (const s of inputs.samples) {
      if (!Number.isFinite(s.distFromPrevM) || s.distFromPrevM < MIN_STEP_M) continue;
      const slope = Number.isFinite(s.deltaEleM) ? s.deltaEleM / s.distFromPrevM : 0;
      const v = toblerVelocityKmh(slope);
      if (v > 0) {
        tHours += s.distFromPrevM / 1000 / v;
      }
      eJoulesPerKg += s.distFromPrevM * minettiJoulesPerKgPerMetre(slope);
      countedAny = true;
    }

    if (countedAny) {
      toblerHours = tHours;
      minettiKJ = (eJoulesPerKg * BODY_MASS_KG) / 1000;
    }
  }

  return {
    effortKm,
    naismithHours,
    toblerHours,
    minettiKJ,
    minettiKcal: minettiKJ == null ? null : minettiKJ / 4.184,
  };
}

/**
 * Convenience: build inputs from an existing `TrackSummary` (which
 * already carries `distanceKm`, `ascentM`, `descentM`) plus an
 * optional per-sample list.
 */
export function computeEffortFromSummary(
  summary: TrackSummary,
  samples?: ReadonlyArray<EffortSample>,
): EffortMetrics {
  return computeEffort({
    distanceKm: summary.distanceKm,
    ascentM: summary.ascentM,
    descentM: summary.descentM,
    samples,
  });
}
