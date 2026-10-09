import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import { setSelected as setSelectedHike } from '../../features/curated-hikes';
import { setGrHighlightRef } from '../../features/gr-trails';
import type { SearchRevealDetail } from '../../features/search';
import { setTransitHighlight } from '../../transit/highlightStore';
import { fitPadding } from '../../lib/chromePadding';

export function useSearchReveal(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  mapInstance: maplibregl.Map | null,
  mountTransitProviderRef: MutableRefObject<((providerId: string) => void) | null>,
): void {
  // ---- Search: frame and reveal an extent result (a bus line, a curated
  // hike, a GR). Points never come through here — they open the Explore
  // radius panel instead, which is what the shape distinction is for.
  //
  // App.tsx handles the same event to switch the owning layer on. This half
  // does the map work: frame the extent from the index's own bbox (authoritative
  // and available immediately, unlike querying tiles that may not be loaded),
  // then apply the per-kind emphasis.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onReveal = (e: Event) => {
      const d = (e as CustomEvent<SearchRevealDetail>).detail;
      const [minLon, minLat, maxLon, maxLat] = d.bbox;
      map.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: fitPadding(), maxZoom: 14, duration: 600 },
      );
      if (d.kind === 'bus' && d.extra) {
        // Mount here rather than waiting on App's visibility effect: the
        // highlight store only paints providers that are already mounted, so
        // a first-time reveal would otherwise land on nothing.
        mountTransitProviderRef.current?.(d.extra);
        setTransitHighlight({ providerId: d.extra, routeId: d.id });
      } else if (d.kind === 'rando') {
        // Anchor the info box at the centre of the hike's own bbox.
        setSelectedHike(d.id, [(minLon + maxLon) / 2, (minLat + maxLat) / 2]);
      } else if (d.kind === 'gr') {
        setGrHighlightRef(map, d.id);
      }
    };
    window.addEventListener('search:reveal', onReveal);
    return () => window.removeEventListener('search:reveal', onReveal);
  }, [mapRef, mountTransitProviderRef, mapInstance]);
}
