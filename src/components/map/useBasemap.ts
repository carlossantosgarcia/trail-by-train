import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import { BASE_LAYERS } from '../../layers/ignBaseLayers';
import { applyWhenReady } from './applyWhenReady';
import { baseLayerId } from './style';

/** Show the active basemap, hide the others. */
export function useBasemap(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  activeLayerId: string,
): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return applyWhenReady(map, () => {
      let allPresent = true;
      for (const baseLayer of BASE_LAYERS) {
        const id = baseLayerId(baseLayer);
        if (!map.getLayer(id)) {
          allPresent = false;
          continue;
        }
        map.setLayoutProperty(
          id,
          'visibility',
          baseLayer.id === activeLayerId ? 'visible' : 'none',
        );
      }
      return allPresent;
    });
  }, [mapRef, activeLayerId]);
}
