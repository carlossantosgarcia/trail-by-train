# GR trails build pipeline

Builds `public/data/gr-routes.pmtiles` — the GR (Grande Randonnée) hiking
network for metropolitan France + Corsica.

## Source

OpenStreetMap, via the Overpass API. We filter to relations tagged
`route=hiking`, `network=nwn`, and `ref ~ "^GR ?[0-9]"` — excluding
`GR de Pays` (GRP) and `PR` routes, which would need their own styling.

## Steps

1. `scripts/gr/fetch-overpass.mjs` — fetches the Overpass result, parses
   each relation's ways into LineString features, normalises `ref`
   (`GR5` / `GR-5` / `GR  5` → `GR 5`), computes `length_km`, resolves
   the most authoritative external link per route (`wikipedia` tag →
   `wikidata` → `website` → OSM relation URL), and writes the normalised
   GeoJSON to `scripts/gr/.cache/gr-routes.normalized.geojson`. Wikidata
   lookups are cached on disk under `scripts/gr/.cache/wikidata.json`.
2. `scripts/gr/build-tiles.sh` — runs Tippecanoe to convert the
   normalised GeoJSON into `public/data/gr-routes.pmtiles`.

## Requirements

- Node 18+ (uses `fetch`, ESM modules).
- `tippecanoe` on `PATH`:
  - Debian/Ubuntu: `apt install tippecanoe`
  - macOS: `brew install tippecanoe`

## Usage

```
npm run build:gr
```

The PMTiles output is not committed: the Data workflow rebuilds it monthly and
publishes it in the `data-latest` release (`npm run data:download` fetches it).
