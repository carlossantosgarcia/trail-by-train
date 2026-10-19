import { useState, type ReactNode } from 'react';
import { readControlsCollapsed, writeControlsCollapsed } from '../lib/controlsPanelStorage';
import styles from './MapControlsPanel.module.css';
import { LayersIcon } from './icons/lucide';
import { useT } from '../i18n';

interface Props {
  children: ReactNode;
}

/**
 * The desktop layer-controls panel. Mobile renders the same children in the
 * layers segment of the single bottom sheet instead — App picks the host, so
 * this component no longer carries a sheet of its own.
 */
export default function MapControlsPanel({ children }: Props) {
  const t = useT();
  // Minimized state, persisted so it survives reloads.
  const [collapsed, setCollapsed] = useState<boolean>(() => readControlsCollapsed());

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      writeControlsCollapsed(next);
      return next;
    });
  };

  const panelClass = [styles.panel, collapsed ? styles.collapsed : ''].filter(Boolean).join(' ');

  return (
    <>
      <button
        type="button"
        className={`${styles.collapsedTrigger} ${collapsed ? '' : styles.collapsedTriggerHidden}`}
        aria-label={t('panel.show')}
        title={t('panel.show')}
        onClick={toggleCollapsed}
      >
        <LayersIcon />
        <span className={styles.collapsedLabel}>{t('panel.layers')}</span>
      </button>
      <div className={panelClass}>
        <button
          type="button"
          className={styles.minimize}
          aria-label={t('panel.collapse')}
          title={t('panel.collapseShort')}
          onClick={toggleCollapsed}
        >
          –
        </button>
        <div id="map-controls-body" className={styles.body}>
          {children}
        </div>
      </div>
    </>
  );
}
