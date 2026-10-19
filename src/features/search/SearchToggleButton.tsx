import { expandSearch, warmIndex } from './store';
import SearchIcon from './SearchIcon';
import { useT } from '../../i18n';

/**
 * The collapsed form of search on mobile: one icon in the dock's action row,
 * beside Explore and Ouvrir. Rendered by the dock rather than by SearchBar,
 * because the two states live in different rows — and giving the collapsed
 * state its own row cost a full extra band of chrome on a viewport that is
 * already tight against the map-dominance budget.
 *
 * Styled by the dock (it is handed the same action class as its neighbours),
 * so it matches them at every breakpoint without a stylesheet of its own.
 */
export default function SearchToggleButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      className={className}
      aria-label={t('search.label')}
      title={t('search.label')}
      onClick={() => {
        // Start the index fetch on the tap, so it overlaps the keyboard
        // animation instead of the first keystroke.
        warmIndex();
        expandSearch();
      }}
    >
      <span aria-hidden>
        <SearchIcon />
      </span>
      <span>{t('search.short')}</span>
    </button>
  );
}
