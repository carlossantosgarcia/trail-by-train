// MapLibre wiring for the curated-hikes overlay.
//
// Every hike is shown as places — a coloured pin at the start for low zooms,
// A/B endpoint markers once zoomed in, a sleep marker per night — and, when
// its author has licensed the route (`hike.track`), as a line too. One
// GeoJSON source is synthesised from the manifest plus those GPX files.

import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { parseGpxDocument } from '../gpx/parseCore.mjs';
import { loadManifest } from './manifest';
import { setSelected } from './store';
import { sleepMarkerImage } from './sleepMarkerImage';
import type { CuratedManifest } from './types';
import {
  buildEndpointsGeoJSON,
  endpointImageId,
  ensureEndpointImage,
  endpointSymbolLayout,
  endpointSymbolPaint,
  ENDPOINTS_MIN_ZOOM,
} from '../../lib/endpointsLayer';

const CURATED_FALLBACK_COLOR = '#2E7D32';
const PIN_RADIUS = 6;
// Sleep markers are only meaningful when the user is zoomed in enough to
// tell one night's stop from the next; below this they crowd the map.
const SLEEP_LAYER_MINZOOM = 9;

export const CURATED_SOURCE_ID = 'curated-hikes';
/** Start pins — the overlay's click target below ENDPOINTS_MIN_ZOOM, and the
 *  bottom-most curated layer (other overlays anchor beneath it). */
export const CURATED_HIT_LAYER_ID = 'curated-hikes-pin';
export const CURATED_SLEEP_LAYER_ID = 'curated-hikes-sleep';
export const CURATED_SLEEP_IMAGE_ID = 'curated-sleep-marker';
export const CURATED_ENDPOINTS_LAYER_ID = 'curated-hikes-endpoints';
export const CURATED_TRACK_LAYER_ID = 'curated-hikes-track';
/** Bottom-most curated layer: overlays that must stay beneath curated hikes anchor here. */
export const CURATED_TRACK_HALO_LAYER_ID = 'curated-hikes-track-halo';

const KIND_IS_PIN: unknown[] = ['==', ['get', 'kind'], 'pin'];
const KIND_IS_SLEEP: unknown[] = ['==', ['get', 'kind'], 'sleep'];
const KIND_IS_ENDPOINT: unknown[] = ['==', ['get', 'kind'], 'endpoint'];
const KIND_IS_TRACK: unknown[] = ['==', ['get', 'kind'], 'track'];

interface SetupOptions {
  /** ID of a layer the curated overlay must sit BELOW (user GPX stays on top). */
  beforeId?: string;
  /** Initial visibility — avoid an on→off flash when persisted state is "off". */
  initialVisible?: boolean;
  /** Initial visible-id set — same flash-avoidance for the filter. */
  initialVisibleIds?: string[] | 'all';
}

function withIds(kind: unknown[], ids: string[] | 'all'): unknown[] {
  if (ids === 'all') return kind;
  return ['all', kind, ['in', ['get', 'id'], ['literal', ids]]];
}

const LAYERS: { id: string; kind: unknown[] }[] = [
  { id: CURATED_TRACK_HALO_LAYER_ID, kind: KIND_IS_TRACK },
  { id: CURATED_TRACK_LAYER_ID, kind: KIND_IS_TRACK },
  { id: CURATED_HIT_LAYER_ID, kind: KIND_IS_PIN },
  { id: CURATED_ENDPOINTS_LAYER_ID, kind: KIND_IS_ENDPOINT },
  { id: CURATED_SLEEP_LAYER_ID, kind: KIND_IS_SLEEP },
];

export function setCuratedHikesVisibility(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  for (const { id } of LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value);
  }
}

export function setCuratedHikesVisibleIds(map: maplibregl.Map, ids: string[] | 'all'): void {
  for (const { id, kind } of LAYERS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (map.getLayer(id)) map.setFilter(id, withIds(kind, ids) as any);
  }
}

/** Point features for every hike: start pin, A/B endpoints, one per night. */
function buildFeatures(manifest: CuratedManifest): Feature<Point>[] {
  const out: Feature<Point>[] = [];
  for (const hike of manifest.hikes) {
    const color = hike.colour ?? CURATED_FALLBACK_COLOR;
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: hike.start },
      properties: { kind: 'pin', id: hike.id, colour: color },
    });
    const eps = buildEndpointsGeoJSON(
      { type: 'LineString', coordinates: [hike.start, hike.end] },
      color,
      hike.id,
    );
    for (const ep of eps.features) {
      out.push({
        ...ep,
        properties: { ...ep.properties, iconImage: endpointImageId(color), id: hike.id },
      });
    }
    for (const day of hike.days) {
      if (!day.sleep) continue;
      out.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: day.sleep.coord },
        properties: {
          kind: 'sleep',
          id: hike.id,
          dayIndex: day.dayIndex,
          ...(day.sleep.name ? { name: day.sleep.name } : {}),
        },
      });
    }
  }
  return out;
}

/** Line features for the hikes whose author licensed the route. */
async function loadTracks(manifest: CuratedManifest): Promise<Feature<LineString>[]> {
  const withTrack = manifest.hikes.filter((h) => h.track);
  const parsed = await Promise.all(
    withTrack.map(async (hike) => {
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}${hike.track!.gpx}`);
        if (!resp.ok) return [];
        const doc = new DOMParser().parseFromString(await resp.text(), 'application/xml');
        const { geojson } = parseGpxDocument(doc, hike.track!.gpx);
        return geojson.features.map(
          (f): Feature<LineString> => ({
            type: 'Feature',
            geometry: f.geometry,
            properties: {
              kind: 'track',
              id: hike.id,
              colour: hike.colour ?? CURATED_FALLBACK_COLOR,
            },
          }),
        );
      } catch {
        // One unreadable track must not cost the other hikes their lines.
        return [];
      }
    }),
  );
  return parsed.flat();
}

export function setupCuratedHikesOverlay(map: maplibregl.Map, options: SetupOptions): () => void {
  const beforeId =
    options.beforeId && map.getLayer(options.beforeId) ? options.beforeId : undefined;
  const visibility = options.initialVisible === false ? 'none' : 'visible';
  const ids = options.initialVisibleIds ?? 'all';

  if (!map.getSource(CURATED_SOURCE_ID)) {
    map.addSource(CURATED_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    // Fill the source once the manifest arrives. The endpoints layer is
    // added only after every colour's marker image is registered, so its
    // first paint is never missing icons.
    void (async () => {
      try {
        const manifest = await loadManifest();
        for (const hike of manifest.hikes) {
          ensureEndpointImage(map, hike.colour ?? CURATED_FALLBACK_COLOR);
        }
        const tracks = await loadTracks(manifest);
        const src = map.getSource(CURATED_SOURCE_ID);
        if (src && src.type === 'geojson') {
          const fc: FeatureCollection = {
            type: 'FeatureCollection',
            features: [...tracks, ...buildFeatures(manifest)],
          };
          (src as maplibregl.GeoJSONSource).setData(fc as never);
        }
        if (!map.getLayer(CURATED_ENDPOINTS_LAYER_ID)) {
          map.addLayer(
            {
              id: CURATED_ENDPOINTS_LAYER_ID,
              type: 'symbol',
              source: CURATED_SOURCE_ID,
              minzoom: ENDPOINTS_MIN_ZOOM,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              layout: endpointSymbolLayout(['get', 'iconImage'] as any, visibility) as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              paint: endpointSymbolPaint() as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              filter: withIds(KIND_IS_ENDPOINT, options.initialVisibleIds ?? 'all') as any,
            },
            map.getLayer(CURATED_SLEEP_LAYER_ID) ? CURATED_SLEEP_LAYER_ID : beforeId,
          );
          map.on('click', CURATED_ENDPOINTS_LAYER_ID, onClick);
          map.on('mouseenter', CURATED_ENDPOINTS_LAYER_ID, onEnter);
          map.on('mouseleave', CURATED_ENDPOINTS_LAYER_ID, onLeave);
        }
      } catch {
        // Best-effort: if the manifest fails to load the source stays empty
        // and the overlay renders nothing. App.tsx reports the failure.
      }
    })();
  }

  // Register the sleep marker bitmap once per map. If it's already
  // registered (e.g. style reload) skip; if rasterisation fails we leave
  // it unregistered and the symbol layer falls back to a circle below.
  let sleepImageRegistered = map.hasImage(CURATED_SLEEP_IMAGE_ID);
  if (!sleepImageRegistered) {
    try {
      const img = sleepMarkerImage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addImage(CURATED_SLEEP_IMAGE_ID, img as any, { pixelRatio: 2 });
      sleepImageRegistered = true;
    } catch {
      // Best-effort — keep going without an icon; layer falls back.
      sleepImageRegistered = false;
    }
  }

  const initialSleepFilter = withIds(KIND_IS_SLEEP, ids);

  // Licensed routes: a white halo for contrast on any basemap, then the
  // hike's colour. Added first so they sit beneath every curated marker.
  if (!map.getLayer(CURATED_TRACK_HALO_LAYER_ID)) {
    map.addLayer(
      {
        id: CURATED_TRACK_HALO_LAYER_ID,
        type: 'line',
        source: CURATED_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: { 'line-color': 'rgba(255, 255, 255, 0.6)', 'line-width': 6 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: withIds(KIND_IS_TRACK, ids) as any,
      },
      beforeId,
    );
  }
  if (!map.getLayer(CURATED_TRACK_LAYER_ID)) {
    map.addLayer(
      {
        id: CURATED_TRACK_LAYER_ID,
        type: 'line',
        source: CURATED_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'line-color': ['coalesce', ['get', 'colour'], CURATED_FALLBACK_COLOR] as any,
          'line-width': 3,
          'line-opacity': 0.85,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: withIds(KIND_IS_TRACK, ids) as any,
      },
      beforeId,
    );
  }

  // Start pins stand in for the hike until ENDPOINTS_MIN_ZOOM, where the
  // A/B markers take over and say more.
  if (!map.getLayer(CURATED_HIT_LAYER_ID)) {
    map.addLayer(
      {
        id: CURATED_HIT_LAYER_ID,
        type: 'circle',
        source: CURATED_SOURCE_ID,
        maxzoom: ENDPOINTS_MIN_ZOOM,
        layout: { visibility },
        paint: {
          'circle-radius': PIN_RADIUS,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'circle-color': ['coalesce', ['get', 'colour'], CURATED_FALLBACK_COLOR] as any,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: withIds(KIND_IS_PIN, ids) as any,
      },
      beforeId,
    );
  }

  // Click handler: set selectedId; clicks on the empty map (handled
  // elsewhere) clear it.
  function onClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
    const feat = e.features?.[0];
    const id = feat?.properties?.id;
    if (typeof id === 'string' && id.length > 0) {
      setSelected(id, [e.lngLat.lng, e.lngLat.lat]);
    }
  }
  function onEnter() {
    map.getCanvas().style.cursor = 'pointer';
  }
  function onLeave() {
    map.getCanvas().style.cursor = '';
  }
  for (const layer of [CURATED_HIT_LAYER_ID, CURATED_TRACK_HALO_LAYER_ID]) {
    map.on('click', layer, onClick);
    map.on('mouseenter', layer, onEnter);
    map.on('mouseleave', layer, onLeave);
  }

  // Sleep marker symbol layer — sits above the pins (placed without a
  // beforeId among the curated layers, but still BELOW options.beforeId if
  // any). When the image registration
  // failed we render a small circle so the user still sees a marker.
  if (!map.getLayer(CURATED_SLEEP_LAYER_ID)) {
    if (sleepImageRegistered) {
      map.addLayer(
        {
          id: CURATED_SLEEP_LAYER_ID,
          type: 'symbol',
          source: CURATED_SOURCE_ID,
          minzoom: SLEEP_LAYER_MINZOOM,
          layout: {
            'icon-image': CURATED_SLEEP_IMAGE_ID,
            'icon-size': 1,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            visibility,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: initialSleepFilter as any,
        },
        beforeId,
      );
    } else {
      // Fallback: small filled circle with a white halo.
      map.addLayer(
        {
          id: CURATED_SLEEP_LAYER_ID,
          type: 'circle',
          source: CURATED_SOURCE_ID,
          minzoom: SLEEP_LAYER_MINZOOM,
          layout: { visibility },
          paint: {
            'circle-radius': 5,
            'circle-color': '#1f2937',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filter: initialSleepFilter as any,
        },
        beforeId,
      );
    }
  }

  // Sleep marker hover: tooltip with the night's name (or a fallback
  // J<n>→J<n+1>) and a pointer cursor.
  let sleepPopup: maplibregl.Popup | null = null;

  const onSleepEnter = (
    e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) => {
    const feat = e.features?.[0];
    if (!feat) return;
    map.getCanvas().style.cursor = 'pointer';
    const props = feat.properties ?? {};
    const day = Number(props.dayIndex);
    const labelFallback = Number.isFinite(day) ? `Étape J${day} → J${day + 1}` : 'Étape';
    const label =
      typeof props.name === 'string' && props.name.length > 0 ? props.name : labelFallback;
    if (sleepPopup) sleepPopup.remove();
    sleepPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      anchor: 'bottom',
      className: 'curated-sleep-tooltip',
    })
      .setLngLat((feat.geometry as unknown as { coordinates: [number, number] }).coordinates)
      .setText(label)
      .addTo(map);
  };
  const onSleepLeave = () => {
    map.getCanvas().style.cursor = '';
    if (sleepPopup) {
      sleepPopup.remove();
      sleepPopup = null;
    }
  };
  map.on('mouseenter', CURATED_SLEEP_LAYER_ID, onSleepEnter);
  map.on('mouseleave', CURATED_SLEEP_LAYER_ID, onSleepLeave);

  return () => {
    try {
      for (const layer of [
        CURATED_HIT_LAYER_ID,
        CURATED_TRACK_HALO_LAYER_ID,
        CURATED_ENDPOINTS_LAYER_ID,
      ]) {
        map.off('click', layer, onClick);
        map.off('mouseenter', layer, onEnter);
        map.off('mouseleave', layer, onLeave);
      }
      map.off('mouseenter', CURATED_SLEEP_LAYER_ID, onSleepEnter);
      map.off('mouseleave', CURATED_SLEEP_LAYER_ID, onSleepLeave);
    } catch {
      /* map may already be torn down */
    }
    if (sleepPopup) {
      try {
        sleepPopup.remove();
      } catch {
        /* ignore */
      }
      sleepPopup = null;
    }
    for (const id of [
      CURATED_ENDPOINTS_LAYER_ID,
      CURATED_SLEEP_LAYER_ID,
      CURATED_HIT_LAYER_ID,
      CURATED_TRACK_LAYER_ID,
      CURATED_TRACK_HALO_LAYER_ID,
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.hasImage(CURATED_SLEEP_IMAGE_ID)) {
      try {
        map.removeImage(CURATED_SLEEP_IMAGE_ID);
      } catch {
        /* ignore */
      }
    }
    if (map.getSource(CURATED_SOURCE_ID)) map.removeSource(CURATED_SOURCE_ID);
  };
}
