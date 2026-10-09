import FilePickerButton from '../features/gpx/FilePickerButton';
import TrackList from '../features/gpx/TrackList';
import ExploreButton from '../features/explore/ExploreButton';
import { SearchBar, SearchToggleButton, useSearch } from '../features/search';
import { useExplore } from '../features/explore';
import { useGpxStore } from '../features/gpx/store';
import { useIsMobile } from '../lib/useIsMobile';
import styles from './TracksDock.module.css';

/**
 * The top-left dock: the two map actions and the loaded-track list, in one
 * surface.
 *
 * Previously these were three absolutely-positioned elements sharing one
 * corner by hand-tuned `top` offsets, which collided whenever any of them
 * changed height. The dock owns the position; its contents just flow.
 *
 * It decides its own visibility rather than being told, because both of its
 * parts can vanish independently: the file action is hidden in Explore mode,
 * the Explore action hides itself once Explore is active, and the track list
 * renders nothing until a GPX is loaded. With all of them gone the dock would
 * otherwise be an empty bordered box.
 */
export default function TracksDock() {
  const exploreActive = useExplore().active;
  const isMobile = useIsMobile();
  // Desktop always shows the field; mobile shows it only once the user asks,
  // and shows a search icon alongside the other actions until then.
  const searchExpanded = useSearch().expanded;
  const showSearchField = !exploreActive && (!isMobile || searchExpanded);
  const showSearchAction = !exploreActive && isMobile && !searchExpanded;
  // On mobile the list is a segment of the bottom sheet, so the dock is just
  // the two actions — mounting the list in both places would duplicate it.
  const showList = useGpxStore((s) => s.tracks.length > 0) && !isMobile;

  // In Explore mode both actions are gone; without a list there is nothing
  // left to put on a surface.
  if (exploreActive && !showList) return null;

  return (
    <div className={styles.dock}>
      {/* Search sits above the actions: it is how you get somewhere, and the
          actions are what you do once there. Hidden in Explore mode with the
          rest of the normal chrome — the mode has its own top bar.

          On mobile the field only takes this row once opened; until then it is
          the icon in the action row below, which keeps the collapsed dock one
          band tall instead of two. */}
      {showSearchField && (
        <div className={styles.search}>
          <SearchBar />
        </div>
      )}
      <div className={styles.head}>
        {!exploreActive && (
          <>
            {showSearchAction && <SearchToggleButton className={styles.actionSecondary} />}
            <ExploreButton className={styles.actionPrimary} />
            <FilePickerButton className={styles.actionSecondary} />
          </>
        )}
      </div>
      {showList && (
        <div className={styles.body}>
          <TrackList />
        </div>
      )}
    </div>
  );
}
