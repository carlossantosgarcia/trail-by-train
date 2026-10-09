// Click popup for a selected curated hike. Rendered as a MapLibre Popup
// whose body is a React subtree (via createPortal). Reuses the
// summary + effort metrics already exposed by the GPX feature so curated
// hikes show the same numbers as user-loaded tracks.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import { computeEffortFromSummary } from '../gpx/effort';
import { useIsMobile } from '../../lib/useIsMobile';
import BottomSheet, { type Snap } from '../../components/BottomSheet';
import styles from './HikePopup.module.css';
import { setSelected, useCuratedStore } from './store';
import type { CuratedHike, CuratedSource } from './types';
import { CURATED_SOURCE_LABELS } from './types';
import { BedIcon, CloseIcon } from '../../components/icons/lucide';

// Activity tags worth surfacing as a visible chip in the popup.
// Foot hiking is the default and renders no chip; only unusual modes
// (snowshoes, ski-touring, trail running, cycling, alpinism) flag up.
const ACTIVITY_TAGS = ['raquettes', 'ski', 'trail', 'vélo', 'alpinisme'] as const;

const SOURCE_LINK_LABEL: Record<CuratedSource, string> = {
  'nature-sans-voiture': 'Voir sur naturesansvoiture.wordpress.com ↗',
  'les-others': 'Voir l’article sur Recto Verso / Les Others ↗',
  mollow: 'Voir l’article sur Mollow ↗',
  community: 'Voir la page de la randonnée ↗',
};

interface Props {
  map: maplibregl.Map | null;
}

function formatHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '—';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm} min`;
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

function popupAnchor(hike: CuratedHike, click: [number, number] | null): [number, number] {
  // Prefer the click point so split themed collections (whose bbox can
  // span an entire country) don't drop the popup on top of someone
  // else's hike. Fall back to bbox centre when called outside of a
  // click context (e.g. programmatic selection).
  if (click) return click;
  const [minLon, minLat, maxLon, maxLat] = hike.bbox;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

export default function HikePopup({ map }: Props) {
  const selectedId = useCuratedStore((s) => s.selectedId);
  const selectedAnchor = useCuratedStore((s) => s.selectedAnchor);
  const manifest = useCuratedStore((s) => s.manifest);
  const isMobile = useIsMobile();
  const hike = useMemo(() => {
    if (!manifest || !selectedId) return null;
    return manifest.hikes.find((h) => h.id === selectedId) ?? null;
  }, [manifest, selectedId]);

  // Open at half height so the picked hike stays visible above the sheet;
  // the user can drag it up for the full details.
  const [snap, setSnap] = useState<Snap>('half');
  useEffect(() => setSnap('half'), [selectedId]);

  const popupRef = useRef<maplibregl.Popup | null>(null);
  // State (not a ref) so setting the container element triggers a
  // re-render — otherwise the portal's JSX never paints into it and the
  // popup renders empty on first open.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // On mobile, the popup renders as a fixed bottom sheet (rendered
    // directly below); skip the MapLibre Popup machinery entirely so the
    // anchored card never appears on top of the map on phones.
    if (!map || !hike || isMobile) {
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
        closeOnClick: false,
        maxWidth: '300px',
      })
        .setLngLat(popupAnchor(hike, selectedAnchor))
        .setDOMContent(el)
        .addTo(map);
      popupRef.current.on('close', () => {
        // Only clear selection if it's still us — guard against races
        // when the user clicks another hike before the previous popup's
        // close event has propagated.
        setSelected(null);
      });
      setContainer(el);
    } else {
      popupRef.current.setLngLat(popupAnchor(hike, selectedAnchor));
    }
    // Intentionally no teardown here; remove() runs above when hike → null.
  }, [map, hike, container, selectedAnchor, isMobile]);

  // Escape key closes the popup.
  useEffect(() => {
    if (!hike) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hike]);

  if (!hike) return null;
  if (!isMobile && !container) return null;

  const effort = computeEffortFromSummary(hike.summary);
  const dist = hike.summary.distanceKm.toFixed(1);
  const asc = Math.round(hike.summary.ascentM);
  const desc = Math.round(hike.summary.descentM);
  const effKm = effort.effortKm.toFixed(1);
  const naismith = formatHours(effort.naismithHours);

  const body = (
    <div className={styles.body}>
      <span className={`${styles.badge} ${styles[`badge--${hike.source}`]}`}>
        {CURATED_SOURCE_LABELS[hike.source]}
      </span>
      {ACTIVITY_TAGS.filter((t) => hike.tags.includes(t)).map((t) => (
        <span key={t} className={styles.activityTag}>
          {t}
        </span>
      ))}
      <h3 className={styles.title}>{hike.title}</h3>
      <p className={styles.duration}>
        {hike.durationDays} {hike.durationDays === 1 ? 'jour' : 'jours'}
      </p>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.key}>Distance</span>
          <span className={styles.val}>{dist} km</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.key}>D+ / D−</span>
          <span className={styles.val}>
            {asc} / {desc} m
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.key}>Effort</span>
          <span className={styles.val}>{effKm} km-eff</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.key}>Naismith</span>
          <span className={styles.val}>{naismith}</span>
        </div>
      </dl>
      {hike.days && hike.days.length > 1 && (
        <section className={styles.days} aria-label="Itinéraire jour par jour">
          <h4 className={styles.daysTitle}>Itinéraire jour par jour</h4>
          <ol className={styles.daysList}>
            {hike.days.map((d) => {
              const sleepLabel =
                d.sleep?.name ??
                (d.dayIndex < hike.days.length
                  ? `Étape J${d.dayIndex} → J${d.dayIndex + 1}`
                  : null);
              return (
                <li key={d.dayIndex} className={styles.day}>
                  <span className={styles.dayHead}>J{d.dayIndex}</span>
                  <span className={styles.dayMetrics}>
                    {d.distanceKm.toFixed(1)} km · +{Math.round(d.ascentM)} m · −
                    {Math.round(d.descentM)} m
                  </span>
                  {sleepLabel && (
                    <span className={styles.daySleep}>
                      <BedIcon /> {sleepLabel}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
      {hike.sourceUrl && (
        <a
          className={styles.source}
          href={hike.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {SOURCE_LINK_LABEL[hike.source]}
        </a>
      )}
      {hike.track && (
        <a
          className={styles.source}
          href={`${import.meta.env.BASE_URL}${hike.track.gpx}`}
          download
          title={`Licence ${hike.track.license}`}
        >
          Télécharger le GPX ↓
        </a>
      )}
    </div>
  );

  if (isMobile) {
    // A transient sheet: it sits above the persistent one rather than
    // replacing it, so opening a hike no longer disturbs whichever segment
    // the user had open.
    return (
      <BottomSheet
        variant="transient"
        snap={snap}
        onSnapChange={(next) => {
          if (next === 'peek') setSelected(null);
          else setSnap(next);
        }}
        onDismiss={() => setSelected(null)}
        label={hike.title}
        head={
          <div className={styles.mobileHeader}>
            <span className={styles.mobileTitle}>{hike.title}</span>
            <button
              type="button"
              className={styles.mobileClose}
              aria-label="Close"
              onClick={() => setSelected(null)}
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

  return container ? createPortal(body, container) : null;
}
