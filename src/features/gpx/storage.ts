import { openDB, type IDBPDatabase } from 'idb';
import type { FeatureCollection, LineString } from 'geojson';
import { QuotaError, type Track, type TrackGeometry } from './types';

const DB_NAME = 'hike-planner';
const DB_VERSION = 1;
const TRACKS_STORE = 'tracks';
const GEOMETRIES_STORE = 'geometries';

interface Schema {
  [TRACKS_STORE]: { key: string; value: Track };
  [GEOMETRIES_STORE]: { key: string; value: TrackGeometry };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function getDb(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TRACKS_STORE)) {
          db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(GEOMETRIES_STORE)) {
          db.createObjectStore(GEOMETRIES_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string }).name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

export async function loadAllTracks(): Promise<Track[]> {
  const db = await getDb();
  const tracks = await db.getAll(TRACKS_STORE);
  return tracks.sort((a, b) => a.createdAt - b.createdAt);
}

export async function loadGeometry(
  id: string,
): Promise<FeatureCollection<LineString, Record<string, unknown>> | null> {
  const db = await getDb();
  const row = await db.get(GEOMETRIES_STORE, id);
  return row?.geojson ?? null;
}

export async function saveTrack(
  track: Track,
  geojson: FeatureCollection<LineString, Record<string, unknown>>,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([TRACKS_STORE, GEOMETRIES_STORE], 'readwrite');
  try {
    await Promise.all([
      tx.objectStore(TRACKS_STORE).put(track),
      tx.objectStore(GEOMETRIES_STORE).put({ id: track.id, geojson }),
      tx.done,
    ]);
  } catch (err) {
    if (isQuotaError(err)) throw new QuotaError();
    throw err;
  }
}

export async function updateTrack(
  id: string,
  patch: Partial<Omit<Track, 'id'>>,
): Promise<Track | null> {
  const db = await getDb();
  const tx = db.transaction(TRACKS_STORE, 'readwrite');
  const store = tx.objectStore(TRACKS_STORE);
  const existing = await store.get(id);
  if (!existing) {
    await tx.done;
    return null;
  }
  const next: Track = { ...existing, ...patch, id };
  try {
    await store.put(next);
    await tx.done;
  } catch (err) {
    if (isQuotaError(err)) throw new QuotaError();
    throw err;
  }
  return next;
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([TRACKS_STORE, GEOMETRIES_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(TRACKS_STORE).delete(id),
    tx.objectStore(GEOMETRIES_STORE).delete(id),
    tx.done,
  ]);
}
