import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { EFFORT_METRIC_DEFS, type MetricId } from './effort';
import type { InputRow } from './metricInputs';
import styles from './MetricPopover.module.css';
import { CloseIcon } from '../../components/icons/lucide';
import { t, useT } from '../../i18n';

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 8;

interface Props {
  metricId: MetricId;
  anchorRect: DOMRect;
  /** The card the metric sits on: when the viewport has room, the
   * explanation opens beside it rather than over it. */
  besideRect?: DOMRect;
  inputs: ReadonlyArray<InputRow>;
  value: string;
  onClose: () => void;
}

export default function MetricPopover({
  metricId,
  anchorRect,
  besideRect,
  inputs,
  value,
  onClose,
}: Props) {
  useT();
  const def = EFFORT_METRIC_DEFS[metricId];
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `metric-popover-title-${metricId}`;
  // Its rendered height, to keep it on screen when it opens beside a card.
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    setHeight(popoverRef.current?.offsetHeight ?? 0);
  }, [metricId, value]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (!popoverRef.current) return;
      if (e.target instanceof Node && popoverRef.current.contains(e.target)) return;
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [onClose]);

  // Position: beside the card when there is room for it, level with the
  // card's top and moved up as far as it must to fit. Otherwise prefer above
  // the anchor so the sidebar (on the left) doesn't get obscured by the
  // popover, and flip below if there isn't room. Horizontally clamp to the
  // viewport, and cap the height to the room it has (it scrolls inside), so
  // a phone shows it whole.
  const style: CSSProperties = (() => {
    const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
    const width = Math.min(POPOVER_WIDTH, vw - 2 * POPOVER_GAP);
    if (besideRect) {
      const fitsRight = besideRect.right + POPOVER_GAP + width + POPOVER_GAP <= vw;
      const fitsLeft = besideRect.left - POPOVER_GAP - width - POPOVER_GAP >= 0;
      if (fitsRight || fitsLeft) {
        const maxHeight = vh - 2 * POPOVER_GAP;
        const top = Math.max(
          POPOVER_GAP,
          Math.min(besideRect.top, vh - POPOVER_GAP - Math.min(height, maxHeight)),
        );
        return {
          position: 'fixed',
          left: fitsRight ? besideRect.right + POPOVER_GAP : besideRect.left - POPOVER_GAP - width,
          top,
          width,
          maxHeight,
        };
      }
    }
    const left = Math.max(POPOVER_GAP, Math.min(vw - width - POPOVER_GAP, anchorRect.left));
    const roomAbove = anchorRect.top - 2 * POPOVER_GAP;
    const roomBelow = vh - anchorRect.bottom - 2 * POPOVER_GAP;
    // Try above first; below when that is too tight and below has more.
    const flip = roomAbove < 220 && roomBelow > roomAbove;
    const top = flip ? anchorRect.bottom + POPOVER_GAP : undefined;
    const bottom = flip ? undefined : vh - anchorRect.top + POPOVER_GAP;
    return {
      position: 'fixed',
      left,
      top,
      bottom,
      width,
      maxHeight: Math.min(vh * 0.8, flip ? roomBelow : roomAbove),
    };
  })();

  // React passes a portal's events up its own tree: a drag in here would
  // reach a bottom sheet holding the card and move the sheet, not scroll this.
  const keepPointer = (e: React.PointerEvent) => e.stopPropagation();

  // On the body: a transformed ancestor (the map's card, a dragged sheet)
  // would otherwise turn position: fixed into its own frame.
  return createPortal(
    <div
      ref={popoverRef}
      className={styles.popover}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onPointerDown={keepPointer}
      onPointerMove={keepPointer}
      onPointerUp={keepPointer}
      onPointerCancel={keepPointer}
    >
      <div className={styles.header}>
        <h3 id={titleId} className={styles.title}>
          {def.label}
        </h3>
        <button
          ref={closeRef}
          type="button"
          className={styles.closeBtn}
          aria-label={t('metric.close')}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className={styles.value}>{value}</div>
      <p className={styles.definition}>{def.definition}</p>

      <h4 className={styles.section}>{t('metric.formula')}</h4>
      <pre className={styles.formula}>{def.formulaText}</pre>

      <h4 className={styles.section}>{t('metric.inputs')}</h4>
      <table className={styles.inputs}>
        <tbody>
          {inputs.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className={styles.section}>{t('metric.reference')}</h4>
      <p className={styles.refLine}>
        <a href={def.referenceUrl} target="_blank" rel="noopener noreferrer">
          {def.referenceLabel}
        </a>
      </p>

      <h4 className={styles.section}>{t('metric.limitations')}</h4>
      <ul className={styles.limitations}>
        {def.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
