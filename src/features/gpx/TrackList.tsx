import { useState } from 'react';
import EyeIcon from '../../components/icons/EyeIcon';
import {
  remove,
  rename,
  retryEnrichment,
  select,
  setColour,
  setVisibility,
  useGpxStore,
  zoomToTrack,
} from './store';
import { PALETTE } from './palette';
import { elevationSourceOf, type EnrichmentState, type Track, type TrackSummary } from './types';
import styles from './TrackList.module.css';
import { CloseIcon, FitIcon, MountainIcon, WarningIcon } from '../../components/icons/lucide';

function formatStats(s: TrackSummary, enrichment?: EnrichmentState): string {
  const km = s.distanceKm.toFixed(1);
  const parts = [`${km} km`];

  // D+/D- is meaningless until we know whether elevation exists at all.
  // Showing "↑0 m" while a lookup is in flight, or when terrain has no
  // coverage, would read as a genuinely flat route rather than as missing
  // data — so say what is actually true instead.
  if (enrichment?.status === 'pending') {
    parts.push('altitude…');
  } else if (!s.hasElevation) {
    parts.push('no altitude data');
  } else {
    parts.push(`↑${s.ascentM} m`, `↓${s.descentM} m`);
  }

  if (s.elapsedSeconds !== undefined) {
    const h = Math.floor(s.elapsedSeconds / 3600);
    const m = Math.floor((s.elapsedSeconds % 3600) / 60);
    parts.push(`${h}h ${m.toString().padStart(2, '0')}m`);
  }
  return parts.join(' · ');
}

/** Short provenance note, or null when there is nothing worth saying. */
function elevationNote(s: TrackSummary): { text: string; title: string } | null {
  if (elevationSourceOf(s) !== 'terrain') return null;
  const partial = s.terrainCoverage !== undefined && s.terrainCoverage < 0.999;
  return {
    text: partial ? 'altitude du terrain (partielle)' : 'altitude du terrain',
    title: partial
      ? 'This file had no altitude of its own. Altitude comes from the IGN RGE ALTI ' +
        'terrain model, and part of the route lies outside its coverage, so D+/D− ' +
        'covers only the mapped portion.'
      : 'This file had no altitude of its own. Altitude is read from the IGN RGE ALTI ' +
        'terrain model — it describes the ground under the drawn line, not what a ' +
        'device measured while walking.',
  };
}

interface TrackRowProps {
  track: Track;
  selected: boolean;
  enrichment?: EnrichmentState;
}

function TrackRow({ track, selected, enrichment }: TrackRowProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const note = elevationNote(track.summary);

  return (
    <div
      className={`${styles.row} ${selected ? styles.selected : ''}`}
      onClick={() => select(track.id)}
    >
      <div className={styles.topLine}>
        <button
          type="button"
          className={styles.swatch}
          style={{ background: track.colour }}
          aria-label="Change colour"
          onClick={(e) => {
            e.stopPropagation();
            setPopoverOpen((v) => !v);
          }}
        />
        <input
          type="text"
          value={track.name}
          className={styles.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => rename(track.id, e.target.value)}
        />
        <button
          type="button"
          className={styles.iconBtn}
          title={track.visible ? 'Hide on map' : 'Show on map'}
          aria-label={track.visible ? 'Hide on map' : 'Show on map'}
          onClick={(e) => {
            e.stopPropagation();
            setVisibility(track.id, !track.visible);
          }}
        >
          <EyeIcon hidden={!track.visible} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title="Zoom to track"
          aria-label="Zoom to track"
          onClick={(e) => {
            e.stopPropagation();
            zoomToTrack(track.id);
          }}
        >
          <FitIcon />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title="Remove track"
          aria-label="Remove track"
          onClick={(e) => {
            e.stopPropagation();
            void remove(track.id);
          }}
        >
          <CloseIcon />
        </button>
      </div>
      <div className={styles.stats}>
        {track.fromRoute && (
          <span
            className={styles.routeBadge}
            title="Loaded from a GPX <rte> route — a planned itinerary rather than a recorded walk."
          >
            route
          </span>
        )}
        {formatStats(track.summary, enrichment)}
      </div>
      {note && (
        <div className={styles.provenance} title={note.title}>
          <MountainIcon /> {note.text}
        </div>
      )}
      {/* Offered for any track still without altitude, not only one whose
          enrichment failed this session: the failure state is in-memory, so
          after a reload the retry would otherwise vanish and the track would
          look permanently altitude-less. */}
      {enrichment?.status !== 'pending' && !track.summary.hasElevation && (
        <div className={styles.provenance}>
          <span title={enrichment?.message}>
            <WarningIcon />{' '}
            {enrichment?.status === 'failed' && enrichment.reason === 'service-unavailable'
              ? 'elevation service unreachable'
              : 'no altitude for this track'}
          </span>{' '}
          <button
            type="button"
            className={styles.retryBtn}
            onClick={(e) => {
              e.stopPropagation();
              retryEnrichment(track.id);
            }}
          >
            Retry
          </button>
        </div>
      )}
      {popoverOpen && (
        <div
          className={styles.popover}
          style={{ marginTop: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.popoverSwatch}
              style={{ background: c }}
              aria-label={`Use colour ${c}`}
              onClick={() => {
                setColour(track.id, c);
                setPopoverOpen(false);
              }}
            />
          ))}
          <input
            type="color"
            className={styles.popoverInput}
            value={track.colour}
            onChange={(e) => setColour(track.id, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export default function TrackList() {
  // Starts folded so the dock stays compact until the user asks for the list.
  const [collapsed, setCollapsed] = useState(true);
  const tracks = useGpxStore((s) => s.tracks);
  const selectedId = useGpxStore((s) => s.selectedId);
  const enrichment = useGpxStore((s) => s.enrichment);

  // The dock only mounts this once a GPX is loaded, but guard anyway so the
  // component is safe to render on its own.
  if (tracks.length === 0) return null;

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show track list' : 'Hide track list'}
      >
        <span className={styles.title}>Tracks ({tracks.length})</span>
        <span className={styles.collapseBtn} aria-hidden>
          {collapsed ? '+' : '–'}
        </span>
      </button>
      {!collapsed && (
        <div className={styles.list}>
          {tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={t}
              selected={t.id === selectedId}
              enrichment={enrichment[t.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
