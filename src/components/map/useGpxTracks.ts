import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type maplibregl from 'maplibre-gl';
import type { LngLatBoundsLike } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { RGE_ALTI_ATTRIBUTION } from '../../layers/ignBaseLayers';
import { onZoomToTrack, useGpxStore } from '../../features/gpx/store';
import { loadGeometry } from '../../features/gpx/storage';
import { elevationSourceOf } from '../../features/gpx/types';
import {
  buildEndpointsGeoJSON,
  endpointImageId,
  ensureEndpointImage,
  endpointSymbolLayout,
  endpointSymbolPaint,
  ENDPOINTS_MIN_ZOOM,
} from '../../lib/endpointsLayer';
import { fitPadding } from '../../lib/chromePadding';
import {
  GPX_HIT_WIDTH_PX,
  HOVER_HALO_LAYER,
  HOVER_LAYER,
  HOVER_SOURCE,
  trackEndpointsLayerId,
  trackEndpointsSourceId,
  trackHaloLayerId,
  trackHitLayerId,
  trackLineLayerId,
  trackSourceId,
} from './style';

interface GpxTracksOptions {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  exploreActiveRef: MutableRefObject<boolean>;
  /** Which GPX sources are currently on the map. */
  mountedTrackIds: MutableRefObject<Set<string>>;
  /** Whether each mounted track's source was created with the RGE ALTI credit. */
  mountedTerrainAttr: MutableRefObject<Record<string, boolean>>;
  /** Geometry hydration promises, so rerenders don't double-load. */
  geometryFetches: MutableRefObject<Partial<Record<string, Promise<void>>>>;
}

/** The user's GPX tracks on the map, the elevation-chart hover marker, and zoom-to-track. */
export function useGpxTracks({
  mapRef,
  exploreActiveRef,
  mountedTrackIds,
  mountedTerrainAttr,
  geometryFetches,
}: GpxTracksOptions): void {
  const tracks = useGpxStore((s) => s.tracks);
  const hoveredSample = useGpxStore((s) => s.hoveredSample);

  // ---- Sync track overlays.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      if (exploreActiveRef.current) return;
      const currentIds = new Set(tracks.map((t) => t.id));

      // A source's attribution is fixed at creation, so a track whose
      // altitude only *becomes* terrain-derived (enrichment finishes after
      // it is already on the map) has to be torn down and re-added for the
      // RGE ALTI credit to appear. Licence text has to be right, not
      // eventually right.
      const staleAttribution = new Set<string>();
      for (const track of tracks) {
        if (!mountedTrackIds.current.has(track.id)) continue;
        const wants = elevationSourceOf(track.summary) === 'terrain';
        if (wants !== (mountedTerrainAttr.current[track.id] ?? false)) {
          staleAttribution.add(track.id);
        }
      }

      // Remove tracks no longer in the store, or needing a fresh source.
      for (const id of Array.from(mountedTrackIds.current)) {
        if (currentIds.has(id) && !staleAttribution.has(id)) continue;
        const line = trackLineLayerId(id);
        const halo = trackHaloLayerId(id);
        const hit = trackHitLayerId(id);
        const endpointsLayer = trackEndpointsLayerId(id);
        const endpointsSrc = trackEndpointsSourceId(id);
        if (map.getLayer(endpointsLayer)) map.removeLayer(endpointsLayer);
        if (map.getLayer(hit)) map.removeLayer(hit);
        if (map.getLayer(line)) map.removeLayer(line);
        if (map.getLayer(halo)) map.removeLayer(halo);
        if (map.getSource(endpointsSrc)) map.removeSource(endpointsSrc);
        const src = trackSourceId(id);
        if (map.getSource(src)) map.removeSource(src);
        mountedTrackIds.current.delete(id);
        delete mountedTerrainAttr.current[id];
        delete geometryFetches.current[id];
      }

      // Add or update tracks currently in the store.
      for (const track of tracks) {
        const srcId = trackSourceId(track.id);
        const haloId = trackHaloLayerId(track.id);
        const lineId = trackLineLayerId(track.id);
        const hitId = trackHitLayerId(track.id);
        const endpointsSrcId = trackEndpointsSourceId(track.id);
        const endpointsLayerId = trackEndpointsLayerId(track.id);

        if (!mountedTrackIds.current.has(track.id)) {
          if (geometryFetches.current[track.id]) continue;
          const p = (async () => {
            const geojson = await loadGeometry(track.id);
            if (!geojson || !mapRef.current) return;
            // Re-check in case state changed during await.
            if (!mapRef.current.getSource(srcId)) {
              const usesTerrain = elevationSourceOf(track.summary) === 'terrain';
              mountedTerrainAttr.current[track.id] = usesTerrain;
              mapRef.current.addSource(srcId, {
                type: 'geojson',
                data: geojson,
                ...(usesTerrain ? { attribution: RGE_ALTI_ATTRIBUTION } : {}),
              });
              mapRef.current.addLayer({
                id: haloId,
                type: 'line',
                source: srcId,
                layout: {
                  'line-cap': 'round',
                  'line-join': 'round',
                  visibility: track.visible ? 'visible' : 'none',
                },
                paint: {
                  'line-color': '#ffffff',
                  'line-width': 6,
                  'line-opacity': 0.85,
                },
              });
              mapRef.current.addLayer({
                id: lineId,
                type: 'line',
                source: srcId,
                layout: {
                  'line-cap': 'round',
                  'line-join': 'round',
                  visibility: track.visible ? 'visible' : 'none',
                },
                paint: {
                  'line-color': track.colour,
                  'line-width': 4,
                  'line-opacity': 0.95,
                },
              });
              // Invisible hit layer above the visible line — widens the
              // pointer target so the user can hover/click within ~6px of
              // the track. Cursor change is registered below.
              mapRef.current.addLayer({
                id: hitId,
                type: 'line',
                source: srcId,
                layout: {
                  'line-cap': 'round',
                  'line-join': 'round',
                  visibility: track.visible ? 'visible' : 'none',
                },
                paint: {
                  'line-color': '#000000',
                  'line-width': GPX_HIT_WIDTH_PX,
                  'line-opacity': 0,
                },
              });
              // A/B endpoint markers — derive a single combined geometry
              // from all LineString features (first coord of the first
              // feature, last coord of the last feature) and feed the
              // shared helper.
              const lineFeats = geojson.features.filter((f) => f.geometry?.type === 'LineString');
              if (lineFeats.length > 0) {
                const firstFeat = lineFeats[0].geometry as LineString;
                const lastFeat = lineFeats[lineFeats.length - 1].geometry as LineString;
                const combined: LineString = {
                  type: 'LineString',
                  coordinates: [
                    ...(firstFeat.coordinates.length > 0 ? [firstFeat.coordinates[0]] : []),
                    ...(lastFeat.coordinates.length > 0
                      ? [lastFeat.coordinates[lastFeat.coordinates.length - 1]]
                      : []),
                  ],
                };
                const endpointsData = buildEndpointsGeoJSON(combined, track.colour, track.id);
                if (endpointsData.features.length > 0) {
                  try {
                    ensureEndpointImage(mapRef.current, track.colour);
                    mapRef.current.addSource(endpointsSrcId, {
                      type: 'geojson',
                      data: endpointsData,
                    });
                    const epLayout = endpointSymbolLayout(
                      endpointImageId(track.colour),
                      track.visible ? 'visible' : 'none',
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ) as any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const epPaint = endpointSymbolPaint() as any;
                    mapRef.current.addLayer({
                      id: endpointsLayerId,
                      type: 'symbol',
                      source: endpointsSrcId,
                      minzoom: ENDPOINTS_MIN_ZOOM,
                      layout: epLayout,
                      paint: epPaint,
                    });
                  } catch {
                    // Defensive: never let an endpoint-layer failure
                    // break the rest of the per-track mount path.
                  }
                }
              }
              const m = mapRef.current;
              const onEnter = () => (m.getCanvas().style.cursor = 'pointer');
              const onLeave = () => (m.getCanvas().style.cursor = '');
              m.on('mouseenter', hitId, onEnter);
              m.on('mouseleave', hitId, onLeave);
              // Keep hover halo + inner dot on top (halo first so it
              // renders below the inner dot).
              if (mapRef.current.getLayer(HOVER_HALO_LAYER)) {
                mapRef.current.moveLayer(HOVER_HALO_LAYER);
              }
              if (mapRef.current.getLayer(HOVER_LAYER)) {
                mapRef.current.moveLayer(HOVER_LAYER);
              }
              mountedTrackIds.current.add(track.id);
            }
          })();
          geometryFetches.current[track.id] = p;
          continue;
        }

        // Already mounted: keep paint and visibility in sync.
        if (map.getLayer(lineId)) {
          map.setPaintProperty(lineId, 'line-color', track.colour);
          map.setLayoutProperty(lineId, 'visibility', track.visible ? 'visible' : 'none');
        }
        if (map.getLayer(haloId)) {
          map.setLayoutProperty(haloId, 'visibility', track.visible ? 'visible' : 'none');
        }
        if (map.getLayer(hitId)) {
          map.setLayoutProperty(hitId, 'visibility', track.visible ? 'visible' : 'none');
        }
        if (map.getLayer(endpointsLayerId)) {
          // Order matters: register the new colour's image BEFORE swapping
          // icon-image so the marker never paints with a stale colour.
          ensureEndpointImage(map, track.colour);
          map.setLayoutProperty(endpointsLayerId, 'icon-image', endpointImageId(track.colour));
          map.setLayoutProperty(endpointsLayerId, 'visibility', track.visible ? 'visible' : 'none');
        }
      }
    };

    // Same reasoning as the basemap effect: do not gate on isStyleLoaded()
    // and never queue on `once('load', ...)` from outside the mount path.
    // For initial mount (style still parsing), retry on the next styledata.
    const ranOK = (() => {
      try {
        sync();
        return true;
      } catch {
        return false;
      }
    })();
    if (ranOK) return;
    const onStyledata = () => {
      try {
        sync();
        map.off('styledata', onStyledata);
      } catch {
        /* keep waiting */
      }
    };
    map.on('styledata', onStyledata);
    return () => {
      map.off('styledata', onStyledata);
    };
  }, [exploreActiveRef, geometryFetches, mapRef, mountedTerrainAttr, mountedTrackIds, tracks]);

  // ---- Hover marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(HOVER_SOURCE);
      if (!src || src.type !== 'geojson') return;
      const data: FeatureCollection<LineString | { type: 'Point'; coordinates: [number, number] }> =
        hoveredSample
          ? {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { trackColour: hoveredSample.trackColour },
                  geometry: { type: 'Point', coordinates: hoveredSample.coord } as never,
                },
              ],
            }
          : { type: 'FeatureCollection', features: [] };
      (src as maplibregl.GeoJSONSource).setData(data as never);
    };
    // Try now; if the hover source doesn't exist yet (very early mount),
    // wait for it via styledata rather than once('load', …).
    apply();
    const src = map.getSource(HOVER_SOURCE);
    if (src) return;
    const onStyledata = () => {
      if (map.getSource(HOVER_SOURCE)) {
        apply();
        map.off('styledata', onStyledata);
      }
    };
    map.on('styledata', onStyledata);
    return () => {
      map.off('styledata', onStyledata);
    };
  }, [mapRef, hoveredSample]);

  // ---- Zoom-to-track listener.
  useEffect(() => {
    return onZoomToTrack((bbox) => {
      const map = mapRef.current;
      if (!map) return;
      const bounds: LngLatBoundsLike = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ];
      // Padding comes from the chrome geometry so a framed feature never
      // lands under the docks or the mobile sheet.
      map.fitBounds(bounds, { padding: fitPadding(), duration: 600 });
    });
  }, [mapRef]);
}
