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
 * How far to scroll the map, in px down the screen, so a card that fits
 * neither above nor below its point fits on the side it was put: 0 when it
 * already fits, or when it is taller than the whole visible map anyway. The
 * point is never pushed out of the visible map.
 */
export function overflowShift(
  point: { x: number; y: number },
  card: Box,
  view: Box,
  pad: Insets,
  anchor: maplibregl.PositionAnchor,
): number {
  if (card.height + TIP_PX > view.height - pad.top - pad.bottom) return 0;
  if (anchor.startsWith('bottom')) {
    const missing = card.height + TIP_PX - (point.y - pad.top);
    return Math.max(0, Math.min(missing, view.height - pad.bottom - point.y));
  }
  const missing = card.height + TIP_PX - (view.height - pad.bottom - point.y);
  return -Math.max(0, Math.min(missing, point.y - pad.top));
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
  const place = (): maplibregl.PositionAnchor | null => {
    const el = popup.getElement();
    if (!el || !popup.isOpen()) return null;
    const container = map.getContainer();
    const insets = visibleInsets(container);
    // The tallest the card may be: it then scrolls inside rather than past
    // the screen's edge (the content's own CSS reads this). The popup's own
    // height counts its tip, and the room needed counts the tip again.
    el.style.setProperty(
      '--popup-max-h',
      `${Math.max(160, container.clientHeight - insets.top - insets.bottom - 2 * TIP_PX - 4)}px`,
    );
    const anchor = chooseAnchor(
      map.project(popup.getLngLat()),
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: container.clientWidth, height: container.clientHeight },
      insets,
    );
    if (popup.options.anchor !== anchor) {
      popup.options.anchor = anchor;
      popup.setLngLat(popup.getLngLat());
    }
    return anchor;
  };
  // A card that grew past the screen (a stop list unfolded) scrolls the map
  // until it fits. Only then: on a move, the reader is the one placing things.
  const onResize = () => {
    const anchor = place();
    const el = popup.getElement();
    if (!anchor || !el || map.isMoving()) return;
    const container = map.getContainer();
    const shift = overflowShift(
      map.project(popup.getLngLat()),
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: container.clientWidth, height: container.clientHeight },
      visibleInsets(container),
      anchor,
    );
    if (shift !== 0) map.panBy([0, -shift], { duration: 250 });
  };
  map.on('move', place);
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
  const el = popup.getElement();
  if (ro && el) ro.observe(el);
  place();
  popup.once('close', () => {
    map.off('move', place);
    ro?.disconnect();
  });
}
