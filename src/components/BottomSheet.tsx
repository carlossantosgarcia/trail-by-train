import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import styles from './BottomSheet.module.css';

export type Snap = 'peek' | 'half' | 'full';

const ORDER: Snap[] = ['peek', 'half', 'full'];

/** px/ms above which a release is a flick rather than a settle. */
const FLICK_VELOCITY = 0.4;

interface Props {
  snap: Snap;
  onSnapChange: (next: Snap) => void;
  /** Always-visible row at the top of the sheet: grabber, tabs, title. */
  head: ReactNode;
  children: ReactNode;
  /**
   * Transient sheets sit above the persistent one and can be dismissed
   * outright. Persistent sheets only ever collapse to `peek`.
   */
  variant?: 'persistent' | 'transient';
  onDismiss?: () => void;
  /** Accessible name. */
  label?: string;
  className?: string;
}

/**
 * Mobile bottom sheet with three snap points.
 *
 * Replaces three hand-rolled sheets that each implemented their own
 * collapsed/open behaviour and, in two cases, landed on the same z-index —
 * which is why ExplorePanel used to hide its results whenever a hike box
 * opened. Everything mobile now comes through here, and the persistent and
 * transient variants sit on different rungs of the stacking ladder.
 *
 * Height is driven by CSS (`--sheet-peek` / `--sheet-half` / `--sheet-full`).
 * A drag translates the sheet live, then releases to a snap point: the
 * nearest one, or the next one along if the gesture was a flick.
 */
export default function BottomSheet({
  snap,
  onSnapChange,
  head,
  children,
  variant = 'persistent',
  onDismiss,
  label,
  className,
}: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    id: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
    height: number;
  } | null>(null);

  /** Resolve a snap token (which may be vh or calc()) to pixels. */
  const snapPx = useCallback((s: Snap): number => {
    const el = sheetRef.current;
    if (!el?.parentElement) return 0;
    const raw = getComputedStyle(el).getPropertyValue(`--sheet-${s}`).trim();
    if (!raw) return 0;
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${raw}`;
    el.parentElement.appendChild(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current) return;
    const body = bodyRef.current;
    // Drag-vs-scroll: the body only claims the gesture once the sheet is
    // fully open AND the content is scrolled away from its top. Otherwise
    // the sheet moves, which is what makes a downward swipe feel right.
    if (body?.contains(e.target as Node) && snap === 'full' && body.scrollTop > 0) {
      return;
    }
    const el = sheetRef.current;
    if (!el) return;
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      height: el.getBoundingClientRect().height,
    };
    el.style.transition = 'none';
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;

    const dy = e.clientY - d.startY;
    // Resist dragging past the tallest snap point.
    const maxUp = Math.max(0, snapPx('full') - d.height);
    el.style.transform = `translateY(${dy < 0 ? Math.max(dy, -maxUp - 24) : dy}px)`;
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    drag.current = null;
    el.style.transition = '';
    el.style.transform = '';

    const dy = e.clientY - d.startY;
    if (Math.abs(dy) < 4) return; // a tap, not a drag — the click handler has it

    const points = ORDER;
    const idx = points.indexOf(snap);

    // A flick moves one step in its direction; anything slower settles on
    // whichever snap point the sheet's new height is closest to.
    if (Math.abs(d.velocity) > FLICK_VELOCITY) {
      const step = d.velocity > 0 ? -1 : 1;
      if (step === -1 && idx === 0) {
        if (variant === 'transient') onDismiss?.();
        return;
      }
      onSnapChange(points[Math.min(points.length - 1, Math.max(0, idx + step))]);
      return;
    }

    const target = d.height - dy;
    let best = points[0];
    let bestDist = Infinity;
    for (const s of points) {
      const dist = Math.abs(snapPx(s) - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    // A decisive downward drag on an already-collapsed transient sheet
    // dismisses it rather than doing nothing.
    if (variant === 'transient' && best === 'peek' && snap === 'peek' && dy > 48) {
      onDismiss?.();
      return;
    }
    if (best !== snap) onSnapChange(best);
  };

  // Tapping the head cycles: peek -> half, and half/full -> peek.
  const onHeadClick = (e: React.MouseEvent) => {
    // Controls inside the head (tabs, close) handle their own clicks.
    if ((e.target as HTMLElement).closest('button, a, [role="tab"]')) return;
    onSnapChange(snap === 'peek' ? 'half' : 'peek');
  };

  useEffect(() => {
    if (variant !== 'transient' || !onDismiss) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, onDismiss]);

  const cls = [
    styles.sheet,
    styles[snap],
    variant === 'transient' ? styles.transient : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return (
    <div
      ref={sheetRef}
      className={cls}
      // A transient sheet is a dialog; the persistent one is page furniture,
      // so it gets a region instead. The previous version paired
      // role="dialog" with aria-expanded, which is not valid ARIA.
      role={variant === 'transient' ? 'dialog' : 'region'}
      aria-label={label}
    >
      <div className={styles.head} {...handlers} onClick={onHeadClick}>
        <span className={styles.grabber} aria-hidden />
        {head}
      </div>
      <div ref={bodyRef} className={styles.body} {...handlers}>
        {children}
      </div>
    </div>
  );
}
