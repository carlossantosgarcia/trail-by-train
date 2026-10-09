import { useEffect, useState, type ReactNode } from 'react';
import BottomSheet, { type Snap } from './BottomSheet';
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
export default function MobileSheet({ layers, tracks, profile, trackCount }: Props) {
  const [snap, setSnap] = useState<Snap>('peek');
  const [segment, setSegment] = useState<Segment>('layers');

  const hasTracks = trackCount > 0;
  const available = SEGMENTS.filter((s) => s.id === 'layers' || hasTracks);

  // Removing the last track takes Traces and Profil away with it; if the user
  // was on one of them, fall back rather than render an empty pane.
  useEffect(() => {
    if (!hasTracks && segment !== 'layers') setSegment('layers');
  }, [hasTracks, segment]);

  const onTab = (id: Segment) => {
    setSegment(id);
    // Opening a segment from the collapsed state should show it; beyond that
    // the user's chosen height stands.
    if (snap === 'peek') setSnap('half');
  };

  // One segment needs no tab row — a lone tab is just a label that looks
  // clickable.
  const head =
    available.length === 1 ? (
      <div className={styles.soleTitle}>{available[0].label}</div>
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
    <BottomSheet snap={snap} onSnapChange={setSnap} head={head} label="Panneaux de carte">
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
