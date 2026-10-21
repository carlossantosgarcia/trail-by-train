// Click popup for transit lines and stops. Renders inside a MapLibre
// `Popup`, gated by a tiny module-level store the click handlers write to.

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
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
import { useLineStops, type LineStop, type LineStops, type LineVariant } from './lineStops';
import { setTransitHighlight, useTransitHighlight } from './highlightStore';
import { lineColor, useLineColors } from './lineColors';
import { textColorFor } from '../lib/colorContrast';
import type { ReservationStatus, TransitLineProperties, TransitStopProperties } from './types';
import { runsOnSelected, type DaySelection } from './serviceDays';
import { keepPopupInView } from '../lib/popupPlacement';
import styles from './TransitPopup.module.css';
import { formatIsoDate, t, useT, type MessageKey } from '../i18n';
import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  FitIcon,
  PhoneIcon,
  WarningIcon,
} from '../components/icons/lucide';
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

// Reservation is stated when the feed answers: "obligatoire" is amber (act on
// this), "sans réservation" is quiet (nothing to do). An unknown status shows
// no pill at all, since it gives the reader nothing to act on.
type KnownReservation = Exclude<ReservationStatus, 'unknown'>;

const RESERVATION_PILL_CLASS: Record<KnownReservation, string> = {
  required: styles.pillWarn,
  not_required: styles.pillQuiet,
};

const RESERVATION_LABEL: Record<KnownReservation, MessageKey> = {
  required: 'transit.reservationRequired',
  not_required: 'transit.reservationNone',
};

// Said first, because it changes how to read everything else: a train has no
// bus stop, and a replacement coach runs instead of a train.
const SERVICE_KIND_LABEL = {
  train: 'transit.kindTrain',
  rail_replacement: 'transit.kindReplacement',
} as const;

// Fresh data needs no pill: its date sits in the footer. Old data is a caveat,
// coloured by age, at the top.
const AGE_PILL_CLASS: Partial<Record<UpdateTier, string>> = {
  ageing: styles.pillWarn,
  stale: styles.pillAlert,
};

/** A line's number on its own colour — the colour it is drawn in on the map. */
export function LineChip({
  providerId,
  routeId,
  children,
  large = false,
}: {
  providerId: string;
  routeId: string;
  children: React.ReactNode;
  large?: boolean;
}) {
  useLineColors();
  const bg = lineColor(providerId, routeId);
  return (
    <span
      className={`${styles.chip} ${large ? styles.chipLarge : ''}`}
      style={{ background: bg, color: textColorFor(bg) }}
    >
      {children}
    </span>
  );
}

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

  // A tap on empty map lets go of the focused line too: "tap elsewhere" is
  // how the map deselects, on every screen.
  const focus = useTransitHighlight();
  useMapGesture((g) => {
    if (g.kind === 'tap' && !g.claimed) setTransitHighlight(null);
  }, !!focus);

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
              <LineChip providerId={target.providerId} routeId={target.props.route_id}>
                {target.props.route_short_name || '—'}
              </LineChip>
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

const DAYS = [
  ['weekday', 'transit.weekdays'],
  ['saturday', 'days.satShort'],
  ['sunday', 'days.sunShort'],
] as const;

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
  useLineColors();
  const provider = getProvider(providerId);
  const color = lineColor(providerId, line.route_id);
  const timetableUrl = line.timetable_url ?? provider?.timetableSearchUrl(line) ?? null;
  // The operator's own PDFs, when we know them, replace the search link.
  const pdfs = useTimetablePdfs(providerId, line.route_id).slice(0, MAX_PDF_LINKS);
  const freshness = freshnessOf(line);
  const meta = useProviderMeta(providerId);
  const lastUpdate = lastUpdateOf(line, meta);
  const agePill = lastUpdate ? AGE_PILL_CLASS[lastUpdate.tier] : undefined;
  const network = provider?.label ?? line.provider_id;
  const [from, to] = line.endpoints;
  // The stops as the list shows them: two poles of one stop count once.
  const lineStops = useLineStops(providerId, line.route_id);

  // Everything the reader must weigh before relying on the line, in one block.
  const notes: React.ReactNode[] = [];
  if (line.reservation === 'required' && line.reservation_detail) {
    const d = line.reservation_detail;
    notes.push(
      <>
        {d.deadline && <strong>{t('transit.bookBy', { deadline: d.deadline })} </strong>}
        {d.message}
        {d.phone && (
          <>
            {' '}
            <span className={styles.nowrap}>
              <PhoneIcon /> {d.phone}
            </span>
          </>
        )}
        {d.url && (
          <>
            {' '}
            <a href={d.url} target="_blank" rel="noopener noreferrer">
              {t('transit.book')}
            </a>
          </>
        )}
      </>,
    );
  }
  // The feed no longer carries this line: the caveat and when it ran.
  if (freshness.note) {
    notes.push(
      <>
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
      </>,
    );
  }
  // Last season's timetable, kept while the network publishes none.
  if (meta?.dormant_since) {
    notes.push(t('transit.dormant', { date: isoToFr(meta.dormant_since) }));
  }
  // No usable shape in the feed: the stops were routed over OSM roads.
  if (line.shape_estimated) notes.push(t('transit.shapeEstimatedNote'));
  // The feed gives this line no shape; this is the last one it did.
  if (line.shape_seen_on) {
    notes.push(t('transit.shapeSeen', { date: isoToFr(line.shape_seen_on) }));
  }

  const dataDates = [lastUpdate?.label, lastUpdate?.checkedOn, lastUpdate?.publishedUntil].filter(
    Boolean,
  );

  return (
    <div className={`${styles.body} ${inSheet ? styles.inSheet : ''}`}>
      {!inSheet && (
        <div className={styles.header}>
          <LineChip providerId={providerId} routeId={line.route_id} large>
            {line.route_short_name || '—'}
          </LineChip>
          <h3 className={styles.title}>{line.route_long_name || network}</h3>
        </div>
      )}
      <p className={styles.subtitle}>
        {network} · {t('transit.stopsCount', { n: lineStops?.stopCount || line.stops_count })}
      </p>

      <LineRoute
        key={`${providerId}:${line.route_id}`}
        data={lineStops}
        providerId={providerId}
        routeId={line.route_id}
        endpoints={[from, to]}
        color={color}
      />

      <div className={styles.pills}>
        {line.service_kind && (
          <span className={`${styles.pill} ${styles.pillInk}`}>
            {t(SERVICE_KIND_LABEL[line.service_kind])}
          </span>
        )}
        {line.reservation !== 'unknown' && (
          <span className={`${styles.pill} ${RESERVATION_PILL_CLASS[line.reservation]}`}>
            {line.reservation === 'required' && <PhoneIcon />}
            {t(RESERVATION_LABEL[line.reservation])}
          </span>
        )}
        {line.shape_estimated && (
          <span className={`${styles.pill} ${styles.pillWarn}`}>
            <WarningIcon />
            {t(line.shape_estimated === 'part' ? 'transit.shapePart' : 'transit.shapeAll')}
          </span>
        )}
        {line.archived && (
          <span className={`${styles.pill} ${styles.pillWarn}`}>{freshness.label}</span>
        )}
        {meta?.dormant_since && (
          <span className={`${styles.pill} ${styles.pillWarn}`}>{t('transit.offSeason')}</span>
        )}
        {lastUpdate && agePill && (
          <span className={`${styles.pill} ${agePill}`}>{lastUpdate.label}</span>
        )}
      </div>

      {notes.length > 0 && (
        <ul className={styles.notes} role="note">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {/* No average gap here, although the data carries one: it is taken over
          both directions merged, so it is not how often a bus passes in
          either. */}
      <dl className={styles.service}>
        {DAYS.map(([key, label]) => {
          const sw = line.service[key];
          return (
            <div key={key} className={`${styles.day} ${sw ? '' : styles.dayNone}`}>
              <dt>{t(label)}</dt>
              <dd className={styles.dayTrips}>
                {sw ? t('transit.tripsCount', { n: sw.trips }) : t('transit.noService')}
              </dd>
              {sw && (
                <dd className={styles.dayWindow}>
                  {sw.trips === 1 ? sw.firstDep : `${sw.firstDep}–${sw.lastDep}`}
                </dd>
              )}
            </div>
          );
        })}
      </dl>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            setTransitHighlight({ providerId, routeId: line.route_id });
            window.dispatchEvent(
              new CustomEvent('transit:fit-line', {
                detail: { providerId, routeId: line.route_id },
              }),
            );
            // The card would cover the line just framed; the focus bar keeps
            // naming it, and brings the card back.
            setTransitPopupTarget(null);
          }}
        >
          <FitIcon />
          {t('transit.frameLine')}
        </button>
        {pdfs.length === 1 ? (
          <a
            className={styles.action}
            href={pdfs[0].url}
            target="_blank"
            rel="noopener noreferrer"
            title={pdfLinkText(pdfs[0])}
          >
            {t('transit.timetableShort')} (PDF)
          </a>
        ) : (
          pdfs.length === 0 &&
          timetableUrl && (
            <a
              className={styles.action}
              href={timetableUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('transit.timetableShort')}
            </a>
          )
        )}
      </div>
      {pdfs.length > 1 && (
        <ul className={styles.pdfLinks}>
          {pdfs.map((pdf) => (
            <li key={pdf.url}>
              <a href={pdf.url} target="_blank" rel="noopener noreferrer">
                {pdfLinkText(pdf)} (PDF)
              </a>
            </li>
          ))}
        </ul>
      )}

      <footer className={styles.footer}>
        {dataDates.length > 0 && <p>{dataDates.join(' · ')}</p>}
        <p>{t('transit.indicative')}</p>
        <FeedbackButton
          subject={{
            kind: 'line',
            network,
            providerId,
            line: line.route_short_name || '',
            lineName: line.route_long_name || '',
            routeId: line.route_id,
          }}
        />
      </footer>
    </div>
  );
}

/** How a variant is named in the picker: its two ends, and its length. */
function variantLabel(v: LineVariant): string {
  const first = v.stops[0]?.name ?? '';
  const last = v.stops[v.stops.length - 1]?.name ?? '';
  return `${first} → ${last}`;
}

/**
 * The line from one end to the other, on a rail in its colour: the two
 * termini, and between them the stops it calls at, folded until asked for.
 * A line that runs several ways (branches, school runs from different
 * hamlets, an express beside the stopping service) offers each way as a
 * variant, busiest first. Data without line-stops.json shows the two ends.
 */
function LineRoute({
  data,
  providerId,
  routeId,
  endpoints,
  color,
}: {
  data: LineStops | null;
  providerId: string;
  routeId: string;
  endpoints: [string, string];
  color: string;
}) {
  useT();
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<0 | 1>(0);
  const [pick, setPick] = useState(0);

  const variants = data?.variants.filter((v) => v.dir === dir) ?? [];
  const variant: LineVariant | undefined = variants[pick] ?? variants[0];
  const stops = variant?.stops ?? null;
  const hasReverse = !!data?.variants.some((v) => v.dir !== dir);
  const [from, to] = endpoints;
  if (!stops && !from && !to) return null;
  const between = stops ? stops.slice(1, -1) : [];
  const showStop = (s: LineStop) =>
    window.dispatchEvent(
      new CustomEvent('transit:open-stop', {
        detail: { providerId, routeId, stopId: s.id, lngLat: s.lngLat },
      }),
    );

  const terminus = (name: string, s: LineStop | undefined, edge: 'first' | 'last') => (
    <li className={`${styles.routeStop} ${styles.routeTerminus} ${styles[edge]}`}>
      <span className={styles.rail} aria-hidden="true" />
      {s ? (
        <button
          type="button"
          className={styles.routeName}
          onClick={() => showStop(s)}
          aria-label={t('transit.openStop', { stop: s.name })}
        >
          {s.name}
        </button>
      ) : (
        <span className={styles.routeName}>{name || '—'}</span>
      )}
    </li>
  );

  return (
    <div className={styles.route} style={{ ['--line' as string]: color }}>
      {open && variants.length > 1 && (
        <div className={styles.variants} role="radiogroup" aria-label={t('transit.variants')}>
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={v === variant}
              className={styles.variant}
              onClick={() => setPick(i)}
            >
              <span className={styles.variantName}>{variantLabel(v)}</span>
              <span className={styles.variantCount}>
                {t('transit.stopsCount', { n: v.stops.length })}
              </span>
            </button>
          ))}
        </div>
      )}
      <ol className={styles.routeList}>
        {terminus(from, stops?.[0], 'first')}
        {between.length > 0 && !open && (
          <li className={`${styles.routeStop} ${styles.routeFold}`}>
            <span className={styles.rail} aria-hidden="true" />
            <button
              type="button"
              className={styles.routeToggle}
              aria-expanded={false}
              onClick={() => setOpen(true)}
            >
              {t('transit.showStops', { n: between.length })}
              {variants.length > 1 && ` · ${t('transit.variantCount', { n: variants.length })}`}
              <ChevronDownIcon />
            </button>
          </li>
        )}
        {open &&
          between.map((s, i) => (
            <li key={`${s.id}-${i}`} className={styles.routeStop}>
              <span className={styles.rail} aria-hidden="true" />
              <button
                type="button"
                className={styles.routeName}
                onClick={() => showStop(s)}
                aria-label={t('transit.openStop', { stop: s.name })}
              >
                {s.name}
              </button>
            </li>
          ))}
        {terminus(to, stops?.[stops.length - 1], 'last')}
      </ol>
      {open && (
        <div className={styles.routeTools}>
          <button
            type="button"
            className={styles.routeToggle}
            aria-expanded={true}
            onClick={() => setOpen(false)}
          >
            {t('transit.hideStops')}
            <ChevronUpIcon />
          </button>
          {hasReverse && (
            <button
              type="button"
              className={styles.routeToggle}
              onClick={() => {
                setDir((d) => (d === 0 ? 1 : 0));
                setPick(0);
              }}
            >
              <ArrowLeftRightIcon />
              {t('transit.reverse')}
            </button>
          )}
        </div>
      )}
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
  const focus = useTransitHighlight();
  // Lines recorded before they carried their days pass, like on the map.
  const visible = stop.serving_lines.filter((l) => runsOnSelected(l.service_days, dayFilter));
  const hidden = stop.serving_lines.length - visible.length;
  const anyBooking = visible.some((l) => l.reservation === 'required');
  return (
    <div className={`${styles.body} ${inSheet ? styles.inSheet : ''}`}>
      {!inSheet && <h3 className={styles.title}>{stop.stop_name || t('transit.stop')}</h3>}
      <p className={styles.subtitle}>
        {getProvider(providerId)?.label ?? stop.provider_id} ·{' '}
        {t('transit.lines', { n: stop.serving_lines.length })}
      </p>
      <ul className={styles.stopLines} aria-label={t('transit.stopLines')}>
        {visible.map((l) => {
          const focused = focus?.providerId === providerId && focus.routeId === l.route_id;
          return (
            <li key={l.route_id}>
              <button
                type="button"
                className={`${styles.stopLine} ${focused ? styles.stopLineFocused : ''}`}
                aria-pressed={focused}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('transit:open-line', {
                      detail: { providerId, routeId: l.route_id, anchor },
                    }),
                  );
                }}
              >
                <LineChip providerId={providerId} routeId={l.route_id}>
                  {l.short_name || '—'}
                </LineChip>
                {l.reservation === 'required' && (
                  <span className={styles.bookingMark} title={t('transit.onBooking')}>
                    <PhoneIcon />
                  </span>
                )}
                <ChevronRightIcon />
              </button>
            </li>
          );
        })}
      </ul>
      {anyBooking && (
        <p className={styles.legend}>
          <PhoneIcon /> {t('transit.onBooking')}
        </p>
      )}
      {hidden > 0 && <p className={styles.legend}>{t('transit.hiddenByFilter', { n: hidden })}</p>}
    </div>
  );
}
