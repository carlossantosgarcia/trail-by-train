import { LassoSelectIcon } from '../../components/icons/lucide';
import styles from './ExploreButton.module.css';
import { enterExplore, useExplore } from './store';

/**
 * Enters Explore mode. Rendered in the top-left dock, which supplies its
 * styling; hidden entirely once Explore is active, since the mode has its own
 * top bar with an exit control.
 */
export default function ExploreButton({ className }: { className?: string }) {
  const active = useExplore().active;
  if (active) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={enterExplore}
      aria-label="Explorer une zone"
      title="Explorer une zone"
    >
      <span className={styles.icon} aria-hidden>
        <LassoSelectIcon />
      </span>
      <span>Explorer</span>
    </button>
  );
}
