import TrainIcon from '../../components/icons/TrainIcon';
import { toggleRail, useExplore } from './store';
import styles from './ExploreRailToggle.module.css';

/** Toggles the railway-network overlay on top of the matched bus lines.
 * Sits just under the Explore basemap switcher. */
export default function ExploreRailToggle() {
  const showRail = useExplore().showRail;
  return (
    <button
      type="button"
      className={`${styles.toggle} ${showRail ? styles.active : ''}`}
      aria-pressed={showRail}
      onClick={toggleRail}
      title="Afficher le réseau ferroviaire"
    >
      <span className={styles.icon} aria-hidden>
        <TrainIcon />
      </span>
      <span>Voie ferrée</span>
    </button>
  );
}
