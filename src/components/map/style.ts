// Map constants, layer/source id helpers and the initial style.

import type { StyleSpecification } from 'maplibre-gl';
import {
  BASE_LAYERS,
  DEFAULT_BASE_LAYER_ID,
  buildWmtsTileUrl,
  type BaseLayer,
} from '../../layers/ignBaseLayers';

export const FRANCE_CENTER: [number, number] = [2.5, 46.5];
export const INITIAL_ZOOM = 5.5;
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-5.5, 41],
  [10, 51.5],
];

export const HOVER_SOURCE = 'gpx-hover-marker';
export const HOVER_LAYER = 'gpx-hover-marker-layer';
export const HOVER_HALO_LAYER = 'gpx-hover-marker-halo';
export const HOVER_DEFAULT_COLOUR = '#0f172a';

export function baseSourceId(layer: BaseLayer): string {
  return `ign-${layer.id}`;
}

export function baseLayerId(layer: BaseLayer): string {
  return `ign-${layer.id}-layer`;
}

export function trackSourceId(id: string): string {
  return `gpx-track-${id}`;
}

export function trackHaloLayerId(id: string): string {
  return `gpx-track-${id}-halo`;
}

export function trackLineLayerId(id: string): string {
  return `gpx-track-${id}-line`;
}

export function trackHitLayerId(id: string): string {
  return `gpx-track-${id}-hit`;
}

export function trackEndpointsSourceId(id: string): string {
  return `gpx-track-${id}-endpoints`;
}

export function trackEndpointsLayerId(id: string): string {
  return `gpx-track-${id}-endpoints-layer`;
}

export const GPX_HIT_WIDTH_PX = 12;

export function buildInitialStyle(): StyleSpecification {
  const sources: StyleSpecification['sources'] = {};
  const layers: StyleSpecification['layers'] = [];

  for (const baseLayer of BASE_LAYERS) {
    sources[baseSourceId(baseLayer)] = {
      type: 'raster',
      tiles: [buildWmtsTileUrl(baseLayer)],
      tileSize: 256,
      maxzoom: baseLayer.maxZoom,
      attribution: baseLayer.attribution,
    };
    layers.push({
      id: baseLayerId(baseLayer),
      type: 'raster',
      source: baseSourceId(baseLayer),
      layout: {
        visibility: baseLayer.id === DEFAULT_BASE_LAYER_ID ? 'visible' : 'none',
      },
    });
  }

  return {
    version: 8,
    // Glyphs for symbol layers (station labels) come from the MapLibre
    // demotiles CDN. Tiny per-range PBFs, cached by the browser. See
    // add-rail-stations design.md "Open Questions" for the bundle-vs-CDN
    // decision.
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers,
  };
}
