import { useEffect, useRef } from 'react';
import { fold, groupByKind, MIN_QUERY_LENGTH } from './data';
import {
  clearSearch,
  closeSearch,
  collapseSearch,
  selectResult,
  setQuery,
  useSearch,
  warmIndex,
} from './store';
import { isPointResult, KIND_LABEL, type PlaceKind, type SearchResult } from './types';
import { useIsMobile } from '../../lib/useIsMobile';
import SearchIcon from './SearchIcon';
import styles from './SearchBar.module.css';
import { CloseIcon } from '../../components/icons/lucide';

/**
 * The index is a snapshot of a handful of sources, not a gazetteer of France.
 * Saying so is a spec requirement, not a nicety: without it a query that finds
 * nothing reads as "this place does not exist" rather than "this place is not
 * in the index".
 */
const DISCLAIMER =
  'Couverture partielle : sommets, cols, lacs, communes, gares, lignes de bus, randos et GR. Tous les lieux n’y figurent pas.';

function ResultRow({ result }: { result: SearchResult }) {
  const parts = isPointResult(result) ? [result.detail] : [result.detail, result.sub];
  // Station records carry their own name again, in capitals, as the detail
  // ("Die" / "DIE"); repeating it says nothing.
  if (parts[0] && fold(parts[0]) === fold(result.name)) parts.shift();
  // When the hit came from an alias, lead the detail line with it — otherwise
  // typing "Barre des Écrins" and getting a row titled "Les Écrins" reads as
  // the wrong result rather than the right one under its official name.
  if (result.via) parts.unshift(`« ${result.via} »`);
  const secondary = parts.filter(Boolean).join(' · ');
  return (
    <li>
      <button type="button" className={styles.row} onClick={() => selectResult(result)}>
        <span className={styles.rowName}>{result.name}</span>
        {secondary && <span className={styles.rowDetail}>{secondary}</span>}
      </button>
    </li>
  );
}

/**
 * The open search field and its results.
 *
 * On mobile this is mounted only once the user taps the dock's search action
 * (see SearchToggleButton); on desktop it is always mounted. Collapsed state is
 * therefore *absence*, not a hidden element — an earlier version hid the input
 * with `.field .input { display: none }` and revealed it through a composed
 * class, but `composes` puts both class names on the element, so the hiding
 * rule kept matching and the field could never open on a phone at all.
 */
export default function SearchBar() {
  const s = useSearch();
  const isMobile = useIsMobile();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mobile mounts this in response to a tap, so focus belongs on mount — the
  // tap handler cannot focus an input that React has not rendered yet, which
  // is why the keyboard never opened before. Desktop must not autofocus, or
  // loading the page would steal focus into the field.
  useEffect(() => {
    if (isMobile) inputRef.current?.focus();
  }, [isMobile]);

  // A tap anywhere else dismisses the list, the same way a popover behaves, and
  // on mobile gives the row back to the actions when nothing has been typed —
  // a phone has no Escape key to do it with.
  useEffect(() => {
    if (!s.open && !s.expanded) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (wrapRef.current?.contains(ev.target as Node)) return;
      if (s.query) closeSearch();
      else collapseSearch();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [s.open, s.expanded, s.query]);

  const groups = groupByKind(s.results);
  const tooShort = s.query.trim().length > 0 && s.query.trim().length < MIN_QUERY_LENGTH;
  const showList = s.open && s.query.trim().length > 0;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.field}>
        <span className={styles.icon} aria-hidden>
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          value={s.query}
          placeholder="Sommet, commune, gare…"
          aria-label="Rechercher un lieu"
          autoComplete="off"
          onFocus={warmIndex}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              if (s.query) clearSearch();
              else collapseSearch();
              inputRef.current?.blur();
            }
          }}
        />
        {s.query && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Effacer la recherche"
            onClick={() => {
              clearSearch();
              inputRef.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {showList && (
        <div className={styles.results} aria-label="Résultats de recherche">
          <div className={styles.scroll}>
            {s.status === 'loading' && <p className={styles.state}>Chargement de l’index…</p>}
            {s.status === 'error' && (
              <p className={styles.state}>L’index des lieux n’a pas pu être chargé. ({s.error})</p>
            )}
            {tooShort && <p className={styles.state}>Tapez au moins {MIN_QUERY_LENGTH} lettres.</p>}
            {s.status === 'ready' && !tooShort && groups.length === 0 && (
              <p className={styles.state}>Aucun résultat.</p>
            )}
            {groups.map((group) => (
              <section key={group.kind} className={styles.group}>
                <h4 className={styles.groupTitle}>{KIND_LABEL[group.kind as PlaceKind]}</h4>
                <ul className={styles.list}>
                  {group.items.map((r) => (
                    <ResultRow
                      key={`${r.kind}-${r.name}-${r.shape === 'extent' ? r.id : r.coord.join(',')}`}
                      result={r}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className={styles.disclaimer}>{DISCLAIMER}</p>
        </div>
      )}
    </div>
  );
}
