import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { setupRailNetworkOverlay } from './railNetworkOverlay';
import { setupRailStations } from './railStationsOverlay';
import {
  setupCuratedHikesOverlay,
  useCuratedStore,
  CURATED_TRACK_HALO_LAYER_ID,
} from '../features/curated-hikes';
import HikePopup from '../features/curated-hikes/HikePopup';
import { setupGrOverlay } from '../features/gr-trails';
import ZoomLevelReadout from './ZoomLevelReadout';
import { TRANSIT_PROVIDERS, type DayFilter } from '../transit';
import TransitPopup from '../transit/TransitPopup';
import { useExplore } from '../features/explore';
import {
  FRANCE_CENTER,
  HOVER_DEFAULT_COLOUR,
  HOVER_HALO_LAYER,
  HOVER_LAYER,
  HOVER_SOURCE,
  INITIAL_ZOOM,
  MAX_BOUNDS,
  buildInitialStyle,
} from './map/style';
import { keepAttributionCollapsed } from './map/attribution';
import { attachGrInteractions } from './map/grInteractions';
import { attachOpenLineListener, createTransitMounter } from './map/transitInteractions';
import { useBasemap } from './map/useBasemap';
import {
  useCuratedFilter,
  useCuratedVisibility,
  useGrVisibility,
  useRailVisibility,
  useStationsVisibility,
} from './map/useOverlayVisibility';
import { useTransitLayers } from './map/useTransitLayers';
import { useGpxTracks } from './map/useGpxTracks';
import { useExploreMap } from './map/useExploreMap';
import { useSearchReveal } from './map/useSearchReveal';

// The map component owns the MapLibre instance and the order in which layers
// are added on `load` (which decides what draws on top of what). Everything
// that reacts to app state afterwards lives in ./map/ as one hook per concern,
// called below in a fixed order.

interface MapProps {
  activeLayerId: string;
  railVisible: boolean;
  curatedVisible: boolean;
  grVisible: boolean;
  transitVisible: Record<string, boolean>;
  dayFilter: DayFilter;
  hideLowFreq: boolean;
  showArchived: boolean;
  providerColors: Record<string, string | null>;
  stationsVisible: boolean;
}

export default function Map({
  activeLayerId,
  railVisible,
  curatedVisible,
  grVisible,
  transitVisible,
  dayFilter,
  hideLowFreq,
  showArchived,
  providerColors,
  stationsVisible,
}: MapProps) {
  // Capture the latest railVisible in a ref so the one-shot map `load`
  // handler can read the live value without being re-bound (the mount
  // effect intentionally runs once).
  const railVisibleRef = useRef(railVisible);
  railVisibleRef.current = railVisible;
  const curatedVisibleRef = useRef(curatedVisible);
  curatedVisibleRef.current = curatedVisible;
  const grVisibleRef = useRef(grVisible);
  grVisibleRef.current = grVisible;
  const transitVisibleRef = useRef(transitVisible);
  transitVisibleRef.current = transitVisible;
  const dayFilterRef = useRef(dayFilter);
  dayFilterRef.current = dayFilter;
  const hideLowFreqRef = useRef(hideLowFreq);
  hideLowFreqRef.current = hideLowFreq;
  const showArchivedRef = useRef(showArchived);
  showArchivedRef.current = showArchived;
  const providerColorsRef = useRef(providerColors);
  providerColorsRef.current = providerColors;
  const stationsVisibleRef = useRef(stationsVisible);
  stationsVisibleRef.current = stationsVisible;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const curatedFilter = useCuratedStore((s) => s.filter);
  const curatedManifest = useCuratedStore((s) => s.manifest);
  // Track which GPX sources are currently on the map.
  const mountedTrackIds = useRef<Set<string>>(new Set<string>());
  /** Whether each mounted track's source was created with the RGE ALTI credit. */
  // Plain record, not a Map: this component is itself named `Map`, which
  // shadows the global constructor.
  const mountedTerrainAttr = useRef<Record<string, boolean>>({});
  // Cache geometry hydration promises so we don't double-load on rerenders.
  // Plain record (not a Map) to avoid name-shadowing with this component.
  const geometryFetches = useRef<Partial<Record<string, Promise<void>>>>({});
  // Lazy transit mount: only providers whose toggle is on at startup (or
  // toggled on later) get a MapLibre source + click handlers. This keeps
  // first-paint payload small as the provider list grows.
  const mountedTransitIds = useRef<Set<string>>(new Set<string>());
  const mountTransitProviderRef = useRef<((providerId: string) => void) | null>(null);

  // Explore mode (draw-a-region). Drives the lasso capture, the matched-line
  // render, and the map-focus events below.
  const explore = useExplore();
  // While Explore owns the map it hides overlays and route-filters the transit
  // lines. The normal overlay effects below re-assert themselves on every
  // `styledata` tick — and Explore's own layer edits fire styledata — so they
  // would clobber Explore's render (resetting line filters, re-showing hidden
  // overlays). This ref lets each of those effects short-circuit while a
  // region is active. Read live (it's a ref) so no re-subscribe is needed.
  const exploreActiveRef = useRef(explore.active);
  exploreActiveRef.current = explore.active;

  // ---- Mount/unmount the map instance.
  useEffect(() => {
    if (!containerRef.current) return;

    // Always render the attribution as MapLibre's compact ⓘ pill on every
    // viewport — the inline form eats too much bottom-edge real estate
    // and obscures the map; the ⓘ button still reveals the full
    // copyright when clicked / hovered.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildInitialStyle(),
      center: FRANCE_CENTER,
      zoom: INITIAL_ZOOM,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true },
    });
    // Metric scale bar. Bottom-left, tucked just under the zoom-level
    // readout (which is lifted to make room — see styles.css /
    // ZoomLevelReadout.module.css). Display-only; styled in styles.css and
    // made pointer-transparent there. Removed automatically by map.remove()
    // on teardown.
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 100 }), 'bottom-left');
    keepAttributionCollapsed(map, containerRef);
    mapRef.current = map;
    setMapInstance(map);
    let teardownRail: (() => void) | null = null;
    let teardownStations: (() => void) | null = null;
    let teardownCurated: (() => void) | null = null;
    let teardownGr: (() => void) | null = null;
    const teardownTransit: Array<() => void> = [];
    const offEventListeners: Array<() => void> = [];

    map.on('load', () => {
      map.addSource(HOVER_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // Halo first so the inner dot renders above it. Track-coloured
      // halo + track-coloured inner dot (with a thick white stroke)
      // make the marker unmissable and visually distinct from the
      // monochrome rail-station dots (white fill, thin slate stroke).
      map.addLayer({
        id: HOVER_HALO_LAYER,
        type: 'circle',
        source: HOVER_SOURCE,
        paint: {
          'circle-radius': 16,
          'circle-color': ['coalesce', ['get', 'trackColour'], HOVER_DEFAULT_COLOUR],
          'circle-opacity': 0.3,
        },
      });
      map.addLayer({
        id: HOVER_LAYER,
        type: 'circle',
        source: HOVER_SOURCE,
        paint: {
          'circle-radius': 8,
          'circle-color': ['coalesce', ['get', 'trackColour'], HOVER_DEFAULT_COLOUR],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });
      // Rail-network overlay: insert before the hover marker so the hover
      // dot stays on top, and so future GPX track layers (appended last)
      // also render above the rail.
      teardownRail = setupRailNetworkOverlay(map, {
        pmtilesUrl: `${import.meta.env.BASE_URL}rail.pmtiles`,
        beforeId: HOVER_HALO_LAYER,
        initialVisible: railVisibleRef.current,
      });
      // Rail stations: dots + labels above the rail lines, still below
      // the hover marker and any user overlays.
      teardownStations = setupRailStations(map, {
        dataUrl: `${import.meta.env.BASE_URL}rail-stations.geojson`,
        beforeId: HOVER_HALO_LAYER,
        initialVisible: stationsVisibleRef.current,
      });
      // Curated hikes: inserted below the hover marker so user GPX
      // (added later, see "Sync track overlays") still paints on top.
      teardownCurated = setupCuratedHikesOverlay(map, {
        beforeId: HOVER_HALO_LAYER,
        initialVisible: curatedVisibleRef.current,
      });

      // GR trails: lines inserted BELOW the curated hikes so curated hikes
      // paint over the blaze; labels go at the top symbol layer (just
      // below the hover marker) so they remain legible above other lines.
      teardownGr = setupGrOverlay(map, {
        pmtilesUrl: `${import.meta.env.BASE_URL}data/gr-routes.pmtiles`,
        beforeLinesId: CURATED_TRACK_HALO_LAYER_ID,
        beforeLabelsId: HOVER_HALO_LAYER,
        initialVisible: grVisibleRef.current,
      });

      offEventListeners.push(attachGrInteractions(map));

      const mountTransitProvider = createTransitMounter(map, {
        mountedTransitIds,
        transitVisibleRef,
        providerColorsRef,
        dayFilterRef,
        hideLowFreqRef,
        showArchivedRef,
        teardownTransit,
        offEventListeners,
      });
      mountTransitProviderRef.current = mountTransitProvider;
      // Initial mount: only providers whose toggle is on at first paint.
      // Iterates in TRANSIT_PROVIDERS order so layer-ordering is preserved
      // when multiple providers default-on (rare today but cheap to honour).
      for (const provider of TRANSIT_PROVIDERS) {
        if (transitVisibleRef.current[provider.id]) {
          mountTransitProvider(provider.id);
        }
      }

      offEventListeners.push(attachOpenLineListener(map));
    });

    return () => {
      if (teardownStations) {
        try {
          teardownStations();
        } catch {
          // map may already be torn down; ignore.
        }
        teardownStations = null;
      }
      if (teardownRail) {
        try {
          teardownRail();
        } catch {
          // map may already be torn down; ignore.
        }
        teardownRail = null;
      }
      if (teardownCurated) {
        try {
          teardownCurated();
        } catch {
          /* map may already be torn down */
        }
        teardownCurated = null;
      }
      if (teardownGr) {
        try {
          teardownGr();
        } catch {
          /* map may already be torn down */
        }
        teardownGr = null;
      }
      for (const off of offEventListeners) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      for (const teardown of teardownTransit) {
        try {
          teardown();
        } catch {
          /* map may already be torn down */
        }
      }
      teardownTransit.length = 0;
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      mountedTrackIds.current.clear();
      mountedTerrainAttr.current = {};
      geometryFetches.current = {};
    };
  }, []);

  useBasemap(mapRef, activeLayerId);
  useRailVisibility(mapRef, exploreActiveRef, railVisible);
  useTransitLayers({
    mapRef,
    exploreActiveRef,
    mountedTransitIds,
    mountTransitProviderRef,
    transitVisible,
    dayFilter,
    hideLowFreq,
    showArchived,
    providerColors,
  });
  useStationsVisibility(mapRef, exploreActiveRef, stationsVisible);
  useCuratedVisibility(mapRef, exploreActiveRef, curatedVisible);
  useGrVisibility(mapRef, exploreActiveRef, grVisible);
  useCuratedFilter(mapRef, exploreActiveRef, curatedManifest, curatedFilter);
  useGpxTracks({ mapRef, exploreActiveRef, mountedTrackIds, mountedTerrainAttr, geometryFetches });
  useExploreMap({
    mapRef,
    mapInstance,
    explore,
    mountTransitProviderRef,
    dayFilterRef,
    hideLowFreqRef,
    curatedVisibleRef,
    curatedManifest,
    curatedFilter,
  });
  useSearchReveal(mapRef, mapInstance, mountTransitProviderRef);

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <ZoomLevelReadout map={mapInstance} />
      <HikePopup map={mapInstance} />
      <TransitPopup map={mapInstance} dayFilter={dayFilter} hideLowFreq={hideLowFreq} />
    </>
  );
}
