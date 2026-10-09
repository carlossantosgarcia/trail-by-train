// Dual-handle range slider for filtering curated hikes by duration in
// days. Mounted only while the overlay is on — toggling off unmounts
// it, so the next open starts at the full range (spec requirement).

import { useCallback, useEffect, useRef } from 'react';
import styles from './DurationFilter.module.css';
import { setFilter, useCuratedStore } from './store';

interface Props {
  min: number;
  max: number;
}

type Thumb = 'min' | 'max';

export default function DurationFilter({ min, max }: Props) {
  const filter = useCuratedStore((s) => s.filter);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<Thumb | null>(null);

  const current = filter ?? { min, max };

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, Math.round(v))), [min, max]);

  const fracToValue = useCallback(
    (frac: number) => clamp(min + frac * (max - min)),
    [clamp, min, max],
  );

  const updateFromPointer = useCallback(
    (clientX: number, thumb: Thumb) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = (clientX - rect.left) / rect.width;
      const next = fracToValue(Math.max(0, Math.min(1, raw)));
      if (thumb === 'min') {
        setFilter({ min: Math.min(next, current.max), max: current.max });
      } else {
        setFilter({ min: current.min, max: Math.max(next, current.min) });
      }
    },
    [fracToValue, current.min, current.max],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const t = draggingRef.current;
      if (!t) return;
      e.preventDefault();
      updateFromPointer(e.clientX, t);
    };
    const onUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [updateFromPointer]);

  const onThumbDown = (thumb: Thumb) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.focus();
    draggingRef.current = thumb;
    updateFromPointer(e.clientX, thumb);
  };

  const onThumbKey =
    (thumb: Thumb): React.KeyboardEventHandler<HTMLDivElement> =>
    (e) => {
      let delta = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1;
      else if (e.key === 'Home') delta = -(max - min);
      else if (e.key === 'End') delta = max - min;
      else return;
      e.preventDefault();
      if (thumb === 'min') {
        const next = clamp(current.min + delta);
        setFilter({ min: Math.min(next, current.max), max: current.max });
      } else {
        const next = clamp(current.max + delta);
        setFilter({ min: current.min, max: Math.max(next, current.min) });
      }
    };

  const minFrac = max === min ? 0 : (current.min - min) / (max - min);
  const maxFrac = max === min ? 1 : (current.max - min) / (max - min);

  const summary =
    current.min === current.max
      ? `${current.min} ${current.min === 1 ? 'jour' : 'jours'}`
      : `${current.min}–${current.max} jours`;

  return (
    <div className={styles.panel} aria-label="Filtre par durée">
      <div className={styles.label}>
        <span>Durée</span>
        <span className={styles.value}>{summary}</span>
      </div>
      <div className={styles.trackWrap} ref={trackRef}>
        <div className={styles.track} />
        <div
          className={styles.range}
          style={{ left: `${minFrac * 100}%`, right: `${(1 - maxFrac) * 100}%` }}
        />
        <div
          className={styles.thumb}
          role="slider"
          tabIndex={0}
          aria-label="Durée minimale"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current.min}
          aria-valuetext={`${current.min} jour${current.min === 1 ? '' : 's'}`}
          style={{ left: `${minFrac * 100}%` }}
          onPointerDown={onThumbDown('min')}
          onKeyDown={onThumbKey('min')}
        />
        <div
          className={styles.thumb}
          role="slider"
          tabIndex={0}
          aria-label="Durée maximale"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current.max}
          aria-valuetext={`${current.max} jour${current.max === 1 ? '' : 's'}`}
          style={{ left: `${maxFrac * 100}%` }}
          onPointerDown={onThumbDown('max')}
          onKeyDown={onThumbKey('max')}
        />
      </div>
      <div className={styles.ticks}>
        <span>{min} j</span>
        <span>{max} j</span>
      </div>
    </div>
  );
}
