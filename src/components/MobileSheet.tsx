import { useEffect, useState, type ReactNode } from 'react';
import BottomSheet, { type Snap } from './BottomSheet';
import { useMapGesture } from '../lib/mapGestures';
import { ChevronUpIcon } from './icons/lucide';
import styles from './MobileSheet.module.css';

export type Segment = 'layers' | 'tracks' | 'profile';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'layers', label: 'Calques' },
  // "Traces", not "Randos": this is the user's own loaded GPX files. Randos
  // reads as randonnées, which is the curated-hikes overlay — and that lives
  // under Calques, so the old label pointed at the wrong thing.
  { id: 'tracks', label: 'Traces' },
  { id: 'profile', label: 'Profil' },
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
            aria-label="Ouvrir les calques"
            title="Ouvrir les calques"
            onClick={open}
          >
            <ChevronUpIcon />
          </button>
        </div>
      ) : (
        <div className={styles.soleTitle}>{available[0].label}</div>
      )
    ) : (
      <div className={styles.tabs} role="tablist" aria-label="Panneaux">
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
            {s.label}
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
      label="Panneaux de carte"
    >
      <div
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
