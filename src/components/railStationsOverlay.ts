import type maplibregl from 'maplibre-gl';

// Station marker: Material Icons "train" pictogram on a 14 px translucent
// rounded-square backplate (75% white, no stroke). To swap to a different glyph in future,
// replace `MATERIAL_TRAIN_PATH` + `drawStationIcon` and bump
// STATION_ICON_KEY so any cached image is invalidated.
export const STATION_ICON_KEY = 'rail-station-icon';
const ICON_BOX = 24;
const ICON_DARK = '#0f172a'; // slate-900
const PLATE_FILL = 'rgba(255,255,255,0.75)';
const PLATE_SIZE = 14;
const PLATE_RADIUS = 2;
const ICON_PAD = 5; // pixels of whitespace inside ICON_BOX around the glyph
const MATERIAL_TRAIN_PATH =
  'M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';

const LABEL_COLOR = '#0f172a'; // slate-900
const LABEL_HALO_COLOR = '#ffffff';
const LABEL_HALO_WIDTH = 1.5;

const ICONS_MINZOOM = 8;
const LABELS_MINZOOM = 10;

// MapLibre demotiles glyph stack — must match the `glyphs` URL on the
// map style.
const LABEL_FONTSTACK = ['Open Sans Regular', 'Arial Unicode MS Regular'];

const SNCF_OPEN_DATA_ATTRIBUTION =
  '© <a href="https://ressources.data.sncf.com/explore/dataset/liste-des-gares/" target="_blank" rel="noopener">SNCF Open Data</a> (ODbL)';

export const STATIONS_SOURCE_ID = 'rail-stations';
export const STATIONS_DOT_LAYER_ID = 'rail-stations-dot';
export const STATIONS_LABEL_LAYER_ID = 'rail-stations-label';

function drawBackplate(ctx: CanvasRenderingContext2D): void {
  const cx = ICON_BOX / 2;
  const cy = ICON_BOX / 2;
  const x = cx - PLATE_SIZE / 2;
  const y = cy - PLATE_SIZE / 2;
  ctx.beginPath();
  ctx.moveTo(x + PLATE_RADIUS, y);
  ctx.arcTo(x + PLATE_SIZE, y, x + PLATE_SIZE, y + PLATE_SIZE, PLATE_RADIUS);
  ctx.arcTo(x + PLATE_SIZE, y + PLATE_SIZE, x, y + PLATE_SIZE, PLATE_RADIUS);
  ctx.arcTo(x, y + PLATE_SIZE, x, y, PLATE_RADIUS);
  ctx.arcTo(x, y, x + PLATE_SIZE, y, PLATE_RADIUS);
  ctx.closePath();
  ctx.fillStyle = PLATE_FILL;
  ctx.fill();
}

function drawStationIcon(ctx: CanvasRenderingContext2D): void {
  drawBackplate(ctx);
  const inner = ICON_BOX - 2 * ICON_PAD;
  const scale = inner / 24; // Material train uses a 24-viewBox SVG
  ctx.save();
  ctx.translate(ICON_PAD, ICON_PAD);
  ctx.scale(scale, scale);
  const path = new Path2D(MATERIAL_TRAIN_PATH);
  ctx.fillStyle = ICON_DARK;
  ctx.fill(path);
  ctx.restore();
}

function ensureStationIcon(map: maplibregl.Map): void {
  if (map.hasImage(STATION_ICON_KEY)) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = Math.round(ICON_BOX * dpr);
  cv.height = Math.round(ICON_BOX * dpr);
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  drawStationIcon(ctx);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  map.addImage(STATION_ICON_KEY, data, { pixelRatio: dpr });
}

interface SetupOptions {
  /** Public-path URL to the stations GeoJSON, e.g. `${BASE_URL}rail-stations.geojson`. */
  dataUrl: string;
  /** ID of a layer the stations layers must sit BELOW (so user overlays stay on top). */
  beforeId?: string;
  /** Initial visibility. Defaults to `true`. */
  initialVisible?: boolean;
}

export function setRailStationsVisibility(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  for (const id of [STATIONS_DOT_LAYER_ID, STATIONS_LABEL_LAYER_ID]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', value);
    }
  }
}

/**
 * Add the rail-stations source and layers (icon + label) to a MapLibre
 * map. Call once per map instance, from within or after `map.on('load')`.
 * Returns a teardown function that removes the layers and source.
 */
export function setupRailStations(map: maplibregl.Map, options: SetupOptions): () => void {
  ensureStationIcon(map);

  if (!map.getSource(STATIONS_SOURCE_ID)) {
    map.addSource(STATIONS_SOURCE_ID, {
      type: 'geojson',
      data: options.dataUrl,
      attribution: SNCF_OPEN_DATA_ATTRIBUTION,
    });
  }

  const beforeId =
    options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;

  const initialVisibility = options.initialVisible === false ? 'none' : 'visible';

  if (!map.getLayer(STATIONS_DOT_LAYER_ID)) {
    map.addLayer(
      {
        id: STATIONS_DOT_LAYER_ID,
        type: 'symbol',
        source: STATIONS_SOURCE_ID,
        minzoom: ICONS_MINZOOM,
        layout: {
          visibility: initialVisibility,
          'icon-image': STATION_ICON_KEY,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': 1,
          'icon-anchor': 'center',
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(STATIONS_LABEL_LAYER_ID)) {
    map.addLayer(
      {
        id: STATIONS_LABEL_LAYER_ID,
        type: 'symbol',
        source: STATIONS_SOURCE_ID,
        minzoom: LABELS_MINZOOM,
        layout: {
          visibility: initialVisibility,
          'text-field': ['get', 'name'],
          'text-font': LABEL_FONTSTACK,
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 13, 12, 16, 13],
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          // text-allow-overlap defaults to false, which is what we want
          // (MapLibre's symbol-collision drops overlapping labels).
        },
        paint: {
          'text-color': LABEL_COLOR,
          'text-halo-color': LABEL_HALO_COLOR,
          'text-halo-width': LABEL_HALO_WIDTH,
        },
      },
      beforeId,
    );
  }

  return () => {
    if (map.getLayer(STATIONS_LABEL_LAYER_ID)) map.removeLayer(STATIONS_LABEL_LAYER_ID);
    if (map.getLayer(STATIONS_DOT_LAYER_ID)) map.removeLayer(STATIONS_DOT_LAYER_ID);
    if (map.getSource(STATIONS_SOURCE_ID)) map.removeSource(STATIONS_SOURCE_ID);
  };
}
