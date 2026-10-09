import { expandSearch, warmIndex } from './store';
import SearchIcon from './SearchIcon';

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
  return (
    <button
      type="button"
      className={className}
      aria-label="Rechercher un lieu"
      title="Rechercher un lieu"
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
      <span>Rechercher</span>
    </button>
  );
}
