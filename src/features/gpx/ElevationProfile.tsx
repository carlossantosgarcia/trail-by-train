import { useEffect, useRef, useState } from 'react';
import { readToken, useResolvedTheme } from '../../lib/useTheme';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Position } from 'geojson';
import { onGeometryChanged, setHoveredSample, useGpxStore, type HoveredSample } from './store';
import { loadGeometry } from './storage';
import {
  BODY_MASS_KG,
  EFFORT_METRIC_DEFS,
  computeEffortFromSummary,
  type EffortMetrics,
  type EffortSample,
  type MetricId,
} from './effort';
import MetricPopover, { type InputRow } from './MetricPopover';
import MetricIcon from './effortIcons';
import { METRIC_COLOURS } from './effortColours';
import type { Track } from './types';
import styles from './ElevationProfile.module.css';

interface MetricDisplay {
  /** Numeric part — e.g. "17h 20m", "91", "—". */
  value: string;
  /** Trailing unit / qualifier — e.g. "Naismith", "km-eff", or "" if none. */
  unit: string;
}

/**
 * Along-track window over which the hover readout's slope (and pace,
 * when timestamps exist) is computed. 30 m matches the scale used by
 * the elevation-gain smoothing — see
 * src/features/gpx/elevationAlgorithm.mjs DEFAULT_WINDOW_M.
 */
export const HOVER_SLOPE_WINDOW_M = 30;

interface ChartData {
  distances: number[]; // km, ascending
  elevations: number[]; // metres
  /** Local slope (%) at each sample, computed over HOVER_SLOPE_WINDOW_M. */
  slopePct: number[];
  coords: [number, number][]; // [lon, lat] per sample
  /** Per-sample epoch ms when every point had a timestamp, else null. */
  times: number[] | null;
  hasElevation: boolean;
  /** Per-step samples for Tobler/Minetti integration. */
  samples: EffortSample[];
}

function haversineMetres(a: Position, b: Position): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const c = s1 * s1 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(c));
}

function buildSlopeSeries(distancesKm: number[], elevations: number[]): number[] {
  const n = distancesKm.length;
  const out = new Array<number>(n).fill(0);
  if (n < 2) return out;
  const halfKm = HOVER_SLOPE_WINDOW_M / 2 / 1000;

  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    while (lo + 1 < i && distancesKm[i] - distancesKm[lo + 1] >= halfKm) lo++;
    while (hi < n - 1 && distancesKm[hi + 1] - distancesKm[i] <= halfKm) hi++;
    if (hi <= lo) continue;
    const dKm = distancesKm[hi] - distancesKm[lo];
    if (dKm <= 0) continue;
    out[i] = ((elevations[hi] - elevations[lo]) / (dKm * 1000)) * 100;
  }
  return out;
}

async function loadChartData(trackId: string): Promise<ChartData | null> {
  const geojson = await loadGeometry(trackId);
  if (!geojson) return null;
  const distances: number[] = [];
  const elevations: number[] = [];
  const coords: [number, number][] = [];
  const samples: EffortSample[] = [];
  const collectedTimes: number[] = [];
  let allHaveTimes = true;
  let cumM = 0;
  let prev: Position | null = null;
  let sawElevation = false;

  for (const feature of geojson.features) {
    const featTimes = (feature.properties?.coordinateProperties as { times?: string[] } | undefined)
      ?.times;
    const featAllHaveTimes =
      Array.isArray(featTimes) && featTimes.length === feature.geometry.coordinates.length;
    if (!featAllHaveTimes) allHaveTimes = false;

    let prevInSeg: Position | null = null;
    for (let i = 0; i < feature.geometry.coordinates.length; i++) {
      const pt = feature.geometry.coordinates[i];
      let stepM = 0;
      if (prev) stepM = haversineMetres(prev, pt);
      cumM += stepM;
      if (prevInSeg && typeof prev?.[2] === 'number' && typeof pt[2] === 'number') {
        samples.push({ distFromPrevM: stepM, deltaEleM: pt[2] - (prev[2] as number) });
      } else if (prevInSeg) {
        samples.push({ distFromPrevM: stepM, deltaEleM: 0 });
      }
      prev = pt;
      prevInSeg = pt;
      const ele = typeof pt[2] === 'number' ? pt[2] : NaN;
      if (!Number.isNaN(ele) && ele !== 0) sawElevation = true;
      distances.push(cumM / 1000);
      elevations.push(Number.isFinite(ele) ? ele : 0);
      coords.push([pt[0], pt[1]]);
      if (featAllHaveTimes && featTimes) {
        const t = Date.parse(featTimes[i]);
        if (!Number.isNaN(t)) collectedTimes.push(t);
        else allHaveTimes = false;
      }
    }
  }

  const times = allHaveTimes && collectedTimes.length === distances.length ? collectedTimes : null;
  const slopePct = buildSlopeSeries(distances, elevations);
  return {
    distances,
    elevations,
    slopePct,
    coords,
    times,
    samples,
    hasElevation: sawElevation,
  };
}

function pacePerKmAt(i: number, distancesKm: number[], times: number[]): number | undefined {
  const halfKm = HOVER_SLOPE_WINDOW_M / 2 / 1000;
  let lo = i;
  let hi = i;
  while (lo > 0 && distancesKm[i] - distancesKm[lo - 1] <= halfKm) lo--;
  while (hi < distancesKm.length - 1 && distancesKm[hi + 1] - distancesKm[i] <= halfKm) hi++;
  if (hi === lo) return undefined;
  const dKm = distancesKm[hi] - distancesKm[lo];
  const dtSec = (times[hi] - times[lo]) / 1000;
  if (dKm <= 0 || dtSec <= 0) return undefined;
  return dtSec / 60 / dKm;
}

interface ReadoutState {
  sample: HoveredSample;
  leftPx: number;
  chartWidth: number;
}

interface PopoverState {
  metricId: MetricId;
  anchorRect: DOMRect;
}

const METRICS_ORDER: MetricId[] = ['naismith', 'tobler', 'minetti', 'effortKm'];

function formatHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km)) return '—';
  return `${Math.round(km)} km-eff`;
}

function formatKJ(kJ: number | null | undefined): string {
  if (kJ == null || !Number.isFinite(kJ)) return '—';
  return `${Math.round(kJ)} kJ`;
}

function metricDisplay(id: MetricId, metrics: EffortMetrics): MetricDisplay {
  switch (id) {
    case 'effortKm':
      return { value: formatKm(metrics.effortKm), unit: 'km-eff' };
    case 'naismith':
      return { value: formatHours(metrics.naismithHours), unit: 'Naismith' };
    case 'tobler':
      return { value: formatHours(metrics.toblerHours), unit: 'Tobler' };
    case 'minetti':
      return { value: formatKJ(metrics.minettiKJ), unit: 'Minetti' };
  }
}

function metricDisplayFlat(id: MetricId, metrics: EffortMetrics): string {
  const { value, unit } = metricDisplay(id, metrics);
  return unit ? `${value} ${unit}` : value;
}

function chipStyleFor(id: MetricId): React.CSSProperties {
  const accent = METRIC_COLOURS[id];
  return {
    // Tints are derived from the accent via rgb-with-alpha so each chip
    // gets a subtle, on-brand background without us hand-mixing colours.
    '--chip-accent': accent,
    '--chip-bg': hexWithAlpha(accent, 0.1),
    '--chip-bg-hover': hexWithAlpha(accent, 0.18),
  } as React.CSSProperties;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function buildInputRows(metricId: MetricId, track: Track, metrics: EffortMetrics): InputRow[] {
  const dist = `${track.summary.distanceKm.toFixed(2)} km`;
  const ascent = `${track.summary.ascentM} m`;
  const descent = `${track.summary.descentM} m`;
  switch (metricId) {
    case 'effortKm':
      return [
        { label: 'Distance', value: dist },
        { label: 'Ascent (D+)', value: ascent },
        { label: 'Result', value: `${metrics.effortKm.toFixed(1)} km` },
      ];
    case 'naismith':
      return [
        { label: 'Distance', value: dist },
        { label: 'Ascent (D+)', value: ascent },
        { label: 'Result', value: `${metrics.naismithHours.toFixed(2)} h` },
      ];
    case 'tobler':
      return [
        { label: 'Distance', value: dist },
        { label: 'Ascent (D+)', value: ascent },
        { label: 'Descent (D−)', value: descent },
        {
          label: 'Result',
          value: metrics.toblerHours !== null ? `${metrics.toblerHours.toFixed(2)} h` : '—',
        },
      ];
    case 'minetti':
      return [
        { label: 'Distance', value: dist },
        { label: 'Ascent (D+)', value: ascent },
        { label: 'Descent (D−)', value: descent },
        { label: 'Body mass assumed', value: `${BODY_MASS_KG} kg` },
        {
          label: 'Result',
          value:
            metrics.minettiKJ !== null
              ? `${metrics.minettiKJ.toFixed(0)} kJ  (${(metrics.minettiKcal as number).toFixed(0)} kcal)`
              : '—',
        },
      ];
  }
}

interface ElevationProfileProps {
  /**
   * Rendered inside the mobile sheet's profile segment rather than as its own
   * bottom panel: no positioning, no handle, always expanded — the sheet
   * already supplies all three.
   */
  embedded?: boolean;
}

export default function ElevationProfile({ embedded = false }: ElevationProfileProps = {}) {
  const selectedId = useGpxStore((s) => s.selectedId);
  const selectedTrack = useGpxStore((s) => s.tracks.find((t) => t.id === s.selectedId) ?? null);
  // The chart is canvas-drawn, so it can't inherit CSS tokens — it reads
  // them and rebuilds when the theme flips (see the effect deps below).
  const theme = useResolvedTheme();
  const trackColour = selectedTrack?.colour ?? readToken('--ink', '#111827');
  const tracksCount = useGpxStore((s) => s.tracks.length);
  // Default: collapsed on an empty page (zero tracks), expanded for a
  // returning visitor whose tracks are hydrated from IndexedDB.
  const [expandedState, setExpanded] = useState(tracksCount > 0);
  // Embedded in the sheet there is nothing to collapse into.
  const expanded = embedded || expandedState;
  // Auto-expand only on the 0 → ≥1 transition — never on n → n+1
  // (would override a manual collapse) and never on n → 0 (would slam
  // the panel shut while the user is cleaning up).
  const prevCountRef = useRef(tracksCount);
  useEffect(() => {
    if (prevCountRef.current === 0 && tracksCount > 0) {
      setExpanded(true);
    }
    prevCountRef.current = tracksCount;
  }, [tracksCount]);
  const [data, setData] = useState<ChartData | null>(null);
  const [readout, setReadout] = useState<ReadoutState | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const dataRef = useRef<ChartData | null>(null);
  const trackColourRef = useRef<string>(trackColour);
  trackColourRef.current = trackColour;

  // Bumped when a track's stored geometry is replaced under us — terrain
  // enrichment rewrites it after the track is already on screen, and the
  // chart would otherwise keep showing the elevation-less version.
  const [geometryRevision, setGeometryRevision] = useState(0);
  useEffect(
    () =>
      onGeometryChanged((trackId) => {
        if (trackId === selectedId) setGeometryRevision((n) => n + 1);
      }),
    [selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setData(null);
      setPopover(null);
      return;
    }
    setPopover(null);
    void (async () => {
      const d = await loadChartData(selectedId);
      if (!cancelled) setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, geometryRevision]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!containerRef.current) return;
    plotRef.current?.destroy();
    plotRef.current = null;
    setReadout(null);

    if (!data || !data.hasElevation) {
      return;
    }

    const axisInk = readToken('--slate', '#6b7280');
    const gridRule = readToken('--rule', '#e5e7eb');
    const profileInk = readToken('--profile', '#0f766e');
    const profileFill = `color-mix(in srgb, ${profileInk} 18%, transparent)`;

    const rect = containerRef.current.getBoundingClientRect();
    const plot = new uPlot(
      {
        width: rect.width || 800,
        height: rect.height || 160,
        scales: { x: { time: false } },
        legend: { show: false },
        axes: [
          { label: 'Distance (km)', stroke: axisInk, grid: { stroke: gridRule } },
          { label: 'Elevation (m)', stroke: axisInk, grid: { stroke: gridRule } },
        ],
        cursor: {
          drag: { x: false, y: false },
          points: { size: 7 },
        },
        hooks: {
          setCursor: [
            (u) => {
              const idx = u.cursor.idx;
              const d = dataRef.current;
              if (idx == null || !d || idx < 0 || idx >= d.coords.length) {
                setHoveredSample(null);
                setReadout(null);
                return;
              }
              const sample: HoveredSample = {
                idx,
                coord: d.coords[idx],
                distanceKm: d.distances[idx],
                altitudeM: d.elevations[idx],
                slopePct: d.slopePct[idx],
                trackColour: trackColourRef.current,
              };
              if (d.times) {
                const start = d.times[0];
                sample.elapsedSeconds = Math.max(0, (d.times[idx] - start) / 1000);
                const pace = pacePerKmAt(idx, d.distances, d.times);
                if (pace !== undefined) sample.paceMinPerKm = pace;
              }
              setHoveredSample(sample);
              const cw = u.bbox?.width ?? rect.width;
              setReadout({ sample, leftPx: u.cursor.left ?? 0, chartWidth: cw });
            },
          ],
        },
        series: [
          { label: 'Distance' },
          {
            label: 'Elevation',
            stroke: profileInk,
            fill: profileFill,
            width: 2,
            points: { show: false },
          },
        ],
      },
      [data.distances, data.elevations],
      containerRef.current,
    );
    plotRef.current = plot;

    const onResize = () => {
      if (!containerRef.current || !plotRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      plotRef.current.setSize({ width: r.width, height: r.height });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [data, expanded, theme]);

  useEffect(() => {
    if (!expanded) {
      setHoveredSample(null);
      setReadout(null);
      setPopover(null);
    }
    return () => {
      setHoveredSample(null);
    };
  }, [expanded]);

  // Effort metrics: summary-only first (Naismith/Effort km), upgraded
  // with sample-based Tobler/Minetti once chart data has loaded.
  const metrics: EffortMetrics | null = selectedTrack
    ? computeEffortFromSummary(selectedTrack.summary, data?.samples)
    : null;

  const onMetricClick = (e: React.MouseEvent<HTMLButtonElement>, id: MetricId) => {
    e.stopPropagation();
    setPopover({ metricId: id, anchorRect: e.currentTarget.getBoundingClientRect() });
  };

  // Hide the entire Details panel when there are no tracks loaded so the
  // bottom of the map is clean by default; it reappears as soon as the
  // first GPX is added (and the existing 0 → ≥1 effect auto-expands it).
  if (tracksCount === 0) return null;

  return (
    <div
      className={embedded ? styles.embedded : `${styles.panel} ${expanded ? styles.expanded : ''}`}
    >
      {!embedded && (
        <div
          className={styles.handle}
          onClick={() => setExpanded((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpanded((v) => !v);
            }
          }}
          aria-expanded={expanded}
        >
          <span className={styles.handleLabel}>Details</span>
          <span className={styles.chevron} aria-hidden>
            {expanded ? '▾' : '▴'}
          </span>
        </div>
      )}
      <div className={styles.body}>
        {expanded && (
          <>
            {selectedTrack && metrics && (
              <div className={styles.effortLine}>
                <span className={styles.effortLabel}>Effort</span>
                {METRICS_ORDER.map((id) => {
                  const { value, unit } = metricDisplay(id, metrics);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={styles.effortChip}
                      style={chipStyleFor(id)}
                      aria-haspopup="dialog"
                      title={`${EFFORT_METRIC_DEFS[id].label} — click for formula and limitations`}
                      onClick={(e) => onMetricClick(e, id)}
                    >
                      <span className={styles.effortIcon}>
                        <MetricIcon id={id} />
                      </span>
                      <span className={styles.effortValue}>{value}</span>
                      {unit && <span className={styles.effortUnit}>{unit}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className={styles.bodyMain}>
              {data && data.hasElevation ? (
                <div className={styles.chartWrap}>
                  <div ref={containerRef} className={styles.chart} />
                  {readout && (
                    <HoverReadout
                      sample={readout.sample}
                      leftPx={readout.leftPx}
                      chartWidth={readout.chartWidth}
                    />
                  )}
                </div>
              ) : selectedId && data && !data.hasElevation ? (
                <div className={styles.placeholder}>No elevation data</div>
              ) : !selectedId ? (
                <div className={styles.placeholder}>Select a track to see its details</div>
              ) : (
                <div className={styles.placeholder}>Loading…</div>
              )}
            </div>
          </>
        )}
      </div>
      {popover && selectedTrack && metrics && (
        <MetricPopover
          metricId={popover.metricId}
          anchorRect={popover.anchorRect}
          inputs={buildInputRows(popover.metricId, selectedTrack, metrics)}
          value={metricDisplayFlat(popover.metricId, metrics)}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

const READOUT_WIDTH_PX = 200;

function HoverReadout(props: { sample: HoveredSample; leftPx: number; chartWidth: number }) {
  const { sample, leftPx, chartWidth } = props;
  const left = Math.max(0, Math.min(chartWidth - READOUT_WIDTH_PX, leftPx - READOUT_WIDTH_PX / 2));
  const slopeStr = `${sample.slopePct >= 0 ? '+' : ''}${sample.slopePct.toFixed(1)} %`;
  const timeStr = sample.elapsedSeconds !== undefined ? formatElapsed(sample.elapsedSeconds) : null;
  const paceStr = sample.paceMinPerKm !== undefined ? formatPace(sample.paceMinPerKm) : null;
  return (
    <div className={styles.readout} style={{ left, width: READOUT_WIDTH_PX }} aria-live="polite">
      <div className={styles.readoutMain}>
        <span>{sample.distanceKm.toFixed(2)} km</span>
        <span className={styles.readoutDot}>·</span>
        <span>{Math.round(sample.altitudeM)} m</span>
        <span className={styles.readoutDot}>·</span>
        <span>{slopeStr}</span>
      </div>
      {(timeStr || paceStr) && (
        <div className={styles.readoutSub}>
          {timeStr && <span>{timeStr}</span>}
          {timeStr && paceStr && <span className={styles.readoutDot}>·</span>}
          {paceStr && <span>{paceStr}</span>}
        </div>
      )}
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatPace(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '—';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}
