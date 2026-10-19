import { LassoSelectIcon } from '../../components/icons/lucide';
import styles from './ExploreButton.module.css';
import { enterExplore, useExplore } from './store';
import { useT } from '../../i18n';

/**
 * Enters Explore mode. Rendered in the top-left dock, which supplies its
 * styling; hidden entirely once Explore is active, since the mode has its own
 * top bar with an exit control.
 */
export default function ExploreButton({ className }: { className?: string }) {
  const t = useT();
  const active = useExplore().active;
  if (active) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={enterExplore}
      aria-label={t('explore.button')}
      title={t('explore.button')}
    >
      <span className={styles.icon} aria-hidden>
        <LassoSelectIcon />
      </span>
      <span>{t('explore.short')}</span>
    </button>
  );
}
