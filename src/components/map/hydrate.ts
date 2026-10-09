import type { TransitLineProperties, TransitStopProperties } from '../../transit';

// MapLibre's queryRenderedFeatures can stringify nested object properties
// when returned from non-trivial sources. Defensively parse known nested
// fields so the popup never has to know which path they came from.
export function hydrateLineProps(raw: TransitLineProperties): TransitLineProperties {
  const cloned: TransitLineProperties = {
    ...raw,
    service:
      typeof raw.service === 'string' ? JSON.parse(raw.service as unknown as string) : raw.service,
    endpoints:
      typeof raw.endpoints === 'string'
        ? JSON.parse(raw.endpoints as unknown as string)
        : raw.endpoints,
    reservation_detail:
      typeof raw.reservation_detail === 'string'
        ? JSON.parse(raw.reservation_detail as unknown as string)
        : raw.reservation_detail,
    // A feature built before the three-state change carries no `reservation`.
    // Fall back to `unknown` rather than to a confident "no booking needed".
    reservation: raw.reservation ?? 'unknown',
    archived:
      typeof raw.archived === 'string'
        ? (raw.archived as unknown as string) === 'true'
        : Boolean(raw.archived),
    last_seen_day:
      typeof raw.last_seen_day === 'string'
        ? Number(raw.last_seen_day as unknown as string)
        : raw.last_seen_day,
    stops_count:
      typeof raw.stops_count === 'string'
        ? Number(raw.stops_count as unknown as string)
        : raw.stops_count,
  };
  return cloned;
}

export function hydrateStopProps(raw: TransitStopProperties): TransitStopProperties {
  return {
    ...raw,
    serving_lines:
      typeof raw.serving_lines === 'string'
        ? JSON.parse(raw.serving_lines as unknown as string)
        : raw.serving_lines,
    archived:
      typeof raw.archived === 'string'
        ? (raw.archived as unknown as string) === 'true'
        : Boolean(raw.archived),
  };
}
