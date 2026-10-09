import { confirmRadius, setRadiusKm, useExplore, MAX_RADIUS_KM, MIN_RADIUS_KM } from './store';
import { useIsMobile } from '../../lib/useIsMobile';
import styles from './ExploreRadiusPanel.module.css';

/**
 * The distance control for a point-seeded Explore region.
 *
 * Reached by selecting a place from the search bar, never from the Explore
 * button — a drawn region has no centre to measure from. Moving the slider
 * only redraws the circle (Map.tsx renders it from the store); matching is an
 * explicit confirm, so dragging across the range does not fire a pass per step.
 */
export default function ExploreRadiusPanel() {
  const s = useExplore();
  const isMobile = useIsMobile();
  if (s.phase !== 'radius' || !s.center) return null;

  return (
    <div className={isMobile ? styles.panelMobile : styles.panel}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Autour de</span>
        <span className={styles.title}>{s.centerLabel ?? 'ce point'}</span>
      </div>

      <label className={styles.sliderRow}>
        <span className={styles.srOnly}>Rayon de recherche en kilomètres</span>
        <input
          type="range"
          className={styles.slider}
          min={MIN_RADIUS_KM}
          max={MAX_RADIUS_KM}
          step={1}
          value={s.radiusKm}
          onChange={(e) => setRadiusKm(Number(e.currentTarget.value))}
        />
      </label>

      <div className={styles.scale}>
        <span>{MIN_RADIUS_KM} km</span>
        <span className={styles.value}>{s.radiusKm} km</span>
        <span>{MAX_RADIUS_KM} km</span>
      </div>

      <button type="button" className={styles.confirm} onClick={confirmRadius}>
        Explorer ce rayon
      </button>
    </div>
  );
}
