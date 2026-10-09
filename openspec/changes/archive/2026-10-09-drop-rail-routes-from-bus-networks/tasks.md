## 1. Route-type rule

- [x] 1.1 Add `scripts/transit/lib/route-types.mjs` with `isRailRouteType` (2 and 100–117) and `partitionRailRoutes(routes)`
- [x] 1.2 Unit tests: types 2, 100, 117 excluded; 3, 0, 1, 7, 715 kept; a coach sharing a train's name kept

## 2. Build

- [x] 2.1 In `build.mjs`, drop rail routes right after reading `routes.txt`, and the trips that run them
- [x] 2.2 Log the excluded count per provider and carry it in the outcome, `meta.json` (`excluded_rail_routes`) and the job summary
- [x] 2.3 Pass the excluded route ids to `mergeLineLedger`, which removes matching ledger entries instead of archiving them
- [x] 2.4 Unit test: a ledger entry whose route is excluded is removed, a coach with the same name is kept
- [x] 2.5 Add `BUILD_VERSION`, record it as `build_version` in `meta.json`, and skip an unchanged feed only when the version matches too

## 3. Verify

- [x] 3.1 Rebuild `zou` locally: K24 and the other 29 SNCF trains are gone, the 32 coach routes (P25 coach included) remain
- [x] 3.2 Rebuild the place index and Explore index; "K24" no longer finds a bus line
- [x] 3.3 Check the app: no K24 in Zou's lines; Explore around Avignon lists no TER line as a bus
- [x] 3.4 `npm run lint`, `npm test`, `npm run build` pass
- [x] 3.5 Re-shoot the README bus screenshot (it showed the P25 coach, which stays)

## 4. Exceptions and labels

- [x] 4.1 `keepRailRoutes` route_id prefixes in the catalog; Zou keeps `CFP:` (Chemins de fer de Provence, line 49)
- [x] 4.2 `serviceKinds`: `train` for kept rail routes, `rail_replacement` for a road route with a same-number, same-name train in the feed
- [x] 4.3 `service_kind` on line features; "Train" / "Car de remplacement TER" pill in the line popup
- [x] 4.4 Tests for the exception and the classification; rebuilt `zou`: 49 is `train`, the 11 TER coaches are `rail_replacement`, P26 and P5 unlabelled
- [x] 4.5 Checked in the app: line 49's popup shows "Train", P25's shows "Car de remplacement TER"

## 5. Specs

- [x] 5.1 `openspec validate --strict` passes; archive the change into the main specs once merged
