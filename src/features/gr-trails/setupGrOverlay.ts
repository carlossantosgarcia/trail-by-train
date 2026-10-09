// MapLibre wiring for the GR (Grande Randonnée) trails overlay.
//
// A single PMTiles vector source feeds three layers:
//   - red translucent line (the trail itself)
//   - invisible wide hit layer for click targeting
//   - yellow highlight layer (filtered by selected `ref`, set on click)
//   - symbol layer for repeating `GR XX` labels along the line
//
// We previously tried alternating red+white dashes evoking the painted
// trail blaze, but at low zoom the eye blended them into a pinkish wash,
// and on real-world squiggly trails (switchbacks, ridges) the dash
// boundaries fell unevenly. A single translucent red line reads cleanly
// at every zoom and lets the basemap show through underneath.

import maplibregl from 'maplibre-gl';
import { ensurePmtilesProtocol } from '../../lib/pmtilesProtocol';

export const GR_SOURCE_ID = 'gr-routes';
export const GR_SOURCE_LAYER = 'gr';

export const GR_LINE_LAYER_ID = 'gr-line';
export const GR_HIT_LAYER_ID = 'gr-hit';
export const GR_HIGHLIGHT_LAYER_ID = 'gr-highlight';
export const GR_LABEL_LAYER_ID = 'gr-label';

const GR_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';

const LABEL_MIN_ZOOM = 8;

interface SetupOptions {
  pmtilesUrl: string;
  /** ID of a layer the GR lines must sit BELOW (curated halo, so curated hikes stay on top). */
  beforeLinesId?: string;
  /** ID of a layer GR labels must sit BELOW (typically the hover marker halo). */
  beforeLabelsId?: string;
  initialVisible?: boolean;
}

const ALL_LINE_LAYER_IDS = [GR_LINE_LAYER_ID, GR_HIT_LAYER_ID, GR_HIGHLIGHT_LAYER_ID];

export function setGrVisible(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  for (const id of [...ALL_LINE_LAYER_IDS, GR_LABEL_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value);
  }
  if (!visible) clearGrHighlight(map);
}

export function setGrHighlightRef(map: maplibregl.Map, ref: string | null): void {
  if (!map.getLayer(GR_HIGHLIGHT_LAYER_ID)) return;
  const filter: unknown[] =
    ref === null ? ['==', ['get', 'ref'], '__none__'] : ['==', ['get', 'ref'], ref];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map.setFilter(GR_HIGHLIGHT_LAYER_ID, filter as any);
}

export function clearGrHighlight(map: maplibregl.Map): void {
  setGrHighlightRef(map, null);
}

const LINE_WIDTH = 3;
const LINE_COLOR = '#d62828';
const LINE_OPACITY = 0.7;

export function setupGrOverlay(map: maplibregl.Map, options: SetupOptions): () => void {
  ensurePmtilesProtocol();

  if (!map.getSource(GR_SOURCE_ID)) {
    map.addSource(GR_SOURCE_ID, {
      type: 'vector',
      url: `pmtiles://${options.pmtilesUrl}`,
      attribution: GR_ATTRIBUTION,
    });
  }

  const beforeLines =
    options.beforeLinesId && map.getLayer(options.beforeLinesId)
      ? options.beforeLinesId
      : undefined;
  const beforeLabels =
    options.beforeLabelsId && map.getLayer(options.beforeLabelsId)
      ? options.beforeLabelsId
      : undefined;
  const visibility = options.initialVisible === false ? 'none' : 'visible';

  // Solid translucent red line — the trail itself.
  if (!map.getLayer(GR_LINE_LAYER_ID)) {
    map.addLayer(
      {
        id: GR_LINE_LAYER_ID,
        type: 'line',
        source: GR_SOURCE_ID,
        'source-layer': GR_SOURCE_LAYER,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: {
          'line-color': LINE_COLOR,
          'line-width': LINE_WIDTH,
          'line-opacity': LINE_OPACITY,
        },
      },
      beforeLines,
    );
  }

  // Invisible wide hit layer for click targeting.
  if (!map.getLayer(GR_HIT_LAYER_ID)) {
    map.addLayer(
      {
        id: GR_HIT_LAYER_ID,
        type: 'line',
        source: GR_SOURCE_ID,
        'source-layer': GR_SOURCE_LAYER,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: {
          'line-color': '#000000',
          'line-opacity': 0,
          'line-width': 12,
        },
      },
      beforeLines,
    );
  }

  // Highlight layer — filter to the selected ref (set on click). Defaults
  // to a sentinel that matches nothing so the layer paints empty until
  // something is selected.
  if (!map.getLayer(GR_HIGHLIGHT_LAYER_ID)) {
    map.addLayer(
      {
        id: GR_HIGHLIGHT_LAYER_ID,
        type: 'line',
        source: GR_SOURCE_ID,
        'source-layer': GR_SOURCE_LAYER,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: {
          'line-color': '#ffeb3b',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            3.5,
            10,
            5.5,
            14,
            7.5,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
          'line-opacity': 0.85,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: ['==', ['get', 'ref'], '__none__'] as any,
      },
      beforeLines,
    );
  }

  // Symbol layer for `GR XX` labels along the line.
  if (!map.getLayer(GR_LABEL_LAYER_ID)) {
    map.addLayer(
      {
        id: GR_LABEL_LAYER_ID,
        type: 'symbol',
        source: GR_SOURCE_ID,
        'source-layer': GR_SOURCE_LAYER,
        minzoom: LABEL_MIN_ZOOM,
        layout: {
          'text-field': ['get', 'ref'],
          // The demotiles glyph CDN configured in Map.tsx actually only
          // ships Noto Sans variants (verified by curl on the font
          // endpoint). Other label layers in this repo declare
          // 'Open Sans Regular' fontstacks that are silently 404-ing —
          // they happen to look fine because of MapLibre's fallback
          // behaviour. We explicitly request Noto so the GR labels are
          // not at the mercy of fallbacks.
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'symbol-placement': 'line',
          'symbol-spacing': 250,
          'text-keep-upright': true,
          'text-allow-overlap': false,
          visibility,
        },
        paint: {
          'text-color': '#d62828',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 0.5,
        },
      },
      beforeLabels,
    );
  }

  return () => {
    for (const id of [
      GR_LABEL_LAYER_ID,
      GR_HIGHLIGHT_LAYER_ID,
      GR_HIT_LAYER_ID,
      GR_LINE_LAYER_ID,
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(GR_SOURCE_ID)) map.removeSource(GR_SOURCE_ID);
  };
}
