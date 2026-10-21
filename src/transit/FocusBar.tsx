// Names the focused line while its card is closed: tap it to reopen the card,
// or let the line go. Without it, a focused line whose card was put away left
// the map dimmed with no way to tell why or to undo it.

import { useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { getProvider } from './index';
import { setTransitHighlight, useTransitHighlight } from './highlightStore';
import { getTransitPopupTarget, subscribeTransitPopup } from './popupStore';
import { transitLayerIds } from './transitOverlay';
import { LineChip } from './TransitPopup';
import { useExplore } from '../features/explore';
import { CloseIcon } from '../components/icons/lucide';
import { t, useT } from '../i18n';
import styles from './FocusBar.module.css';

interface Names {
  short: string;
  long: string;
}

/** The focused route's names, from the tiles once they have them. */
function useRouteNames(
  map: maplibregl.Map | null,
  focus: { providerId: string; routeId: string } | null,
): Names | null {
  const [names, setNames] = useState<Names | null>(null);
  const providerId = focus?.providerId;
  const routeId = focus?.routeId;
  useEffect(() => {
    setNames(null);
    if (!map || !providerId || !routeId) return;
    const look = () => {
      const source = transitLayerIds(providerId).lineSource;
      if (!map.getSource(source)) return false;
      const f = map.querySourceFeatures(source, {
        sourceLayer: 'transit',
        filter: ['==', ['to-string', ['get', 'route_id']], routeId],
      })[0];
      if (!f) return false;
      const p = f.properties as { route_short_name?: string; route_long_name?: string };
      setNames({ short: p.route_short_name ?? '', long: p.route_long_name ?? '' });
      return true;
    };
    if (look()) return;
    const onIdle = () => {
      if (look()) map.off('idle', onIdle);
    };
    map.on('idle', onIdle);
    return () => {
      map.off('idle', onIdle);
    };
  }, [map, providerId, routeId]);
  return names;
}

export default function FocusBar({ map }: { map: maplibregl.Map | null }) {
  useT();
  const focus = useTransitHighlight();
  const explore = useExplore();
  const [cardOpen, setCardOpen] = useState(() => !!getTransitPopupTarget());
  useEffect(
    () =>
      subscribeTransitPopup((target) => {
        setCardOpen(target?.kind === 'line');
      }),
    [],
  );
  const names = useRouteNames(map, focus);
  if (!focus || cardOpen) return null;
  const network = getProvider(focus.providerId)?.label ?? '';
  return (
    <div
      className={`${styles.bar} ${explore.active ? styles.inExplore : ''}`}
      role="status"
      data-map-chrome="focus"
    >
      <button
        type="button"
        className={styles.open}
        aria-label={t('transit.focusOpen', { line: names?.short ?? '' })}
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('transit:open-line', {
              detail: { providerId: focus.providerId, routeId: focus.routeId },
            }),
          )
        }
      >
        <LineChip providerId={focus.providerId} routeId={focus.routeId}>
          {names?.short || '…'}
        </LineChip>
        <span className={styles.text}>
          <span className={styles.name}>{names?.long || t('transit.focusHint')}</span>
          <span className={styles.network}>{network}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.clear}
        aria-label={t('transit.focusClear')}
        title={t('transit.focusClear')}
        onClick={() => setTransitHighlight(null)}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
