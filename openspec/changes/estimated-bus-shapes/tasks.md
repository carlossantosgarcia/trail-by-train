## 1. Estimation library

- [x] 1.1 `lib/estimate-shapes.mjs`: stop-to-stop detection (`stopIndex`, `isStopToStop`)
- [x] 1.2 `describeMatch`: pfaedle's line whole, with straight-line fallbacks and moved stops counted
- [x] 1.3 `matchPatterns`: write the mini feed, run pfaedle, and read back shapes and `shape_dist_traveled`
- [x] 1.4 `lib/osm-extracts.mjs`: pick Geofabrik regions from stop points, download, filter with osmium, merge and cache

## 2. Build integration

- [x] 2.1 Detect stop-to-stop shapes and collect ordered stop times for candidate trips
- [x] 2.2 Per-route geometry plan: feed shapes, then the ledger's published shape, then the estimate; skip patterns already on road shapes
- [x] 2.3 Replace a stop-to-stop shape only when every pattern using it was estimated
- [x] 2.4 Emit `shape_estimated` and `estimated_line_count`; bump `BUILD_VERSION` to 5
- [x] 2.5 `ledgerShapeLookup` ignores estimated entries
- [x] 2.6 Without pfaedle, or when it fails, log and build as before
- [x] 2.7 Write an unpublished `estimates.json` report per network (straight hops, placed stops) for inspection

## 3. App

- [x] 3.1 `shape_estimated` in `TransitLine` types
- [x] 3.2 One-line note in the line popup ("Tracé estimé…" / "Tracé en partie estimé…")

## 4. CI and licences

- [x] 4.1 Data workflow: osmium-tool, pfaedle built from a pinned commit and cached, OSM extract cache
- [x] 4.2 `DATA_LICENSES.md`: OpenStreetMap (ODbL) as a source of estimated line geometry
- [ ] 4.3 Run the Data workflow by hand after merge, and check its time, disk use and cache size

## 5. Verification

- [x] 5.1 Unit tests: straight-hop counting, stop-to-stop detection, region choice, ledger lookup
- [ ] 5.2 Build every network locally with pfaedle and record which are affected and how long it takes
- [ ] 5.3 Preview the built app and inspect the estimated lines against a background map
- [x] 5.4 CONTRIBUTING: shapes.txt is no longer required; how to get estimates locally
