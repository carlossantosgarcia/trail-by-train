// The "Inputs we used" rows of a metric's explanation (MetricPopover), from
// the summary it was computed from. Shared by the GPX profile's chips and the
// curated-hike card.
import { BODY_MASS_KG, type EffortMetrics, type MetricId } from './effort';
import type { TrackSummary } from './types';
import { t } from '../../i18n';

export interface InputRow {
  label: string;
  value: string;
}

export function metricInputRows(
  metricId: MetricId,
  summary: TrackSummary,
  metrics: EffortMetrics,
): InputRow[] {
  const dist = `${summary.distanceKm.toFixed(2)} km`;
  const ascent = `${summary.ascentM} m`;
  const descent = `${summary.descentM} m`;
  switch (metricId) {
    case 'effortKm':
      return [
        { label: t('gpx.distance'), value: dist },
        { label: t('gpx.ascent'), value: ascent },
        { label: t('gpx.result'), value: `${metrics.effortKm.toFixed(1)} km` },
      ];
    case 'naismith':
      return [
        { label: t('gpx.distance'), value: dist },
        { label: t('gpx.ascent'), value: ascent },
        { label: t('gpx.result'), value: `${metrics.naismithHours.toFixed(2)} h` },
      ];
    case 'tobler':
      return [
        { label: t('gpx.distance'), value: dist },
        { label: t('gpx.ascent'), value: ascent },
        { label: t('gpx.descent'), value: descent },
        {
          label: t('gpx.result'),
          value: metrics.toblerHours !== null ? `${metrics.toblerHours.toFixed(2)} h` : '—',
        },
      ];
    case 'minetti':
      return [
        { label: t('gpx.distance'), value: dist },
        { label: t('gpx.ascent'), value: ascent },
        { label: t('gpx.descent'), value: descent },
        { label: t('gpx.bodyMass'), value: `${BODY_MASS_KG} kg` },
        {
          label: t('gpx.result'),
          value:
            metrics.minettiKJ !== null
              ? `${metrics.minettiKJ.toFixed(0)} kJ  (${(metrics.minettiKcal as number).toFixed(0)} kcal)`
              : '—',
        },
      ];
  }
}
