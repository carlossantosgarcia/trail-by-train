import type { ReactNode } from 'react';
import styles from './OverlayToggle.module.css';

interface OverlayToggleProps {
  /** SVG glyph or `null` when using a text-only badge. */
  icon: ReactNode;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Optional short badge text rendered inside the button in place of the icon (e.g. "GR"). */
  text?: string;
}

export function OverlayToggle({ icon, label, value, onChange, text }: OverlayToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${value ? styles.active : ''}`}
      aria-label={label}
      aria-pressed={value}
      title={label}
      onClick={() => onChange(!value)}
    >
      {text ? (
        <span className={styles.text} aria-hidden>
          {text}
        </span>
      ) : (
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
      )}
    </button>
  );
}

export function OverlayToggleGroup({ children }: { children: ReactNode }) {
  return (
    <div className={styles.group} role="group" aria-label="Overlays">
      {children}
    </div>
  );
}
