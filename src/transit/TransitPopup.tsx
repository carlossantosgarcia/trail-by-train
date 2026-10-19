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
import { FeedbackButton } from '../features/feedback';
import { pdfLinkText, useTimetablePdfs } from './timetablePdfs';
import { setTransitHighlight, useTransitHighlight } from './highlightStore';
import type {
  ReservationStatus,
  ServiceWindow,
  TransitLineProperties,
  TransitStopProperties,
} from './types';
import { runsOnSelected, type DaySelection } from './serviceDays';
import { keepPopupInView } from '../lib/popupPlacement';
import styles from './TransitPopup.module.css';
import { formatIsoDate, t, useT, type MessageKey } from '../i18n';
import { CloseIcon, PhoneIcon, WarningIcon } from '../components/icons/lucide';
import BottomSheet, { type Snap } from '../components/BottomSheet';
import { useIsMobile } from '../lib/useIsMobile';
import { useMapGesture } from '../lib/mapGestures';

interface Props {
  map: maplibregl.Map | null;
  dayFilter: DaySelection;
}

function useTransitPopupTarget(): TransitPopupTarget {
  const [target, setTarget] = useState<TransitPopupTarget>(getTransitPopupTarget());
  useEffect(() => subscribeTransitPopup(setTarget), []);
  return target;
}

function isoToFr(iso: string): string {
  return formatIsoDate(iso);
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
  if (!sw) return t('transit.noService');
  if (sw.trips === 1) return t('transit.oneTrip', { first: sw.firstDep });
  return t('transit.trips', { first: sw.firstDep, last: sw.lastDep, n: sw.trips });
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
  train: 'transit.kindTrain',
  rail_replacement: 'transit.kindReplacement',
} as const;

const RESERVATION_LABEL: Record<ReservationStatus, MessageKey> = {
  required: 'transit.reservationRequired',
  not_required: 'transit.reservationNone',
  unknown: 'transit.reservationUnknown',
};

export default function TransitPopup({ map, dayFilter }: Props) {
  useT();
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
      keepPopupInView(map, popupRef.current);
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
        dayFilter={dayFilter}
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
        label={title || t('transit.stop')}
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
            <span className={styles.sheetTitle}>{title || t('transit.stop')}</span>
            <button
              type="button"
              className={styles.sheetClose}
              aria-label={t('popup.close')}
              onClick={close}
            >
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

/** A line with more sheets than this (seasons, directions) shows the first ones. */
const MAX_PDF_LINKS = 3;

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
  useT();
  const provider = getProvider(providerId);
  const timetableUrl = line.timetable_url ?? provider?.timetableSearchUrl(line) ?? null;
  // The operator's own PDFs, when we know them, replace the search link.
  const pdfs = useTimetablePdfs(providerId, line.route_id).slice(0, MAX_PDF_LINKS);
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
            {t(SERVICE_KIND_LABEL[line.service_kind])}
          </span>
        )}
        <span className={`${styles.badge} ${RESERVATION_BADGE_CLASS[line.reservation]}`}>
          {t(RESERVATION_LABEL[line.reservation])}
        </span>
        {line.shape_estimated && (
          <span className={`${styles.badge} ${styles.estimated}`}>
            <WarningIcon />
            {t(line.shape_estimated === 'part' ? 'transit.shapePart' : 'transit.shapeAll')}
          </span>
        )}
        {lastUpdate && (
          <span className={`${styles.badge} ${UPDATE_BADGE_CLASS[lastUpdate.tier]}`}>
            {lastUpdate.label}
          </span>
        )}
        {line.archived && (
          <span className={`${styles.badge} ${styles.archived}`}>{freshness.label}</span>
        )}
        {meta?.dormant_since && (
          <span className={`${styles.badge} ${styles.archived}`}>{t('transit.offSeason')}</span>
        )}
      </div>
      {/* Last season's timetable, kept while the network publishes none. */}
      {meta?.dormant_since && (
        <p className={styles.publishedUntil}>
          {t('transit.dormant', { date: isoToFr(meta.dormant_since) })}
        </p>
      )}
      {/* The feed gives this line no shape; this is the last one it did. */}
      {line.shape_seen_on && (
        <p className={styles.publishedUntil}>
          {t('transit.shapeSeen', { date: isoToFr(line.shape_seen_on) })}
        </p>
      )}
      {/* No usable shape in the feed: the stops were routed over OSM roads. The
          pill says so; this says how. */}
      {line.shape_estimated && (
        <p className={styles.publishedUntil}>{t('transit.shapeEstimatedNote')}</p>
      )}
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
              {t('transit.ranFromTo', {
                from: isoToFr(line.observed_from),
                to: isoToFr(line.observed_to),
              })}
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
            <strong>{t('transit.bookBy', { deadline: line.reservation_detail.deadline })} </strong>
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
                {t('transit.book')}
              </a>
            </>
          )}
        </p>
      )}

      <p className={styles.endpoints}>
        {t('transit.stopsBetween', {
          n: line.stops_count,
          a: line.endpoints[0] || '?',
          b: line.endpoints[1] || '?',
        })}
      </p>
      <dl className={styles.service}>
        <dt className={styles.serviceDay}>{t('transit.weekdays')}</dt>
        <dd className={`${styles.serviceValue} ${line.service.weekday ? '' : styles.serviceNone}`}>
          {summariseService(line.service.weekday)}
        </dd>
        <dt className={styles.serviceDay}>{t('days.satShort')}</dt>
        <dd className={`${styles.serviceValue} ${line.service.saturday ? '' : styles.serviceNone}`}>
          {summariseService(line.service.saturday)}
        </dd>
        <dt className={styles.serviceDay}>{t('days.sunShort')}</dt>
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
        {t(isHighlighted ? 'transit.hideRoute' : 'transit.showRoute')}
      </button>
      {pdfs.length > 0 ? (
        <ul className={styles.pdfLinks}>
          {pdfs.map((pdf) => (
            <li key={pdf.url}>
              <a className={styles.link} href={pdf.url} target="_blank" rel="noopener noreferrer">
                {pdfLinkText(pdf)} (PDF) →
              </a>
            </li>
          ))}
        </ul>
      ) : (
        timetableUrl && (
          <a className={styles.link} href={timetableUrl} target="_blank" rel="noopener noreferrer">
            {t('transit.timetable')}
          </a>
        )
      )}
      <p className={styles.footer}>{t('transit.indicative')}</p>
      <FeedbackButton
        subject={{
          kind: 'line',
          network: provider?.label ?? line.provider_id,
          providerId,
          line: line.route_short_name || '',
          lineName: line.route_long_name || '',
          routeId: line.route_id,
        }}
      />
    </div>
  );
}

function StopBody({
  providerId,
  stop,
  anchor,
  dayFilter,
  inSheet = false,
}: {
  providerId: string;
  stop: TransitStopProperties;
  anchor: [number, number];
  dayFilter: DaySelection;
  inSheet?: boolean;
}) {
  useT();
  // Lines recorded before they carried their days pass, like on the map.
  const visible = stop.serving_lines.filter((l) => runsOnSelected(l.service_days, dayFilter));
  const hidden = stop.serving_lines.length - visible.length;
  return (
    <div className={`${styles.body} ${inSheet ? styles.inSheet : ''}`}>
      {!inSheet && <h3 className={styles.title}>{stop.stop_name || t('transit.stop')}</h3>}
      <p className={styles.operator}>{t('transit.lines', { n: stop.serving_lines.length })}</p>
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
                <WarningIcon /> {t('transit.onBooking', { line: l.short_name })}
              </span>
            )}
            {l.reservation === 'unknown' && (
              <span className={styles.unknownWarning}>
                {t('transit.bookingUnknown', { line: l.short_name })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className={styles.hiddenHint}>{t('transit.hiddenByFilter', { n: hidden })}</p>
      )}
    </div>
  );
}
