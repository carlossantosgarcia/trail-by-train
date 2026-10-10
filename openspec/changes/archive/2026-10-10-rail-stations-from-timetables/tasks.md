## 1. Build

- [x] 1.1 `scripts/rail-stations/lib.mjs`: `railTripIds`, `servedStations` (platform → station, coach stop points ignored), `mergeStations`, `toFeatures`
- [x] 1.2 Unit tests: coach-only station ignored; parent resolution and UIC; cross-source merge by UIC, distance and name; Auber and Haussmann both kept; foreign UIC dropped; far register row lends no commune
- [x] 1.3 `scripts/build-rail-stations.mjs` replaces the jq script: SNCF + Transilien GTFS, "Gares de voyageurs", register communes, geo.api.gouv.fr for the rest; stations abroad dropped; aborts under 2,000 stations
- [x] 1.4 `npm run build:rail` calls it

## 2. Docs and attribution

- [x] 2.1 `DATA_LICENSES.md`: new sources and licences
- [x] 2.2 Station attribution links to "Gares de voyageurs"; search index source note updated

## 3. Verify

- [x] 3.1 Build locally: Grasse at Grasse, Ranguin, Le Bosquet and Mouans-Sartoux present, Quiberon kept, Felletin gone; no duplicate pairs within 150 m
- [x] 3.2 Rebuild the place index and Explore index from the new file
- [x] 3.3 Check on the preview: Cannes – Grasse stations, search "Grasse", Explore around Grasse
- [x] 3.4 `npm run lint`, `npm test`, `npm run build` pass
