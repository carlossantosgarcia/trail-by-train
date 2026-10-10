## Why

Grasse station is drawn in Marseille, on top of Marseille Saint-Charles, and the
three stations between Cannes and Grasse (Ranguin, Le Bosquet, Mouans-Sartoux) are
missing. The track itself is right: the Cannes – Grasse line ends 25 m from the
real station.

The cause is the source. The station layer comes from SNCF's "Liste des gares",
which has not been updated since March 2022. Compared with SNCF's current
timetables (October 2026 – March 2027):

- it still lists about 170 stations no train calls at: lines closed to passengers
  (Felletin, Aubusson, Roscoff, Lille – Comines, Laon – Hirson, Carcassonne – Quillan,
  most of the small Lorraine lines…);
- it lacks stations opened since, or never registered there: Ranguin, Le Bosquet,
  Mouans-Sartoux, Arcachon and the Arcachon branch, Pornic, the RER A and B stations
  in Paris…;
- Grasse is 124 km off, and 54 more stations are 0.5–1.8 km away from their
  platforms (Millau, Marvejols, Saint-Flour…).

A hiker planning by train needs the stations a train actually stops at, where
they are.

## What Changes

- Stations SHALL come from what SNCF publishes today:
  - every station a train calls at in SNCF's timetables (TER, TGV, Intercités,
    OUIGO…) or Transilien's, both GTFS; a station only coaches call at is not a
    train station;
  - plus every station in SNCF's "Gares de voyageurs" list, the passenger
    stations SNCF Gares & Connexions maintains, updated daily. The timetables
    only cover the next six months; the list keeps summer-only lines (Quiberon,
    the Côte Fleurie, Pointe de Grave), tram-trains and lines shut for works on
    the map.
- Position and name come from the timetables, or the list for a station that has
  no train today. "Liste des gares" now lends only the commune, and only from a row
  within 1 km of the station; geo.api.gouv.fr names the commune of the rest.
- Entries for one station are merged across sources by UIC code, position (within
  150 m), or name (within 400 m), so SNCF's "Massy-Palaiseau" and Transilien's
  "Massy - Palaiseau" are one station.
- Stations outside France are left out (Basel, Le Locle and Monaco carry French
  UIC codes).
- The build refuses to publish when a source comes back nearly empty (fewer than
  2,000 stations), keeping the previous file.
- Net effect today: 2,950 → 2,867 stations. 171 are removed, 103 added, 54 moved
  more than 500 m.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `rail-stations`: the source and build of the stations, the label property, and
  the attribution link.

## Impact

- `scripts/build-rail-stations.sh` (curl + jq) is replaced by
  `scripts/build-rail-stations.mjs`, with pure helpers in
  `scripts/rail-stations/lib.mjs` and tests. It reuses the transit GTFS readers and
  needs `unzip`, like the transit build. `npm run build:rail` calls it.
- The monthly Data run picks it up unchanged; the place index and Explore index
  rebuild from the new file as before.
- `public/rail-stations.geojson` keeps its shape (`name`, `commune`, `code_uic`), so
  the app, search and Explore need no change. `code_uic` may be null for a
  Transilien-only station; nothing reads it.
- `railStationsOverlay.ts`: the SNCF attribution links to "Gares de voyageurs".
- `DATA_LICENSES.md`: the new sources (ODbL; communes under Licence Ouverte 2.0).
- Not in scope: the rail **lines**. SNCF Réseau's line data lacks a few operated
  sections (the Arcachon branch, Douai – Valenciennes near Wallers, the LGV link at
  Marne-la-Vallée), so 13 stations stand off the drawn network. That is a separate
  change.
