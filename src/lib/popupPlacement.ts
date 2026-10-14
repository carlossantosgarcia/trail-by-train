import type maplibregl from 'maplibre-gl';
import { fitPadding } from './chromePadding';

interface Box {
  width: number;
  height: number;
}
interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Room for the popup's tip between the point and the card. */
const TIP_PX = 12;

/** Breathing room kept between a popup and the chrome around it. */
const GAP_PX = 8;

/**
 * The map's visible part: the side docks from the chrome tokens, the bottom
 * from the elevation dock where it actually is (it exists only with a track
 * loaded, and its height depends on whether it is expanded).
 */
function visibleInsets(container: HTMLElement): Insets {
  const sides = fitPadding(GAP_PX);
  const box = container.getBoundingClientRect();
  const dock = document.querySelector('[data-map-chrome="bottom"]')?.getBoundingClientRect();
  const dockInset = dock && dock.height > 0 ? Math.max(0, box.bottom - dock.top) : 0;
  return { top: GAP_PX, right: sides.right, bottom: dockInset + GAP_PX, left: sides.left };
}

/**
 * Which side of the point a popup goes, judged on the part of the map the
 * chrome leaves visible. Above the point when the card fits there, below when
 * it fits there instead, otherwise wherever there is more room; nudged left or
 * right when centring it would cross a side.
 */
export function chooseAnchor(
  point: { x: number; y: number },
  card: Box,
  view: Box,
  pad: Insets,
): maplibregl.PositionAnchor {
  const above = point.y - pad.top - TIP_PX;
  const below = view.height - pad.bottom - point.y - TIP_PX;
  const vertical =
    card.height <= above
      ? 'bottom'
      : card.height <= below
        ? 'top'
        : above >= below
          ? 'bottom'
          : 'top';

  const left = point.x - pad.left;
  const right = view.width - pad.right - point.x;
  const half = card.width / 2;
  let horizontal = '';
  if (left < half && right < half) horizontal = right >= left ? 'left' : 'right';
  else if (left < half) horizontal = 'left';
  else if (right < half) horizontal = 'right';

  return (horizontal ? `${vertical}-${horizontal}` : vertical) as maplibregl.PositionAnchor;
}

/**
 * MapLibre's own placement measures against the whole map, which runs under
 * the docks and panels, and only flips a popup below the point once it would
 * leave the map's top edge, never checking that it fits there. A tall popup
 * near the top then hangs under the bottom dock until a zoom carries the point
 * a full popup-height down. This re-places the popup on every map move and
 * whenever its content changes size, until the popup closes.
 */
export function keepPopupInView(map: maplibregl.Map, popup: maplibregl.Popup): void {
  const place = () => {
    const el = popup.getElement();
    if (!el || !popup.isOpen()) return;
    const container = map.getContainer();
    const anchor = chooseAnchor(
      map.project(popup.getLngLat()),
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: container.clientWidth, height: container.clientHeight },
      visibleInsets(container),
    );
    if (popup.options.anchor !== anchor) {
      popup.options.anchor = anchor;
      popup.setLngLat(popup.getLngLat());
    }
  };
  map.on('move', place);
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
  const el = popup.getElement();
  if (ro && el) ro.observe(el);
  place();
  popup.once('close', () => {
    map.off('move', place);
    ro?.disconnect();
  });
}
