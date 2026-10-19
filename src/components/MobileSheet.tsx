import { useEffect, useRef, useState, type ReactNode } from 'react';
import BottomSheet, { type Snap } from './BottomSheet';
import { useMapGesture } from '../lib/mapGestures';
import { ChevronUpIcon } from './icons/lucide';
import styles from './MobileSheet.module.css';
import { useT, type MessageKey } from '../i18n';
import { useGpxStore, zoomToTrack } from '../features/gpx/store';

export type Segment = 'layers' | 'tracks' | 'profile';

const SEGMENTS: { id: Segment; label: MessageKey }[] = [
  { id: 'layers', label: 'panel.layers' },
  // "Traces", not "Randos": this is the user's own loaded GPX files. Randos
  // reads as randonnées, which is the curated-hikes overlay — and that lives
  // under Calques, so the old label pointed at the wrong thing.
  { id: 'tracks', label: 'sheet.tracks' },
  { id: 'profile', label: 'sheet.profile' },
];

interface Props {
  layers: ReactNode;
  tracks: ReactNode;
  profile: ReactNode;
  /** Drives which segments exist, and the count shown on the Traces tab. */
  trackCount: number;
  /**
   * Layer toggles shown in the collapsed head when layers is the only
   * segment. Given a function that opens the sheet, for a toggle that needs
   * the full panel first (Bus with no network chosen).
   */
  quickToggles?: (openSheet: () => void) => ReactNode;
}

/**
 * The single persistent bottom sheet on mobile.
 *
 * Before this, mobile ran three hand-rolled sheets — the controls panel, the
 * Explore results and the hike box — two of which shared a z-index badly
 * enough that one hid the other. The map layers, the track list and the
 * elevation profile are now segments of one sheet; anything triggered by a
 * map tap opens as a transient sheet above it.
 *
 * Segments appear only when they have something in them: Traces and Profil
 * both describe loaded GPX files, so until one is loaded the sheet is just
 * the layer controls and shows a plain title instead of a one-item tab row.
 *
 * Switching segment deliberately does not change the snap point: the user
 * set the height, and swapping content should not undo that.
 */
export default function MobileSheet({ layers, tracks, profile, trackCount, quickToggles }: Props) {
  const t = useT();
  const [snap, setSnap] = useState<Snap>('peek');
  const [segment, setSegment] = useState<Segment>('layers');

  const hasTracks = trackCount > 0;
  const available = SEGMENTS.filter((s) => s.id === 'layers' || hasTracks);

  // Removing the last track takes Traces and Profil away with it; if the user
  // was on one of them, fall back rather than render an empty pane.
  useEffect(() => {
    if (!hasTracks && segment !== 'layers') setSegment('layers');
  }, [hasTracks, segment]);

  // Turning to the map — a pan, a zoom, a tap — puts the sheet away. The
  // segment stays, so reopening shows what was there.
  useMapGesture(() => setSnap('peek'), snap !== 'peek');

  // The open profile covers the lower part of the map, and with it part of
  // the track it charts: the dot that follows a finger along the profile
  // would move out of sight. Once the sheet has risen, the map frames the
  // track above it, if it isn't already whole there.
  const selectedId = useGpxStore((s) => s.selectedId);
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (segment !== 'profile' || snap === 'peek' || !selectedId) return;
    const sheet = paneRef.current?.closest<HTMLElement>('[role="region"]');
    if (!sheet) return;
    let live = true;
    const frame = () => {
      if (!live) return;
      const top = sheet.getBoundingClientRect().top;
      zoomToTrack(selectedId, { bottom: window.innerHeight - top, ifHidden: true });
    };
    // A frame later the height transition has started, so it can be waited
    // on; jsdom has no animations, and frames at once.
    const raf = requestAnimationFrame(() => {
      const moving = sheet.getAnimations?.() ?? [];
      void Promise.all(moving.map((a) => a.finished)).then(frame, frame);
    });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [segment, snap, selectedId]);

  // Opened from the head, the sheet goes to full: full is capped by the
  // content, so this is "as tall as the controls", not 88% of an empty sheet.
  const open = () => setSnap('full');

  const onTab = (id: Segment) => {
    setSegment(id);
    // Opening a segment from the collapsed state should show it; beyond that
    // the user's chosen height stands.
    if (snap === 'peek') open();
  };

  // One segment needs no tab row — a lone tab is just a label that looks
  // clickable. Collapsed, that head carries the quick toggles instead, so the
  // common layers are one tap away without opening anything.
  const head =
    available.length === 1 ? (
      snap === 'peek' && quickToggles ? (
        <div className={styles.quickRow}>
          <div className={styles.quickToggles}>{quickToggles(open)}</div>
          {/* An expand control, not a menu: a bare chevron, like the grabber
              above it, rather than a labelled pill that reads as a dropdown. */}
          <button
            type="button"
            className={styles.expandButton}
            aria-label={t('sheet.openLayers')}
            title={t('sheet.openLayers')}
            onClick={open}
          >
            <ChevronUpIcon />
          </button>
        </div>
      ) : (
        <div className={styles.soleTitle}>{t(available[0].label)}</div>
      )
    ) : (
      <div className={styles.tabs} role="tablist" aria-label={t('sheet.tabs')}>
        {available.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`sheet-tab-${s.id}`}
            className={styles.tab}
            aria-selected={segment === s.id}
            aria-controls={`sheet-pane-${s.id}`}
            onClick={() => onTab(s.id)}
          >
            {t(s.label)}
            {s.id === 'tracks' && <span className={styles.count}> ({trackCount})</span>}
          </button>
        ))}
      </div>
    );

  return (
    <BottomSheet
      snap={snap}
      onSnapChange={setSnap}
      openSnap="full"
      head={head}
      label={t('sheet.label')}
    >
      <div
        ref={paneRef}
        className={styles.pane}
        role={available.length === 1 ? undefined : 'tabpanel'}
        id={`sheet-pane-${segment}`}
        aria-labelledby={available.length === 1 ? undefined : `sheet-tab-${segment}`}
      >
        {segment === 'layers' && layers}
        {segment === 'tracks' && tracks}
        {segment === 'profile' && profile}
      </div>
    </BottomSheet>
  );
}
