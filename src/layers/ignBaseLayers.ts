export interface BaseLayer {
  id: string;
  label: string;
  attribution: string;
  maxZoom: number;
  thumbnail: string;
  // Either a raw XYZ template (e.g. OSM) or a WMTS triplet. When `tileUrl`
  // is set, `wmtsLayer`/`tileMatrixSet`/`format` are ignored.
  tileUrl?: string;
  wmtsLayer?: string;
  tileMatrixSet?: string;
  format?: 'image/png' | 'image/jpeg';
}

const GEOPF_WMTS = 'https://data.geopf.fr/wmts';

export function buildWmtsTileUrl(layer: BaseLayer): string {
  if (layer.tileUrl) return layer.tileUrl;
  if (!layer.wmtsLayer || !layer.tileMatrixSet || !layer.format) {
    throw new Error(
      `Base layer "${layer.id}" needs either tileUrl or wmtsLayer/tileMatrixSet/format`,
    );
  }
  const params = new URLSearchParams({
    SERVICE: 'WMTS',
    REQUEST: 'GetTile',
    VERSION: '1.0.0',
    LAYER: layer.wmtsLayer,
    STYLE: 'normal',
    TILEMATRIXSET: layer.tileMatrixSet,
    TILEMATRIX: '{z}',
    TILEROW: '{y}',
    TILECOL: '{x}',
    FORMAT: layer.format,
  });
  return `${GEOPF_WMTS}?${decodeURIComponent(params.toString())}`;
}

const IGN_ATTRIBUTION =
  '© <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a> — <a href="https://geoservices.ign.fr/" target="_blank" rel="noopener">Géoplateforme</a>';

/**
 * Credit for the bundled elevation model. Shown only while a track's
 * altitude actually comes from it — the basemap credit above does not cover
 * RGE ALTI, which is a separate product with its own licence.
 */
export const RGE_ALTI_ATTRIBUTION =
  'Altitude © <a href="https://geoservices.ign.fr/rgealti" target="_blank" rel="noopener">IGN RGE ALTI</a>';

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// OpenTopoMap has two distinct credits: ODbL on the OSM data and CC-BY-SA on
// the rendering. OSM_ATTRIBUTION covers only the first, so this is a separate
// constant rather than a reuse. Keeping it rendered is a licence condition,
// not a presentational choice — see the map-viewer spec.
const OPENTOPO_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, SRTM — ' +
  'rendering © <a href="https://opentopomap.org/" target="_blank" rel="noopener">OpenTopoMap</a> ' +
  '(<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC-BY-SA</a>)';

/** The app's basemap catalogue. */
export const BASE_LAYERS: readonly BaseLayer[] = [
  {
    id: 'opentopo',
    label: 'Topo',
    // Plain XYZ, so this takes buildWmtsTileUrl's `tileUrl` early return.
    // Single host, not the a./b./c. shards: the server is HTTP/2, where
    // sharding defeats connection reuse rather than helping it.
    tileUrl: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: OPENTOPO_ATTRIBUTION,
    // OpenTopoMap renders to zoom 17 and answers z18 with HTTP 200 and a
    // placeholder image reading "max zoom layer = 17" — not a 404. Without
    // this cap MapLibre requests z18 and tiles that text across the map.
    // With it, MapLibre overzooms the z17 tile instead.
    maxZoom: 17,
    thumbnail: 'basemap-thumbs/opentopo.png',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    wmtsLayer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    tileMatrixSet: 'PM_0_19',
    format: 'image/jpeg',
    attribution: IGN_ATTRIBUTION,
    maxZoom: 19,
    thumbnail: 'basemap-thumbs/satellite.png',
  },
  {
    id: 'street',
    label: 'Street',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    thumbnail: 'basemap-thumbs/street.png',
  },
] as const;

export const DEFAULT_BASE_LAYER_ID = 'satellite';
