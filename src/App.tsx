import { useCallback, useEffect, useState } from 'react';
import Map from './components/Map';
import BaseLayerSwitcher from './components/BaseLayerSwitcher';
import MapControlsPanel from './components/MapControlsPanel';
import { OverlayToggle, OverlayToggleGroup } from './components/OverlayToggle';
import HikeIcon from './components/icons/HikeIcon';
import TrainIcon from './components/icons/TrainIcon';
import BusIcon from './components/icons/BusIcon';
import PublicBusesSection from './components/PublicBusesSection';
import TrainsSection from './components/TrainsSection';
import sectionStyles from './components/Section.module.css';
import { TRANSIT_PROVIDERS, type DayFilter } from './transit';
import {
  readTransitVisible,
  writeTransitVisible,
  pruneUnknownTransitVisible,
} from './lib/transitVisibilityStorage';
import { BASE_LAYERS, DEFAULT_BASE_LAYER_ID } from './layers/ignBaseLayers';
import { ElevationProfile, GpxDropZone, ToastStack, hydrateGpx, onToast } from './features/gpx';
import TracksDock from './components/TracksDock';
import MobileSheet from './components/MobileSheet';
import TrackList from './features/gpx/TrackList';
import { useIsMobile } from './lib/useIsMobile';
import { useGpxStore } from './features/gpx/store';
import { pushToast } from './features/gpx/toast';
import { readRailVisible, writeRailVisible } from './lib/railVisibilityStorage';
import { readCuratedVisible, writeCuratedVisible } from './lib/curatedVisibilityStorage';
import { readGrVisible, writeGrVisible } from './lib/grVisibilityStorage';
import {
  readDayFilter,
  writeDayFilter,
  readHideLowFreq,
  writeHideLowFreq,
  readShowArchived,
  writeShowArchived,
} from './lib/busFilterStorage';
import {
  readProviderColor,
  writeProviderColor,
  pruneUnknownProviderColors,
} from './lib/providerColorStorage';
import {
  readBusesSectionVisible,
  writeBusesSectionVisible,
  readTrainsSectionVisible,
  writeTrainsSectionVisible,
} from './lib/sectionVisibilityStorage';
import {
  DurationFilter,
  ensureManifestLoaded,
  getDurationBounds,
  setSelected,
  useCuratedStore,
} from './features/curated-hikes';
import {
  ExploreBaseSwitcher,
  ExplorePanel,
  ExploreRailToggle,
  useExplore,
} from './features/explore';
import type { SearchRevealDetail } from './features/search';

export default function App() {
  const [activeLayerId, setActiveLayerId] = useState<string>(DEFAULT_BASE_LAYER_ID);
  // Clear storage belonging to providers that no longer exist before any of it
  // is read. Retiring a provider (Fluo's three departmental feeds, replaced by
  // one region-wide feed) otherwise leaves dead keys behind for ever.
  useState(() => {
    const ids = TRANSIT_PROVIDERS.map((p) => p.id);
    pruneUnknownTransitVisible(ids);
    pruneUnknownProviderColors(ids);
    return null;
  });

  // Hydrate from localStorage synchronously so the first render of <Map>
  // already passes the correct visibility into setupRailNetworkOverlay,
  // avoiding any on→off flash on reload.
  const [railVisible, setRailVisible] = useState<boolean>(() => readRailVisible());
  const [curatedVisible, setCuratedVisible] = useState<boolean>(() => readCuratedVisible());
  const [grVisible, setGrVisible] = useState<boolean>(() => readGrVisible());
  const [transitVisible, setTransitVisible] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const p of TRANSIT_PROVIDERS) m[p.id] = readTransitVisible(p.id, p.displayDefaultOn);
    return m;
  });
  const [dayFilter, setDayFilterState] = useState<DayFilter>(() => readDayFilter());
  const [hideLowFreq, setHideLowFreqState] = useState<boolean>(() => readHideLowFreq());
  const [showArchived, setShowArchivedState] = useState<boolean>(() => readShowArchived());
  const [providerColors, setProviderColors] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const p of TRANSIT_PROVIDERS) m[p.id] = readProviderColor(p.id);
    return m;
  });
  // Gares visibility is stateless: it is not persisted and always starts shown
  // when the rail network is visible. Turning rail off→on re-shows the gares
  // (see onRailVisibleChange); a manual hide lasts only until the next rail
  // on-transition or a reload.
  const [stationsVisible, setStationsVisibleState] = useState<boolean>(true);
  const [trainsSectionVisible, setTrainsSectionVisibleState] = useState<boolean>(() =>
    readTrainsSectionVisible(),
  );
  const [busSectionVisible, setBusSectionVisibleState] = useState<boolean>(() =>
    readBusesSectionVisible(),
  );

  const onTransitVisibleChange = useCallback((providerId: string, value: boolean) => {
    setTransitVisible((prev) => ({ ...prev, [providerId]: value }));
    writeTransitVisible(providerId, value);
  }, []);

  const onTransitVisibleChangeAll = useCallback((value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const p of TRANSIT_PROVIDERS) {
      next[p.id] = value;
      writeTransitVisible(p.id, value);
    }
    setTransitVisible(next);
  }, []);

  const onDayFilterChange = useCallback((value: DayFilter) => {
    setDayFilterState(value);
    writeDayFilter(value);
  }, []);

  const onShowArchivedChange = useCallback((value: boolean) => {
    setShowArchivedState(value);
    writeShowArchived(value);
  }, []);
  const onHideLowFreqChange = useCallback((value: boolean) => {
    setHideLowFreqState(value);
    writeHideLowFreq(value);
  }, []);

  const onProviderColorChange = useCallback((providerId: string, value: string | null) => {
    setProviderColors((prev) => ({ ...prev, [providerId]: value }));
    writeProviderColor(providerId, value);
  }, []);

  const onStationsVisibleChange = useCallback((value: boolean) => {
    setStationsVisibleState(value);
  }, []);

  const onRailVisibleChange = useCallback((value: boolean) => {
    setRailVisible(value);
    writeRailVisible(value);
    // Enabling the rail network always re-shows the gares (stateless coupling).
    if (value) setStationsVisibleState(true);
  }, []);

  const onBusSectionVisibleChange = useCallback((value: boolean) => {
    setBusSectionVisibleState(value);
    writeBusesSectionVisible(value);
  }, []);

  const onTrainsSectionVisibleChange = useCallback((value: boolean) => {
    setTrainsSectionVisibleState(value);
    writeTrainsSectionVisible(value);
  }, []);

  const onGrVisibleChange = useCallback((value: boolean) => {
    setGrVisible(value);
    writeGrVisible(value);
  }, []);

  const onCuratedVisibleChange = useCallback((value: boolean) => {
    setCuratedVisible(value);
    writeCuratedVisible(value);
    if (value) {
      void ensureManifestLoaded().catch((err) => {
        pushToast({
          kind: 'error',
          text: `Curated hikes didn't load. Check your connection and switch the layer back on. (${(err as Error).message})`,
        });
      });
    } else {
      // Closing the overlay clears any open popup so it doesn't linger
      // anchored to a now-hidden line.
      setSelected(null);
    }
  }, []);

  // If curated was persisted "on", trigger the fetch on mount so the
  // layer paints as soon as the map has the geojson.
  useEffect(() => {
    if (curatedVisible) {
      void ensureManifestLoaded().catch((err) => {
        pushToast({
          kind: 'error',
          text: `Curated hikes didn't load. Check your connection and switch the layer back on. (${(err as Error).message})`,
        });
      });
    }
    // Intentionally one-shot on mount; subsequent toggles route through
    // onCuratedVisibleChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void hydrateGpx();
    const off = onToast((msg) => pushToast(msg));
    return off;
  }, []);

  // A searched bus line / hike / GR has to be visible to be revealed, and the
  // toggles that decide that live here. Map.tsx handles the same event for the
  // framing and the highlight; this half only switches the owning layer on, so
  // a result found while its layer was off does not land on a blank map.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const d = (e as CustomEvent<SearchRevealDetail>).detail;
      if (d.kind === 'bus' && d.extra) {
        // Both gates matter: the per-provider toggle and the section-level eye
        // that can hide every bus layer at once.
        onBusSectionVisibleChange(true);
        onTransitVisibleChange(d.extra, true);
      } else if (d.kind === 'rando') {
        onCuratedVisibleChange(true);
      } else if (d.kind === 'gr') {
        onGrVisibleChange(true);
      }
    };
    window.addEventListener('search:reveal', onReveal);
    return () => window.removeEventListener('search:reveal', onReveal);
  }, [
    onBusSectionVisibleChange,
    onTransitVisibleChange,
    onCuratedVisibleChange,
    onGrVisibleChange,
  ]);

  const manifest = useCuratedStore((s) => s.manifest);
  const durationBounds = manifest ? getDurationBounds(manifest) : null;

  // While Explore mode is active, the normal overlay controls are hidden so
  // the map is a clean answer surface (see effective* restoration on exit,
  // driven imperatively in Map.tsx from the layer snapshot).
  const exploreActive = useExplore().active;
  const isMobile = useIsMobile();
  const trackCount = useGpxStore((st) => st.tracks.length);

  // Derived visibility: a section-level eye toggle hides every layer the
  // section owns without disturbing the per-overlay selection state. When
  // the section is shown again, each per-overlay toggle resumes taking
  // effect.
  const effectiveTransitVisible: Record<string, boolean> = {};
  for (const id of Object.keys(transitVisible)) {
    effectiveTransitVisible[id] = busSectionVisible && transitVisible[id];
  }
  const effectiveRailVisible = trainsSectionVisible && railVisible;
  const effectiveStationsVisible = effectiveRailVisible && stationsVisible;

  // The layer controls have two hosts: the desktop side panel, and the layers
  // segment of the mobile sheet. Built once and rendered into whichever is
  // current — mounting both would duplicate their state.
  const layersContent = (
    <>
      <BaseLayerSwitcher
        layers={BASE_LAYERS}
        activeLayerId={activeLayerId}
        onChange={setActiveLayerId}
      />
      <section className={sectionStyles.section}>
        <h3 className={sectionStyles.header}>Randonnée</h3>
        <div className={sectionStyles.row}>
          <OverlayToggleGroup>
            <OverlayToggle
              icon={<HikeIcon />}
              label="Curated car-free hikes"
              value={curatedVisible}
              onChange={onCuratedVisibleChange}
            />
            <OverlayToggle
              icon={null}
              text="GR"
              label="GR trails (Grande Randonnée)"
              value={grVisible}
              onChange={onGrVisibleChange}
            />
          </OverlayToggleGroup>
          {curatedVisible && durationBounds && (
            <DurationFilter min={durationBounds.min} max={durationBounds.max} />
          )}
        </div>
      </section>
      <TrainsSection
        sectionVisible={trainsSectionVisible}
        onSectionVisibleChange={onTrainsSectionVisibleChange}
        railVisible={railVisible}
        onRailVisibleChange={onRailVisibleChange}
        stationsVisible={stationsVisible}
        onStationsVisibleChange={onStationsVisibleChange}
      />
      <PublicBusesSection
        sectionVisible={busSectionVisible}
        onSectionVisibleChange={onBusSectionVisibleChange}
        transitVisible={transitVisible}
        onTransitVisibleChange={onTransitVisibleChange}
        onTransitVisibleChangeAll={onTransitVisibleChangeAll}
        providerColors={providerColors}
        onProviderColorChange={onProviderColorChange}
        dayFilter={dayFilter}
        onDayFilterChange={onDayFilterChange}
        hideLowFreq={hideLowFreq}
        onHideLowFreqChange={onHideLowFreqChange}
        showArchived={showArchived}
        onShowArchivedChange={onShowArchivedChange}
      />
    </>
  );

  // The collapsed mobile sheet's shortcuts. Trains and Bus read as on only
  // while their section actually draws something, and turn the section eye,
  // so the choices made in the full panel survive an off/on. Bus with no
  // network chosen has nothing to show yet: it opens the panel instead.
  const anyBusNetwork = Object.values(transitVisible).some(Boolean);
  const quickToggles = (openSheet: () => void) => (
    <OverlayToggleGroup>
      <OverlayToggle
        icon={<HikeIcon />}
        label="Curated car-free hikes"
        value={curatedVisible}
        onChange={onCuratedVisibleChange}
      />
      <OverlayToggle
        icon={null}
        text="GR"
        label="GR trails (Grande Randonnée)"
        value={grVisible}
        onChange={onGrVisibleChange}
      />
      <OverlayToggle
        icon={<TrainIcon />}
        label="Trains"
        value={effectiveRailVisible}
        onChange={(on) => {
          onTrainsSectionVisibleChange(on);
          if (on && !railVisible) onRailVisibleChange(true);
        }}
      />
      <OverlayToggle
        icon={<BusIcon />}
        label="Bus"
        value={busSectionVisible && anyBusNetwork}
        onChange={(on) => {
          onBusSectionVisibleChange(on);
          if (on && !anyBusNetwork) openSheet();
        }}
      />
    </OverlayToggleGroup>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        activeLayerId={activeLayerId}
        railVisible={effectiveRailVisible}
        curatedVisible={curatedVisible}
        grVisible={grVisible}
        transitVisible={effectiveTransitVisible}
        dayFilter={dayFilter}
        hideLowFreq={hideLowFreq}
        showArchived={showArchived}
        providerColors={providerColors}
        stationsVisible={effectiveStationsVisible}
      />
      <GpxDropZone />
      {/* One surface for the two map actions and the track list. They used to
          be three absolutely-positioned elements sharing the same corner. */}
      <TracksDock />
      {!exploreActive &&
        (isMobile ? (
          <MobileSheet
            layers={layersContent}
            tracks={<TrackList />}
            profile={<ElevationProfile embedded />}
            trackCount={trackCount}
            quickToggles={quickToggles}
          />
        ) : (
          <MapControlsPanel>{layersContent}</MapControlsPanel>
        ))}
      {exploreActive && (
        <>
          <ExploreBaseSwitcher
            layers={BASE_LAYERS}
            activeLayerId={activeLayerId}
            onChange={setActiveLayerId}
          />
          <ExploreRailToggle />
        </>
      )}
      <ExplorePanel />
      {!isMobile && <ElevationProfile />}
      <ToastStack />
    </div>
  );
}
