// Click popup for transit lines and stops. Renders inside a MapLibre
// `Popup`, gated by a tiny module-level store the click handlers write to.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import { getProvider } from './index';
import {
  getTransitPopupTarget,
  setTransitPopupTarget,
  subscribeTransitPopup,
  type TransitPopupTarget,
} from './popupStore';
import { freshnessOf, lastUpdateOf, type UpdateTier } from './freshness';
import { useProviderMeta } from './metaStore';
import { setTransitHighlight, useTransitHighlight } from './highlightStore';
import type {
  ReservationStatus,
  ServiceWindow,
  TransitLineProperties,
  TransitStopProperties,
} from './types';
import { transitLayerIds } from './transitOverlay';
import type { DayFilter } from './transitOverlay';
import styles from './TransitPopup.module.css';
import { CloseIcon, PhoneIcon, WarningIcon } from '../components/icons/lucide';
import BottomSheet, { type Snap } from '../components/BottomSheet';
import { useIsMobile } from '../lib/useIsMobile';
import { useMapGesture } from '../lib/mapGestures';

interface Props {
  map: maplibregl.Map | null;
  dayFilter: DayFilter;
  hideLowFreq: boolean;
}

interface LineIndexEntry {
  runs_weekday: boolean;
  runs_saturday: boolean;
  runs_sunday: boolean;
  is_low_freq: boolean;
}

// Lazy per-provider index of route_id → filter-relevant booleans. Built
// on first popup open by walking the source's loaded features.
const lineIndexByProvider = new Map<string, Map<string, LineIndexEntry>>();

function getOrBuildLineIndex(
  map: maplibregl.Map,
  providerId: string,
): Map<string, LineIndexEntry> | null {
  const cached = lineIndexByProvider.get(providerId);
  if (cached && cached.size > 0) return cached;
  const sourceId = transitLayerIds(providerId).lineSource;
  if (!map.getSource(sourceId)) return null;
  const features = map.querySourceFeatures(sourceId, { sourceLayer: 'transit' });
  if (features.length === 0) return null;
  const index = new Map<string, LineIndexEntry>();
  // Multiple features per route_id (one per shape variant) overwrite the
  // same entry with identical per-route booleans, which is fine.
  for (const f of features) {
    const p = f.properties as unknown as TransitLineProperties | null;
    if (!p?.route_id) continue;
    index.set(p.route_id, {
      runs_weekday: !!p.runs_weekday,
      runs_saturday: !!p.runs_saturday,
      runs_sunday: !!p.runs_sunday,
      is_low_freq: !!p.is_low_freq,
    });
  }
  lineIndexByProvider.set(providerId, index);
  return index;
}

function passesFilter(
  entry: LineIndexEntry | undefined,
  dayFilter: DayFilter,
  hideLowFreq: boolean,
): boolean {
  if (!entry) return true; // unknown → assume visible (fallback before index ready)
  if (hideLowFreq && entry.is_low_freq) return false;
  if (dayFilter === 'weekday') return entry.runs_weekday;
  if (dayFilter === 'saturday') return entry.runs_saturday;
  if (dayFilter === 'sunday') return entry.runs_sunday;
  return true;
}

function useTransitPopupTarget(): TransitPopupTarget {
  const [target, setTarget] = useState<TransitPopupTarget>(getTransitPopupTarget());
  useEffect(() => subscribeTransitPopup(setTarget), []);
  return target;
}

function isoToFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Pick black or white text based on the chip background's perceived
// luminance. Handles white-ish GTFS colors that would otherwise vanish.
function readableTextOn(bg: string): string {
  const hex = bg.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#111827';
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  // Relative luminance per WCAG.
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? '#111827' : '#ffffff';
}

// No average gap here, although the data carries one: it is taken over both
// directions merged, so it is not how often a bus passes in either, and with
// one or two trips it read as nonsense ("~0 min", "~610 min") that looked
// like a ride time.
function summariseService(sw: ServiceWindow | null): string {
  if (!sw) return 'Pas de service';
  if (sw.trips === 1) return `${sw.firstDep} · 1 trajet`;
  return `${sw.firstDep}–${sw.lastDep} · ${sw.trips} trajets`;
}

// "Sans réservation" is deliberately quiet and "inconnue" deliberately not:
// the reader needs to notice when we cannot answer, and needs no encouragement
// to notice when there is nothing to do.
const RESERVATION_BADGE_CLASS: Record<ReservationStatus, string> = {
  required: styles.tad,
  not_required: styles.noReservation,
  unknown: styles.unknownBadge,
};

// Colour is the age signal, so the pill text can stay a bare date.
const UPDATE_BADGE_CLASS: Record<UpdateTier, string> = {
  fresh: styles.updateFresh,
  recent: styles.updateFresh,
  ageing: styles.updateAgeing,
  stale: styles.updateStale,
};

// Said first, because it changes how to read everything else: a train has no
// bus stop, and a replacement coach runs instead of a train.
const SERVICE_KIND_LABEL = {
  train: 'Train',
  rail_replacement: 'Car de remplacement TER',
} as const;

const RESERVATION_LABEL: Record<ReservationStatus, string> = {
  required: 'Réservation obligatoire',
  not_required: 'Sans réservation',
  unknown: 'Réservation : inconnue',
};

export default function TransitPopup({ map, dayFilter, hideLowFreq }: Props) {
  const target = useTransitPopupTarget();
  const isMobile = useIsMobile();
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  // Phones get a sheet instead of the anchored popup: a 320px card beside the
  // tap does not fit a 390px screen. Each new line or stop reopens at half.
  const [snap, setSnap] = useState<Snap>('half');
  const targetKey = target
    ? `${target.kind}:${target.providerId}:${target.kind === 'line' ? target.props.route_id : target.props.stop_name}`
    : null;
  useEffect(() => setSnap('half'), [targetKey]);
  const close = () => setTransitPopupTarget(null);
  // A tap on empty map closes it, like the popup's closeOnClick; a tap on
  // another line or stop replaces it instead.
  useMapGesture((g) => {
    if (g.kind === 'tap' && !g.claimed) close();
  }, isMobile && !!target);

  useEffect(() => {
    if (!map || !target || isMobile) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (container) setContainer(null);
      return;
    }
    if (!popupRef.current) {
      const el = document.createElement('div');
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '320px',
      })
        .setLngLat(target.anchor)
        .setDOMContent(el)
        .addTo(map);
      popupRef.current.on('close', () => setTransitPopupTarget(null));
      setContainer(el);
    } else {
      popupRef.current.setLngLat(target.anchor);
    }
  }, [map, target, container, isMobile]);

  // Escape closes.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTransitPopupTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target]);

  if (!target) return null;

  const body =
    target.kind === 'line' ? (
      <LineBody providerId={target.providerId} line={target.props} inSheet={isMobile} />
    ) : (
      <StopBody
        providerId={target.providerId}
        stop={target.props}
        anchor={target.anchor}
        map={map}
        dayFilter={dayFilter}
        hideLowFreq={hideLowFreq}
        inSheet={isMobile}
      />
    );

  if (isMobile) {
    const title = target.kind === 'line' ? target.props.route_long_name : target.props.stop_name;
    return (
      <BottomSheet
        variant="transient"
        snap={snap}
        onSnapChange={(next) => (next === 'peek' ? close() : setSnap(next))}
        onDismiss={close}
        label={title || 'Arrêt'}
        head={
          <div className={styles.sheetHead}>
            {target.kind === 'line' && (
              <span
                className={styles.chip}
                style={{
                  background: target.props.color,
                  color: readableTextOn(target.props.color),
                }}
              >
                {target.props.route_short_name || '—'}
              </span>
            )}
            <span className={styles.sheetTitle}>{title || 'Arrêt'}</span>
            <button type="button" className={styles.sheetClose} aria-label="Fermer" onClick={close}>
              <CloseIcon />
            </button>
          </div>
        }
      >
        {body}
      </BottomSheet>
    );
  }

  if (!container) return null;
  return createPortal(body, container);
}

function LineBody({
  providerId,
  line,
  inSheet = false,
}: {
  providerId: string;
  line: TransitLineProperties;
  /** The sheet's head already carries the chip and name. */
  inSheet?: boolean;
}) {
  const provider = getProvider(providerId);
  const timetableUrl = line.timetable_url ?? provider?.timetableSearchUrl(line) ?? null;
  const freshness = freshnessOf(line);
  const meta = useProviderMeta(providerId);
  const lastUpdate = lastUpdateOf(line, meta);
  const highlight = useTransitHighlight();
  const isHighlighted =
    !!highlight && highlight.providerId === providerId && highlight.routeId === line.route_id;
  const toggleHighlight = () => {
    if (isHighlighted) {
      setTransitHighlight(null);
    } else {
      setTransitHighlight({ providerId, routeId: line.route_id });
    }
  };
  return (
    <div className={`${styles.body} ${inSheet ? styles.inSheet : ''}`}>
      {!inSheet && (
        <div className={styles.header}>
          <span
            className={styles.chip}
            style={{ background: line.color, color: readableTextOn(line.color) }}
          >
            {line.route_short_name || '—'}
          </span>
          <h3 className={styles.title}>{line.route_long_name}</h3>
        </div>
      )}
      <p className={styles.operator}>{provider?.label ?? line.provider_id}</p>
      {/* Two facts, two pills: must I book, and how old is what you are
          reading. Both are stated for every line — the defect this replaced was
          a badge that appeared only for "yes", so "no" and "no idea" looked
          identical. The update pill's colour carries the age, so no sentence
          has to. */}
      <div className={styles.badges}>
        {line.service_kind && (
          <span className={`${styles.badge} ${styles.kind}`}>
            {SERVICE_KIND_LABEL[line.service_kind]}
          </span>
        )}
        <span className={`${styles.badge} ${RESERVATION_BADGE_CLASS[line.reservation]}`}>
          {RESERVATION_LABEL[line.reservation]}
        </span>
        {lastUpdate && (
          <span className={`${styles.badge} ${UPDATE_BADGE_CLASS[lastUpdate.tier]}`}>
            {lastUpdate.label}
          </span>
        )}
        {line.archived && (
          <span className={`${styles.badge} ${styles.archived}`}>{freshness.label}</span>
        )}
      </div>
      {lastUpdate?.checkedOn && <p className={styles.publishedUntil}>{lastUpdate.checkedOn}</p>}
      {lastUpdate?.publishedUntil && (
        <p className={styles.publishedUntil}>{lastUpdate.publishedUntil}</p>
      )}
      {/* The feed no longer carries this line. The pills already give the date
          and the state, so this only has to carry the caveat. */}
      {freshness.note && (
        <p className={styles.staleWarning} role="note">
          {freshness.note}
          {line.observed_from && line.observed_to && (
            <>
              {' '}
              Elle circulait du {isoToFr(line.observed_from)} au {isoToFr(line.observed_to)}.
            </>
          )}
        </p>
      )}
      {/* Reservation is stated for every line, including when we do not know.
          The bug being fixed was a silent one — a badge that only appeared for
          "yes", so "no" and "no idea" looked the same — so the fix cannot be
          silent either. */}
      {line.reservation === 'required' && line.reservation_detail && (
        <p className={styles.tadInfo}>
          {line.reservation_detail.deadline && (
            <strong>Réserver {line.reservation_detail.deadline}. </strong>
          )}
          {line.reservation_detail.message}
          {line.reservation_detail.phone && (
            <>
              {' — '}
              <PhoneIcon /> {line.reservation_detail.phone}
            </>
          )}
          {line.reservation_detail.url && (
            <>
              {' '}
              <a href={line.reservation_detail.url} target="_blank" rel="noopener noreferrer">
                Réserver →
              </a>
            </>
          )}
        </p>
      )}

      <p className={styles.endpoints}>
        {line.stops_count} arrêts · {line.endpoints[0] || '?'} ↔ {line.endpoints[1] || '?'}
      </p>
      <dl className={styles.service}>
        <dt className={styles.serviceDay}>Lun–Ven</dt>
        <dd className={`${styles.serviceValue} ${line.service.weekday ? '' : styles.serviceNone}`}>
          {summariseService(line.service.weekday)}
        </dd>
        <dt className={styles.serviceDay}>Sam</dt>
        <dd className={`${styles.serviceValue} ${line.service.saturday ? '' : styles.serviceNone}`}>
          {summariseService(line.service.saturday)}
        </dd>
        <dt className={styles.serviceDay}>Dim</dt>
        <dd className={`${styles.serviceValue} ${line.service.sunday ? '' : styles.serviceNone}`}>
          {summariseService(line.service.sunday)}
        </dd>
      </dl>
      <button
        type="button"
        className={styles.highlightBtn}
        style={{ background: line.color, color: readableTextOn(line.color) }}
        onClick={toggleHighlight}
      >
        {isHighlighted ? 'Masquer le tracé' : 'Voir le tracé sur la carte'}
      </button>
      {timetableUrl && (
        <a className={styles.link} href={timetableUrl} target="_blank" rel="noopener noreferrer">
          Voir les horaires →
        </a>
      )}
      <p className={styles.footer}>Données indicatives, peuvent être obsolètes.</p>
    </div>
  );
}

function StopBody({
  providerId,
  stop,
  anchor,
  map,
  dayFilter,
  hideLowFreq,
  inSheet = false,
}: {
  providerId: string;
  stop: TransitStopProperties;
  anchor: [number, number];
  map: maplibregl.Map | null;
  dayFilter: DayFilter;
  hideLowFreq: boolean;
  inSheet?: boolean;
}) {
  const index = map ? getOrBuildLineIndex(map, providerId) : null;
  const filterActive = dayFilter !== 'any' || hideLowFreq;
  const visible = filterActive
    ? stop.serving_lines.filter((l) => passesFilter(index?.get(l.route_id), dayFilter, hideLowFreq))
    : stop.serving_lines;
  const hidden = stop.serving_lines.length - visible.length;
  return (
    <div className={`${styles.body} ${inSheet ? styles.inSheet : ''}`}>
      {!inSheet && <h3 className={styles.title}>{stop.stop_name || 'Arrêt'}</h3>}
      <p className={styles.operator}>
        {stop.serving_lines.length} ligne{stop.serving_lines.length > 1 ? 's' : ''}
      </p>
      <ul className={styles.servingList}>
        {visible.map((l) => (
          <li key={l.route_id} className={styles.servingItem}>
            <button
              type="button"
              className={styles.servingChip}
              style={{ background: l.color, color: readableTextOn(l.color) }}
              onClick={() => {
                // Look up the line in the cached source data and open its
                // popup. We don't have the full TransitLineProperties here,
                // so we ask the map (parent) to resolve it by route_id.
                window.dispatchEvent(
                  new CustomEvent('transit:open-line', {
                    detail: { providerId, routeId: l.route_id, anchor },
                  }),
                );
              }}
            >
              {l.short_name}
            </button>
            {l.reservation === 'required' && (
              <span className={styles.tadWarning}>
                <WarningIcon /> {l.short_name} sur réservation
              </span>
            )}
            {l.reservation === 'unknown' && (
              <span className={styles.unknownWarning}>? {l.short_name} réservation inconnue</span>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className={styles.hiddenHint}>
          +{hidden} masquée{hidden > 1 ? 's' : ''} par le filtre
        </p>
      )}
    </div>
  );
}
