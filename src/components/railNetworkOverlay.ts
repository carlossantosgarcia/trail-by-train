import type maplibregl from 'maplibre-gl';
import { ensurePmtilesProtocol } from '../lib/pmtilesProtocol';

// Fixed color used for both the parallel rails and the cross-ties.
// The picker UI was removed once the twin-rail + cross-tie geometry
// became expressive enough to carry the "this is a railway" affordance
// on its own. Slate-900 reads cleanly over both Topo and Satellite
// without blooming the way pure black does.
const RAIL_COLOR = '#0f172a';

// Static paint values for the halo line that sits underneath the rail.
const HALO_COLOR = 'rgba(255, 255, 255, 0.65)';
const HALO_WIDTH = 6;
const HALO_BLUR = 0.5;

// Zoom stops shared by every interpolated property. The original v1 of
// this overlay clamped at z14, which left ties + rail-gap stuck at low-
// zoom values past z14. Pinning the last stop at z18 keeps the visual
// proportions correct all the way to MapLibre's effective ceiling for
// the IGN basemaps.
const ZOOM_STOPS = [6, 12, 16, 18] as const;

const RAIL_WIDTH_STOPS = [0.9, 1.2, 1.5, 1.8] as const;
const RAIL_OFFSET_STOPS = [1.4, 2.0, 3.0, 4.0] as const;
const TIE_SIZE_STOPS = [0.7, 1.0, 1.3, 1.6] as const;
const TIE_SPACING_STOPS = [12, 18, 24, 32] as const;

// Tie icons are non-SDF PNGs synthesised from a `WxH` rectangle of
// a given color. The image key encodes its dimensions and color so the
// `styleimagemissing` listener can parse one and regenerate it.
const TIE_W = 9;
const TIE_H = 2;
const TIE_KEY_PATTERN = /^rail-tie-(\d+)x(\d+)-([0-9a-fA-F]{6})$/;

const TIE_KEY = `rail-tie-${TIE_W}x${TIE_H}-${RAIL_COLOR.slice(1).toLowerCase()}`;

function generateTieImage(map: maplibregl.Map, key: string): boolean {
  const m = TIE_KEY_PATTERN.exec(key);
  if (!m) return false;
  const w = Number(m[1]);
  const h = Number(m[2]);
  const fill = `#${m[3]}`;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  if (!ctx) return false;
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  map.addImage(key, data, { pixelRatio: dpr });
  return true;
}

const RAIL_ATTRIBUTION =
  '© <a href="https://ressources.data.sncf.com/explore/dataset/lignes-par-statut/" target="_blank" rel="noopener">SNCF Réseau</a> (ODbL)';

export const RAIL_SOURCE_ID = 'rail-network';
export const RAIL_HALO_LAYER_ID = 'rail-network-halo';
export const RAIL_RAIL_A_LAYER_ID = 'rail-network-rail-a';
export const RAIL_RAIL_B_LAYER_ID = 'rail-network-rail-b';
export const RAIL_TIES_LAYER_ID = 'rail-network-ties';
// Back-compat alias: anything that used to grab "the rails" via
// RAIL_LINE_LAYER_ID still works (it just gets rail-a now).
export const RAIL_LINE_LAYER_ID = RAIL_RAIL_A_LAYER_ID;

const RAIL_LAYER_IDS = [
  RAIL_HALO_LAYER_ID,
  RAIL_RAIL_A_LAYER_ID,
  RAIL_RAIL_B_LAYER_ID,
  RAIL_TIES_LAYER_ID,
] as const;

interface SetupOptions {
  /** Public-path URL to the PMTiles file, e.g. `${BASE_URL}rail.pmtiles`. */
  pmtilesUrl: string;
  /** ID of a layer the rail overlay must sit BELOW (so user overlays stay on top). */
  beforeId?: string;
  /**
   * Initial visibility of the rail layers. Defaults to `true`. Setting this
   * to `false` at creation time avoids a one-frame flash of the overlay
   * when the user's persisted preference is "off".
   */
  initialVisible?: boolean;
}

export function setRailNetworkVisibility(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  for (const id of RAIL_LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value);
    }
  }
}

/**
 * Add the rail-network source and layers to a MapLibre map. Call once per
 * map instance, after `map.on('load', …)` has fired (or from within the
 * load handler). Returns a teardown function that removes the layers and
 * source — call it when the map is being destroyed.
 */
export function setupRailNetworkOverlay(map: maplibregl.Map, options: SetupOptions): () => void {
  ensurePmtilesProtocol();

  if (!map.getSource(RAIL_SOURCE_ID)) {
    map.addSource(RAIL_SOURCE_ID, {
      type: 'vector',
      url: `pmtiles://${options.pmtilesUrl}`,
      attribution: RAIL_ATTRIBUTION,
    });
  }

  const beforeId =
    options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;

  const initialVisibility = options.initialVisible === false ? 'none' : 'visible';

  // Lazily synthesise any tie icon a symbol layer references. The
  // listener stays attached for the lifetime of the overlay so a
  // basemap swap (which wipes the style's image cache) just
  // regenerates the icon on the next render.
  const onMissing = (e: { id: string }) => {
    if (TIE_KEY_PATTERN.test(e.id)) generateTieImage(map, e.id);
  };
  map.on('styleimagemissing', onMissing);

  const railWidth: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    ZOOM_STOPS[0],
    RAIL_WIDTH_STOPS[0],
    ZOOM_STOPS[1],
    RAIL_WIDTH_STOPS[1],
    ZOOM_STOPS[2],
    RAIL_WIDTH_STOPS[2],
    ZOOM_STOPS[3],
    RAIL_WIDTH_STOPS[3],
  ];
  const railOffsetPos: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    ZOOM_STOPS[0],
    RAIL_OFFSET_STOPS[0],
    ZOOM_STOPS[1],
    RAIL_OFFSET_STOPS[1],
    ZOOM_STOPS[2],
    RAIL_OFFSET_STOPS[2],
    ZOOM_STOPS[3],
    RAIL_OFFSET_STOPS[3],
  ];
  const railOffsetNeg: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    ZOOM_STOPS[0],
    -RAIL_OFFSET_STOPS[0],
    ZOOM_STOPS[1],
    -RAIL_OFFSET_STOPS[1],
    ZOOM_STOPS[2],
    -RAIL_OFFSET_STOPS[2],
    ZOOM_STOPS[3],
    -RAIL_OFFSET_STOPS[3],
  ];
  const tieSize: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    ZOOM_STOPS[0],
    TIE_SIZE_STOPS[0],
    ZOOM_STOPS[1],
    TIE_SIZE_STOPS[1],
    ZOOM_STOPS[2],
    TIE_SIZE_STOPS[2],
    ZOOM_STOPS[3],
    TIE_SIZE_STOPS[3],
  ];
  const tieSpacing: maplibregl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    ZOOM_STOPS[0],
    TIE_SPACING_STOPS[0],
    ZOOM_STOPS[1],
    TIE_SPACING_STOPS[1],
    ZOOM_STOPS[2],
    TIE_SPACING_STOPS[2],
    ZOOM_STOPS[3],
    TIE_SPACING_STOPS[3],
  ];

  if (!map.getLayer(RAIL_HALO_LAYER_ID)) {
    map.addLayer(
      {
        id: RAIL_HALO_LAYER_ID,
        type: 'line',
        source: RAIL_SOURCE_ID,
        'source-layer': 'rail',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: initialVisibility,
        },
        paint: {
          'line-color': HALO_COLOR,
          'line-width': HALO_WIDTH,
          'line-blur': HALO_BLUR,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(RAIL_RAIL_A_LAYER_ID)) {
    map.addLayer(
      {
        id: RAIL_RAIL_A_LAYER_ID,
        type: 'line',
        source: RAIL_SOURCE_ID,
        'source-layer': 'rail',
        layout: {
          'line-cap': 'butt',
          'line-join': 'round',
          visibility: initialVisibility,
        },
        paint: {
          'line-color': RAIL_COLOR,
          'line-width': railWidth,
          'line-offset': railOffsetPos,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(RAIL_RAIL_B_LAYER_ID)) {
    map.addLayer(
      {
        id: RAIL_RAIL_B_LAYER_ID,
        type: 'line',
        source: RAIL_SOURCE_ID,
        'source-layer': 'rail',
        layout: {
          'line-cap': 'butt',
          'line-join': 'round',
          visibility: initialVisibility,
        },
        paint: {
          'line-color': RAIL_COLOR,
          'line-width': railWidth,
          'line-offset': railOffsetNeg,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(RAIL_TIES_LAYER_ID)) {
    map.addLayer(
      {
        id: RAIL_TIES_LAYER_ID,
        type: 'symbol',
        source: RAIL_SOURCE_ID,
        'source-layer': 'rail',
        layout: {
          'symbol-placement': 'line',
          'icon-image': TIE_KEY,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': tieSize,
          'symbol-spacing': tieSpacing,
          visibility: initialVisibility,
        },
      },
      beforeId,
    );
  }

  return () => {
    map.off('styleimagemissing', onMissing);
    for (const id of [
      RAIL_TIES_LAYER_ID,
      RAIL_RAIL_B_LAYER_ID,
      RAIL_RAIL_A_LAYER_ID,
      RAIL_HALO_LAYER_ID,
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.hasImage(TIE_KEY)) map.removeImage(TIE_KEY);
    if (map.getSource(RAIL_SOURCE_ID)) map.removeSource(RAIL_SOURCE_ID);
  };
}
