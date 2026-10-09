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

- [x] 3.1 Rebuild `zou` locally: K24 and the other 31 trains are gone, the 32 coach routes (P25 coach included) remain
- [x] 3.2 Rebuild the place index and Explore index; "K24" no longer finds a bus line
- [x] 3.3 Check the app: no K24 in Zou's lines; Explore around Avignon lists no TER line as a bus
- [x] 3.4 `npm run lint`, `npm test`, `npm run build` pass
- [x] 3.5 Re-shoot the README bus screenshot (it showed the P25 coach, which stays)

## 4. Specs

- [ ] 4.1 `openspec validate --strict` passes; archive the change into the main specs once merged
