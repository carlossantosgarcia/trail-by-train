import { useSyncExternalStore } from 'react';
import { parseGpxFile } from './parser';
import * as storage from './storage';
import { nextNColours } from './palette';
import { enrichWithTerrain, TerrainServiceError } from './enrichElevation';
import {
  GpxLoadError,
  QuotaError,
  type EnrichmentState,
  type Track,
  type TrackBbox,
} from './types';

type ZoomToTrackListener = (bbox: TrackBbox) => void;
type ToastListener = (msg: { kind: 'error' | 'info'; text: string }) => void;
/** Fired when a track's stored geometry is replaced (terrain enrichment). */
type GeometryChangedListener = (trackId: string) => void;

/**
 * A snapshot of the elevation-chart cursor: where the user is on the
 * hovered track, with the values the readout chip needs (and the track
 * colour the map marker takes on). `null` whenever the cursor leaves
 * the chart.
 */
export interface HoveredSample {
  /** Index into the chart's sample arrays. */
  idx: number;
  /** [lon, lat] for the map marker. */
  coord: [number, number];
  /** Cumulative distance from track start, kilometres. */
  distanceKm: number;
  /** Altitude at the hovered point, metres. */
  altitudeM: number;
  /** Local slope as a percentage (positive = uphill). */
  slopePct: number;
  /** Seconds since the start of the track, when timestamps are present. */
  elapsedSeconds?: number;
  /** Rolling pace in min/km over the slope window, when timestamps are present. */
  paceMinPerKm?: number;
  /** Track colour the map marker should adopt. */
  trackColour: string;
}

interface State {
  tracks: Track[];
  selectedId: string | null;
  hoveredSample: HoveredSample | null;
  parsing: number; // count of files currently being parsed
  hydrated: boolean;
  /**
   * Terrain-enrichment state per track id, for tracks whose GPX had no
   * elevation. Absent once enrichment has succeeded — or when it was never
   * needed, which is the common case.
   */
  enrichment: Record<string, EnrichmentState>;
}

let state: State = {
  tracks: [],
  selectedId: null,
  hoveredSample: null,
  parsing: 0,
  hydrated: false,
  enrichment: {},
};

const subscribers = new Set<() => void>();
const zoomListeners = new Set<ZoomToTrackListener>();
const toastListeners = new Set<ToastListener>();
const geometryListeners = new Set<GeometryChangedListener>();

function notifyGeometryChanged(trackId: string): void {
  for (const l of geometryListeners) l(trackId);
}

function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  for (const s of subscribers) s();
}

function emitToast(msg: { kind: 'error' | 'info'; text: string }): void {
  for (const l of toastListeners) l(msg);
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot(): State {
  return state;
}

// ---------- actions ----------

let hydratePromise: Promise<void> | null = null;
export function hydrate(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const tracks = await storage.loadAllTracks();
      setState({ tracks, hydrated: true });
    } catch (err) {
      console.error('Failed to hydrate GPX tracks from IndexedDB', err);
      setState({ hydrated: true });
    }
  })();
  return hydratePromise;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Add one or more GPX files in a single batch. Colours are pre-reserved up
 * front from a snapshot of the current track colours, so parallel adds get
 * pairwise-distinct entries from the palette (not all the same "next"
 * colour). Per-file parse/save runs in parallel; per-file errors surface
 * as toasts and do not abort other files in the batch.
 */
export async function addTracksFromFiles(files: readonly File[]): Promise<void> {
  if (files.length === 0) return;

  // Snapshot once and reserve N distinct colours before any async work.
  const colours = nextNColours(
    state.tracks.map((t) => t.colour),
    files.length,
  );
  const added: Track[] = [];

  await Promise.all(
    files.map(async (file, idx) => {
      const colour = colours[idx];
      setState({ parsing: state.parsing + 1 });
      try {
        const { name, geojson, summary } = await parseGpxFile(file);
        const track: Track = {
          id: makeId(),
          name,
          originalFilename: file.name,
          colour,
          visible: true,
          createdAt: Date.now(),
          summary: {
            ...summary,
            elevationSource: summary.hasElevation ? 'file' : 'none',
          },
          // togeojson tags route-derived LineStrings; parseCore keeps that
          // through so a planned route can be told from a recorded track.
          fromRoute:
            geojson.features.length > 0 &&
            geojson.features.every((f) => f.properties?._gpxType === 'rte'),
        };
        await storage.saveTrack(track, geojson);
        setState({ tracks: [...state.tracks, track], selectedId: track.id });
        added.push(track);

        // Render first, enrich after: a network-free parse should never wait
        // on tile reads. Only files with no elevation of their own qualify.
        if (!summary.hasElevation) {
          setEnrichment(track.id, { status: 'pending' });
          void runEnrichment(track.id);
        }
      } catch (err) {
        if (err instanceof GpxLoadError) {
          emitToast({ kind: 'error', text: err.message });
        } else if (err instanceof QuotaError) {
          emitToast({ kind: 'error', text: err.message });
        } else {
          console.error('Failed to add GPX track', err);
          emitToast({
            kind: 'error',
            text: `Could not load ${file.name}: ${(err as Error).message ?? 'unknown error'}`,
          });
        }
      } finally {
        setState({ parsing: Math.max(0, state.parsing - 1) });
      }
    }),
  );

  // Frame what was just opened: a file you pick is a file you want to see.
  if (added.length > 0) {
    const bbox = added
      .map((t) => t.summary.bbox)
      .reduce((a, b) => [
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.max(a[3], b[3]),
      ]);
    for (const l of zoomListeners) l(bbox);
  }
}

/**
 * Single-file convenience wrapper. Kept exported so existing callers and any
 * future single-file path go through the same colour-reservation logic.
 */
export function addTrackFromFile(file: File): Promise<void> {
  return addTracksFromFiles([file]);
}

// ---------- terrain enrichment ----------

function setEnrichment(id: string, next: EnrichmentState | null): void {
  const enrichment = { ...state.enrichment };
  if (next) enrichment[id] = next;
  else delete enrichment[id];
  setState({ enrichment });
}

/**
 * Derive elevation for a track from IGN's altimetry service.
 *
 * A failure here must never cost the user their track: the geometry stays
 * loaded and rendered, and the track is flagged so the UI can offer a retry.
 * An unreachable service is reported separately from absent coverage — the
 * first is a transient fault, the second is the honest answer for a route outside
 * France, and conflating them would present a bug as a fact about terrain.
 */
async function runEnrichment(id: string): Promise<void> {
  const track = state.tracks.find((t) => t.id === id);
  if (!track) return;

  try {
    const geojson = await storage.loadGeometry(id);
    if (!geojson) {
      setEnrichment(id, {
        status: 'failed',
        reason: 'error',
        message: 'The track geometry could not be read back from storage.',
      });
      return;
    }

    const enriched = await enrichWithTerrain(geojson, track.summary);
    if (!enriched) {
      // No sample resolved: the route lies outside RGE ALTI coverage.
      // Leave hasElevation false — reporting D+ 0 would be a wrong answer
      // dressed as a real one.
      setEnrichment(id, null);
      await patchAndPersist(id, {
        summary: { ...track.summary, elevationSource: 'none', terrainCoverage: 0 },
      });
      return;
    }

    const updated: Track = { ...track, summary: enriched.summary };
    await storage.saveTrack(updated, enriched.geojson);
    setEnrichment(id, null);
    setState({ tracks: state.tracks.map((t) => (t.id === id ? updated : t)) });
    notifyGeometryChanged(id);
  } catch (err) {
    const serviceDown = err instanceof TerrainServiceError;
    setEnrichment(id, {
      status: 'failed',
      reason: serviceDown ? 'service-unavailable' : 'error',
      message: serviceDown
        ? `IGN's elevation service is unavailable: ${(err as Error).message}`
        : `Could not read terrain elevation: ${(err as Error).message ?? 'unknown error'}`,
    });
    if (!serviceDown) console.error('Terrain enrichment failed', err);
    emitToast({
      kind: 'error',
      text: serviceDown
        ? `${track.name}: IGN's elevation service could not be reached — the track was kept without a profile.`
        : `${track.name}: could not derive elevation from terrain — the track was kept without a profile.`,
    });
  }
}

/** Retry terrain enrichment for a track the user asked to retry. */
export function retryEnrichment(id: string): void {
  if (!state.tracks.some((t) => t.id === id)) return;
  setEnrichment(id, { status: 'pending' });
  void runEnrichment(id);
}

async function patchAndPersist(id: string, patch: Partial<Omit<Track, 'id'>>): Promise<void> {
  const updated = await storage.updateTrack(id, patch).catch((err) => {
    if (err instanceof QuotaError) emitToast({ kind: 'error', text: err.message });
    else console.error('Failed to update track', err);
    return null;
  });
  if (!updated) return;
  setState({
    tracks: state.tracks.map((t) => (t.id === id ? updated : t)),
  });
}

export function setVisibility(id: string, visible: boolean): void {
  void patchAndPersist(id, { visible });
}

export function setColour(id: string, colour: string): void {
  void patchAndPersist(id, { colour });
}

export function rename(id: string, name: string): void {
  void patchAndPersist(id, { name });
}

export function select(id: string | null): void {
  setState({ selectedId: id });
}

export function setHoveredSample(sample: HoveredSample | null): void {
  setState({ hoveredSample: sample });
}

export async function remove(id: string): Promise<void> {
  try {
    await storage.deleteTrack(id);
  } catch (err) {
    console.error('Failed to delete track', err);
  }
  setState({
    tracks: state.tracks.filter((t) => t.id !== id),
    selectedId: state.selectedId === id ? null : state.selectedId,
    hoveredSample: null,
  });
}

export function zoomToTrack(id: string): void {
  const track = state.tracks.find((t) => t.id === id);
  if (!track) return;
  for (const l of zoomListeners) l(track.summary.bbox);
}

// ---------- subscriptions ----------

export function onZoomToTrack(listener: ZoomToTrackListener): () => void {
  zoomListeners.add(listener);
  return () => zoomListeners.delete(listener);
}

export function onGeometryChanged(listener: GeometryChangedListener): () => void {
  geometryListeners.add(listener);
  return () => geometryListeners.delete(listener);
}

export function onToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

// ---------- hook ----------

export function useGpxStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useGpxState(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
