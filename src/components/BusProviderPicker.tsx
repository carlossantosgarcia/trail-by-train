import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProviderConfig } from '../transit';
import { fold } from '../features/search/data';
import styles from './BusProviderPicker.module.css';

interface Props {
  providers: readonly ProviderConfig[];
  selectedIds: Set<string>;
  providerColors: Record<string, string | null>;
  onSelect: (providerId: string) => void;
}

/**
 * Regions in rough north-to-south, west-to-east reading order rather than
 * alphabetical: a user scanning for "somewhere near me" thinks in geography.
 * Any region absent from this list still renders, sorted after the known ones,
 * so adding a provider for a new region can never make it unreachable.
 */
const REGION_ORDER = [
  'Bretagne',
  'Normandie',
  'Hauts-de-France',
  'Grand Est',
  'Pays de la Loire',
  'Centre-Val de Loire',
  'Bourgogne-Franche-Comté',
  'Nouvelle-Aquitaine',
  'Auvergne-Rhône-Alpes',
  'Occitanie',
  "Provence-Alpes-Côte d'Azur",
  'Corse',
];

export default function BusProviderPicker({
  providers,
  selectedIds,
  providerColors,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const unselected = useMemo(
    () => providers.filter((p) => !selectedIds.has(p.id)),
    [providers, selectedIds],
  );
  const allSelected = unselected.length === 0;

  // Matching folds accents and separators, so `cote d azur` finds
  // "Côte d'Azur" and `finistere` finds "Finistère". The region is searched
  // alongside the label — typing a region name is the fastest way to reach a
  // provider whose brand you do not know.
  const groups = useMemo(() => {
    const q = fold(query);
    const matches = q
      ? unselected.filter((p) => fold(`${p.label} ${p.region}`).includes(q))
      : unselected;

    const byRegion = new Map<string, ProviderConfig[]>();
    for (const p of matches) {
      const list = byRegion.get(p.region);
      if (list) list.push(p);
      else byRegion.set(p.region, [p]);
    }

    const rank = (r: string) => {
      const i = REGION_ORDER.indexOf(r);
      return i === -1 ? REGION_ORDER.length : i;
    };
    return [...byRegion.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'fr'))
      .map(([region, items]) => ({
        region,
        items: [...items].sort((a, b) => a.label.localeCompare(b.label, 'fr')),
      }));
  }, [unselected, query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Reopening starts from a clean list; a stale filter from last time would
  // read as providers having gone missing.
  useEffect(() => {
    if (open) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        disabled={allSelected}
        aria-expanded={open}
        aria-haspopup="menu"
        title={allSelected ? 'Tous les fournisseurs sont sélectionnés' : 'Ajouter un fournisseur'}
        onClick={() => setOpen((v) => !v)}
      >
        + Fournisseurs ▾
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          {unselected.length === 0 ? (
            <span className={styles.empty}>Tous les fournisseurs sont sélectionnés</span>
          ) : (
            <>
              <input
                ref={inputRef}
                type="search"
                className={styles.filter}
                placeholder="Filtrer par nom ou région…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filtrer les fournisseurs"
              />
              <div className={styles.scroll}>
                {groups.length === 0 ? (
                  <span className={styles.empty}>Aucun fournisseur ne correspond</span>
                ) : (
                  groups.map(({ region, items }) => (
                    <div key={region} className={styles.group}>
                      <div className={styles.groupLabel} role="presentation">
                        {region}
                      </div>
                      {items.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          role="menuitem"
                          className={styles.item}
                          onClick={() => {
                            onSelect(p.id);
                            setOpen(false);
                          }}
                        >
                          <span
                            className={styles.swatch}
                            style={{ background: providerColors[p.id] ?? p.lineColor }}
                          />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
