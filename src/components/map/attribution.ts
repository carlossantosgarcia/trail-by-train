import type maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';

// Keep the compact attribution collapsed to its ⓘ button.
//
// The lever is the `maplibregl-compact-show` CLASS, not `details.open`.
// MapLibre's stylesheet hides the credits with
//   .maplibregl-compact .maplibregl-ctrl-attrib-inner { display: none }
// and reveals them only via
//   .maplibregl-compact-show .maplibregl-ctrl-attrib-inner { display: block }
// so the `<details>` element's native disclosure state is overridden and
// does nothing. This code previously set `open = false` in a one-shot
// requestAnimationFrame, which is why the app has been shipping the
// expanded credits strip that the comment above argues against: the
// property it was setting has no bearing on what is drawn.
//
// Removing the class is exactly what MapLibre's own `_updateCompactMinimize`
// does. It has to be re-applied because `_updateCompact` re-adds the class
// on resize, and the control is refreshed as sources come and go, so this
// rides `load`, `styledata` and `resize` rather than firing once. The write
// is idempotent, so firing often costs nothing.
//
// A deliberate click wins — switching basemap must not slam the pill shut
// while someone is reading the credits. Intent is read after the click has
// settled: MapLibre's own `_toggleAttribution` listener runs on the same
// event, so reading the class synchronously would race its registration
// order. A microtask runs once every listener for that click has finished,
// and no map event can interleave, so the class is final by then.
//
// Listening on <summary> rather than the whole control keeps clicks on the
// credit links inside the open panel from being read as a toggle.
export function keepAttributionCollapsed(
  map: maplibregl.Map,
  containerRef: RefObject<HTMLDivElement | null>,
): void {
  const COMPACT_SHOW = 'maplibregl-compact-show';
  let attributionEl: HTMLDetailsElement | null = null;
  let userOpenedAttribution = false;

  const collapseAttribution = () => {
    const el = containerRef.current?.querySelector<HTMLDetailsElement>(
      'details.maplibregl-ctrl-attrib',
    );
    if (!el) return;
    if (el !== attributionEl) {
      // Re-wire rather than assume the first element we saw is still live:
      // MapLibre may rebuild the control, which would strip the listener.
      attributionEl = el;
      userOpenedAttribution = false;
      el.querySelector('summary')?.addEventListener('click', () => {
        queueMicrotask(() => {
          // Opened by the user: leave it alone. Closed by them: default resumes.
          userOpenedAttribution = el.classList.contains(COMPACT_SHOW);
        });
      });
    }
    if (userOpenedAttribution) return;
    el.classList.remove(COMPACT_SHOW);
  };

  map.on('load', collapseAttribution);
  map.on('styledata', collapseAttribution);
  map.on('resize', collapseAttribution);
}
