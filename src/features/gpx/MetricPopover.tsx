import { useEffect, useRef, type CSSProperties } from 'react';
import { EFFORT_METRIC_DEFS, type MetricId } from './effort';
import styles from './MetricPopover.module.css';
import { CloseIcon } from '../../components/icons/lucide';

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 8;

export interface InputRow {
  label: string;
  value: string;
}

interface Props {
  metricId: MetricId;
  anchorRect: DOMRect;
  inputs: ReadonlyArray<InputRow>;
  value: string;
  onClose: () => void;
}

export default function MetricPopover({ metricId, anchorRect, inputs, value, onClose }: Props) {
  const def = EFFORT_METRIC_DEFS[metricId];
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `metric-popover-title-${metricId}`;

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

  // Position: prefer above the anchor so the sidebar (on the left)
  // doesn't get obscured by the popover. Flip below if there isn't
  // room. Horizontally clamp to the viewport.
  const style: CSSProperties = (() => {
    const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
    const left = Math.max(POPOVER_GAP, Math.min(vw - POPOVER_WIDTH - POPOVER_GAP, anchorRect.left));
    // Try above first.
    const above = anchorRect.top - POPOVER_GAP;
    const flip = above < 220; // popover roughly fits in 200-300 px tall
    const top = flip ? anchorRect.bottom + POPOVER_GAP : undefined;
    const bottom = flip ? undefined : vh - anchorRect.top + POPOVER_GAP;
    return {
      position: 'fixed',
      left,
      top,
      bottom,
      width: POPOVER_WIDTH,
    };
  })();

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <div className={styles.header}>
        <h3 id={titleId} className={styles.title}>
          {def.label}
        </h3>
        <button
          ref={closeRef}
          type="button"
          className={styles.closeBtn}
          aria-label="Close explainer"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className={styles.value}>{value}</div>
      <p className={styles.definition}>{def.definition}</p>

      <h4 className={styles.section}>Formula</h4>
      <pre className={styles.formula}>{def.formulaText}</pre>

      <h4 className={styles.section}>Inputs we used</h4>
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

      <h4 className={styles.section}>Reference</h4>
      <p className={styles.refLine}>
        <a href={def.referenceUrl} target="_blank" rel="noopener noreferrer">
          {def.referenceLabel}
        </a>
      </p>

      <h4 className={styles.section}>Limitations</h4>
      <ul className={styles.limitations}>
        {def.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
