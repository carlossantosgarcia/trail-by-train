import { useEffect, useRef, useState } from 'react';
import ColorPalette from './ColorPalette';
import type { ProviderConfig } from '../transit';
import styles from './BusProviderPill.module.css';
import { CloseIcon } from './icons/lucide';

interface Props {
  provider: ProviderConfig;
  currentColor: string;
  onRemove: () => void;
  onColorChange: (value: string | null) => void;
}

export default function BusProviderPill({
  provider,
  currentColor,
  onRemove,
  onColorChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={styles.pill} ref={wrapRef}>
      <button
        type="button"
        className={styles.ring}
        style={{ ['--ring-color' as const]: currentColor } as React.CSSProperties}
        aria-label={`Changer la couleur — ${provider.label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      <span className={styles.label}>{provider.label}</span>
      <button
        type="button"
        className={styles.remove}
        aria-label={`Retirer ${provider.label}`}
        onClick={onRemove}
      >
        <CloseIcon />
      </button>
      {open && (
        <span className={styles.popover}>
          <ColorPalette
            label={`Couleur — ${provider.label}`}
            currentValue={currentColor}
            defaultValue={provider.lineColor}
            onChange={onColorChange}
          />
        </span>
      )}
    </span>
  );
}
