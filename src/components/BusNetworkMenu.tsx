import { useEffect, useMemo, useRef, useState } from 'react';
import ColorPalette from './ColorPalette';
import type { ProviderConfig } from '../transit';
import { fold } from '../features/search/data';
import { compareFr } from '../lib/collate';
import styles from './BusNetworkMenu.module.css';

interface Props {
  providers: readonly ProviderConfig[];
  visible: Record<string, boolean>;
  providerColors: Record<string, string | null>;
  onVisibleChange: (providerId: string, value: boolean) => void;
  onVisibleChangeAll: (value: boolean) => void;
  onColorChange: (providerId: string, value: string | null) => void;
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

/**
 * Which networks draw on the map. Most people want all of them and never open
 * this; it is a summary ("Tous les réseaux") with the list one tap away, where
 * networks are ticked rather than added and removed one by one. A network's
 * colour is set from its swatch here too, out of the way.
 */
export default function BusNetworkMenu({
  providers,
  visible,
  providerColors,
  onVisibleChange,
  onVisibleChangeAll,
  onColorChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const shown = providers.filter((p) => visible[p.id]).length;
  const summary =
    shown === providers.length
      ? 'Tous les réseaux'
      : shown === 0
        ? 'Aucun réseau'
        : `${shown} réseau${shown > 1 ? 'x' : ''} sur ${providers.length}`;

  // Matching folds accents and separators, so `cote d azur` finds
  // "Côte d'Azur". The region is searched alongside the label: typing a region
  // name is the fastest way to reach a network whose brand you do not know.
  const groups = useMemo(() => {
    const q = fold(query);
    const matches = q
      ? providers.filter((p) => fold(`${p.label} ${p.region}`).includes(q))
      : providers;
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
      .sort((a, b) => rank(a[0]) - rank(b[0]) || compareFr(a[0], b[0]))
      .map(([region, items]) => ({
        region,
        items: [...items].sort((a, b) => compareFr(a.label, b.label)),
      }));
  }, [providers, query]);

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
  // read as networks having gone missing.
  useEffect(() => {
    if (open) {
      setQuery('');
      setColorFor(null);
    }
  }, [open]);

  // The menu opens in flow, inside the controls panel (or the phone sheet),
  // which scrolls on its own. Scroll it just enough to show the whole menu,
  // never past the trigger, so the list is not left below the fold.
  useEffect(() => {
    const menu = menuRef.current;
    const wrap = wrapRef.current;
    if (!open || !menu || !wrap) return;
    let scroller = wrap.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    const overflow = menu.getBoundingClientRect().bottom - box.bottom;
    const room = wrap.getBoundingClientRect().top - box.top;
    if (overflow > 0) scroller.scrollBy({ top: Math.min(overflow + 8, room), behavior: 'smooth' });
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {summary}
        <span aria-hidden className={styles.caret}>
          ▾
        </span>
      </button>
      {open && (
        <div className={styles.menu} ref={menuRef}>
          <input
            type="search"
            className={styles.filter}
            placeholder="Filtrer par nom ou région…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filtrer les réseaux"
          />
          <div className={styles.bulk}>
            <button
              type="button"
              className={styles.link}
              disabled={shown === providers.length}
              onClick={() => onVisibleChangeAll(true)}
            >
              Tout cocher
            </button>
            <button
              type="button"
              className={styles.link}
              disabled={shown === 0}
              onClick={() => onVisibleChangeAll(false)}
            >
              Tout décocher
            </button>
          </div>
          <div className={styles.scroll}>
            {groups.length === 0 ? (
              <span className={styles.empty}>Aucun réseau ne correspond</span>
            ) : (
              groups.map(({ region, items }) => (
                <div key={region} className={styles.group} role="group" aria-label={region}>
                  <div className={styles.groupLabel} aria-hidden>
                    {region}
                  </div>
                  {items.map((p) => {
                    const color = providerColors[p.id] ?? p.lineColor;
                    return (
                      <div key={p.id}>
                        <div className={styles.item}>
                          <label className={styles.check}>
                            <input
                              type="checkbox"
                              checked={!!visible[p.id]}
                              onChange={(e) => onVisibleChange(p.id, e.target.checked)}
                            />
                            <span>{p.label}</span>
                          </label>
                          <button
                            type="button"
                            className={styles.swatch}
                            style={{ background: color }}
                            aria-label={`Couleur — ${p.label}`}
                            aria-expanded={colorFor === p.id}
                            onClick={() => setColorFor((v) => (v === p.id ? null : p.id))}
                          />
                        </div>
                        {colorFor === p.id && (
                          <div className={styles.palette}>
                            <ColorPalette
                              label={`Couleur — ${p.label}`}
                              currentValue={color}
                              defaultValue={p.lineColor}
                              onChange={(v) => onColorChange(p.id, v)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
