## Why

The map always opened on Satellite. A hiker who prefers Topo or Street had to
switch again on every visit.

## What Changes

- The basemap the user picks, from the main switcher or Explore's, is stored
  in `localStorage` under `hp.basemap`, never sent anywhere.
- The map opens on the stored basemap, from its first tiles. A visitor who
  never picked one, or whose stored basemap no longer exists, gets
  Satellite, the default; only a pick is stored, so a later change of
  default still reaches them.

## Capabilities

### Modified Capabilities

- `map-viewer`: the basemap choice survives a reload.

## Impact

- `src/lib/basemapStorage.ts` (new) and its test.
- `src/App.tsx`: the active basemap starts from storage, and a pick is
  stored.
- `src/components/map/style.ts`, `src/components/Map.tsx`: the initial style
  shows the stored basemap.
