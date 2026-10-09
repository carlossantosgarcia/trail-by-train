import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { BaseLayer } from '../layers/ignBaseLayers';
import styles from './BaseLayerSwitcher.module.css';

interface BaseLayerSwitcherProps {
  layers: readonly BaseLayer[];
  activeLayerId: string;
  onChange: (id: string) => void;
}

function thumbnailUrl(layer: BaseLayer): string {
  // Resolve against Vite's configured base URL so the asset path works under
  // any deployment prefix (e.g. GitHub Pages /<repo>/).
  return `${import.meta.env.BASE_URL}${layer.thumbnail}`;
}

export default function BaseLayerSwitcher({
  layers,
  activeLayerId,
  onChange,
}: BaseLayerSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];

  const focusOption = useCallback((id: string) => {
    optionRefs.current.get(id)?.focus();
  }, []);

  const moveFocusBy = useCallback(
    (currentId: string, delta: number) => {
      if (layers.length === 0) return;
      const idx = layers.findIndex((l) => l.id === currentId);
      if (idx === -1) return;
      const next = layers[(idx + delta + layers.length) % layers.length];
      onChange(next.id);
      focusOption(next.id);
    },
    [layers, onChange, focusOption],
  );

  // Close the mobile menu on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const renderOption = (layer: BaseLayer, variant: 'row' | 'list'): ReactNode => {
    const isActive = layer.id === activeLayer.id;
    const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      const horizontal = variant === 'row';
      const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
      const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
      if (e.key === nextKey) {
        e.preventDefault();
        moveFocusBy(activeLayer.id, +1);
      } else if (e.key === prevKey) {
        e.preventDefault();
        moveFocusBy(activeLayer.id, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        const first = layers[0];
        onChange(first.id);
        focusOption(first.id);
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = layers[layers.length - 1];
        onChange(last.id);
        focusOption(last.id);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onChange(layer.id);
        if (variant === 'list') setOpen(false);
      }
    };

    return (
      <button
        key={layer.id}
        ref={(el) => {
          if (el) optionRefs.current.set(layer.id, el);
          else optionRefs.current.delete(layer.id);
        }}
        type="button"
        role="radio"
        aria-checked={isActive}
        tabIndex={isActive ? 0 : -1}
        className={
          variant === 'row'
            ? `${styles.option} ${isActive ? styles.active : ''}`
            : `${styles.listOption} ${isActive ? styles.active : ''}`
        }
        onClick={() => {
          onChange(layer.id);
          if (variant === 'list') setOpen(false);
        }}
        onKeyDown={onKeyDown}
      >
        <img
          src={thumbnailUrl(layer)}
          alt=""
          width={variant === 'row' ? 44 : 40}
          height={variant === 'row' ? 44 : 40}
          loading="lazy"
          decoding="async"
          className={styles.thumb}
        />
        <span className={styles.label}>{layer.label}</span>
      </button>
    );
  };

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Desktop: horizontal radiogroup, always visible at >= 769px. */}
      <div className={styles.row} role="radiogroup" aria-label="Basemap">
        {layers.map((layer) => renderOption(layer, 'row'))}
      </div>

      {/* Mobile: collapsed pill, visible only at <= 768px. */}
      <button
        type="button"
        className={styles.pill}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Basemap: ${activeLayer.label}. Activate to change.`}
        onClick={() => setOpen((v) => !v)}
      >
        <img
          src={thumbnailUrl(activeLayer)}
          alt=""
          width={30}
          height={30}
          loading="lazy"
          decoding="async"
          className={styles.pillThumb}
        />
        <span className={styles.pillLabel}>{activeLayer.label}</span>
        <span className={`${styles.chevron} ${open ? styles.open : ''}`} aria-hidden />
      </button>

      {/* Mobile: expanded radiogroup list. */}
      {open && (
        <div className={styles.list} role="radiogroup" aria-label="Basemap">
          {layers.map((layer) => renderOption(layer, 'list'))}
        </div>
      )}
    </div>
  );
}
