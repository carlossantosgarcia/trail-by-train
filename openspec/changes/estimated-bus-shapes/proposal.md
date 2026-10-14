## Why

Some networks give lines no geometry the map can use. Altigo stopped shipping
`shapes.txt` in 2026-09, so only the lines the ledger had recorded are drawn.
Other feeds leave some trips without a shape. Most Corsican and Hauts-de-France
coaches publish "shapes" that only join their stops with straight lines (all 83
of Haute-Corse's shapes, 2,312 of 2,808 in Nord), which cut across valleys and
read as roads that don't exist. Apps such as Transit draw these lines by
routing the stops over OpenStreetMap. A study on the networks that publish both
shapes and stops (2026-10-13) found that pfaedle reproduces the published shapes
within 25 m for most lines, and it runs in seconds per network once the OSM
data is read. That
makes it practical in the weekly Data workflow.

## What Changes

- The build SHALL estimate a geometry for trips whose feed gives no usable shape,
  or only a stop-to-stop one. It routes one trip per stop pattern with pfaedle
  over OpenStreetMap.
- pfaedle's line is drawn whole. Where it finds no road it joins two stops
  with a straight segment, which is drawn too: the line is marked as
  estimated, and such a segment is no worse than the stop-to-stop shapes being
  replaced. These segments are counted in the build log (216 of 40,271 hops
  across the 15 networks affected in 2026-10).
- OSM extracts are chosen from where the stops are. They include neighbouring
  countries, so cross-border lines (Geneva, Monaco, Italy) keep their roads.
  Extracts are filtered to roads and transit and cached. Each build crops
  them to the area it needs.
- Order of preference for a route's geometry: the feed's road-following shapes,
  then the shape the ledger recorded for a feed that dropped its shapes, then an
  estimate. An estimated shape is never reused as a recorded one.
- Lines carry `shape_estimated` (`all` or `part`). Their popup says in one line
  that the route is estimated from the stops and OpenStreetMap.
- **BREAKING (spec)**: "The build SHALL NOT fabricate geometry from stop
  sequences" is replaced. A feed without shapes can now be registered.
- The Data workflow builds a pinned pfaedle, installs osmium-tool and caches
  OSM extracts. `BUILD_VERSION` goes to 5, so every network is rebuilt once.

## Capabilities

### New Capabilities

- `transit-shape-estimation`: covers which trips are estimated, how pfaedle's
  result is drawn, which OSM data is used, and how that data is
  attributed.

### Modified Capabilities

- `transit-provider-catalog`: "Only networks that can be drawn" now allows
  estimated geometry. Feeds without shapes become registrable.
- `public-transit`: lines carry `shape_estimated`, and the line popup states it.
- `scheduled-data-refresh`: the Data workflow provides pfaedle, osmium and an
  OSM cache, and a build without pfaedle draws what it did before.

## Impact

- `scripts/transit/build.mjs` (route geometry plan, `BUILD_VERSION` 5).
- New modules: `scripts/transit/lib/estimate-shapes.mjs` and
  `lib/osm-extracts.mjs`.
- `lib/ledger.mjs`: recorded-shape lookup skips estimates.
- `src/transit/TransitPopup.tsx` and `types.ts`.
- `.github/workflows/data.yml`.
- `DATA_LICENSES.md`.
- New build-time dependencies: pfaedle (GPL-3.0, run as a tool, not
  distributed), osmium-tool, and Geofabrik OSM extracts (ODbL). Without
  pfaedle on PATH, local builds behave as before.
- Data: OSM-derived geometry in `lines.pmtiles` makes those tiles a work
  derived from OpenStreetMap, which has to be attributed (ODbL).
