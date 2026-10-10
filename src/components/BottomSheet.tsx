import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { pushBack } from '../lib/backStack';
import styles from './BottomSheet.module.css';

export type Snap = 'peek' | 'half' | 'full';

const ORDER: Snap[] = ['peek', 'half', 'full'];

/** px/ms above which a release is a flick rather than a settle. */
const FLICK_VELOCITY = 0.4;

/** Two snap heights closer than this are one: the content stops both. */
const SAME_HEIGHT_PX = 8;

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
  /** Where a tap on the head opens the sheet from peek. */
  openSnap?: Exclude<Snap, 'peek'>;
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
 * Height is driven by CSS (`--sheet-peek` / `--sheet-half` / `--sheet-full`),
 * with half and full capped by the measured content (`--sheet-content`), so a
 * sheet never opens taller than what it holds. When the content fits under
 * half, half and full are one height and the sheet has a single open state.
 * A drag translates the sheet live, then releases to a snap point: the
 * nearest distinct one, or the next one along if the gesture was a flick.
 *
 * While open (or, for a dismissible transient sheet, while shown), the sheet
 * holds an entry on the back stack, so the phone's back button closes it.
 */
export default function BottomSheet({
  snap,
  onSnapChange,
  head,
  children,
  variant = 'persistent',
  onDismiss,
  openSnap = 'half',
  label,
  className,
}: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    id: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
    height: number;
  } | null>(null);

  // Publish the natural height of head + content, which caps half and full.
  // The content wrapper is measured rather than the body: the body's own
  // height follows the sheet's, and measuring it would feed back.
  useLayoutEffect(() => {
    const el = sheetRef.current;
    const head = headRef.current;
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!el || !head || !body || !content || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cs = getComputedStyle(body);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const headH = head.offsetHeight;
      el.style.setProperty('--sheet-head', `${headH}px`);
      el.style.setProperty('--sheet-content', `${Math.ceil(headH + content.offsetHeight + pad)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(head);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  /** Resolve a CSS length (vh, calc()…) to pixels, in the sheet's context. */
  const lengthPx = useCallback((raw: string): number => {
    const el = sheetRef.current;
    if (!el?.parentElement || !raw) return 0;
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${raw}`;
    el.parentElement.appendChild(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  }, []);

  /** The height a snap point gives this sheet, content cap included. */
  const snapPx = useCallback(
    (s: Snap): number => {
      const el = sheetRef.current;
      if (!el) return 0;
      const cs = getComputedStyle(el);
      if (s === 'peek') {
        const head = parseFloat(cs.getPropertyValue('--sheet-head'));
        const peek = lengthPx(cs.getPropertyValue('--sheet-peek').trim());
        return variant === 'transient' && head > 0 ? head : peek;
      }
      const cap = lengthPx(cs.getPropertyValue(`--sheet-${s}`).trim());
      const content = parseFloat(cs.getPropertyValue('--sheet-content'));
      return content > 0 ? Math.min(cap, content) : cap;
    },
    [lengthPx, variant],
  );

  /** Snap points that differ in height; half wins over an equal full. */
  const distinctPoints = useCallback((): Snap[] => {
    const out: Snap[] = [];
    let last = -Infinity;
    for (const s of ORDER) {
      const h = snapPx(s);
      if (h - last >= SAME_HEIGHT_PX) {
        out.push(s);
        last = h;
      }
    }
    return out;
  }, [snapPx]);

  // Back closes: a dismissible sheet goes, any other one lowers to peek. Only
  // on phones — on desktop the sheet is not displayed at all.
  const backActive = !!onDismiss || snap !== 'peek';
  const closeRef = useRef<() => void>(() => {});
  closeRef.current = () => (onDismiss ? onDismiss() : onSnapChange('peek'));
  useEffect(() => {
    if (!backActive || !window.matchMedia('(max-width: 768px)').matches) return;
    return pushBack(() => closeRef.current());
  }, [backActive]);

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

    const points = distinctPoints();
    // A sheet at a snap point that merged into a lower one sits at that one.
    let idx = points.indexOf(snap);
    if (idx < 0) idx = points.length - 1;

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

  // Tapping the head cycles: peek -> openSnap, and half/full -> peek.
  const onHeadClick = (e: React.MouseEvent) => {
    // Controls inside the head (tabs, close) handle their own clicks.
    if ((e.target as HTMLElement).closest('button, a, [role="tab"]')) return;
    onSnapChange(snap === 'peek' ? openSnap : 'peek');
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
      <div ref={headRef} className={styles.head} {...handlers} onClick={onHeadClick}>
        <span className={styles.grabber} aria-hidden />
        {head}
      </div>
      <div ref={bodyRef} className={styles.body} {...handlers}>
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  );
}
