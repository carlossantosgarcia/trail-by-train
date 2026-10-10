## 1. Build

- [x] 1.1 `lib/resolve-feed.mjs` + tests: pick the current GTFS resource, fall back to `gtfsUrl`; catalogue fetched once in `buildAll`; `gtfs_url` in meta; changed URL forces download
- [x] 1.2 `shapes.txt` optional at extraction; routes without a shape borrow ledger geometry when 90% of their stops are within 200 m of it; `shape_seen_on` on the line
- [x] 1.6 First stop of a trip = lowest `stop_sequence`
- [x] 1.3 Out of season: no trips → `dormant` outcome, `dormant_since` in meta, no failure counted; unchanged dormant feed still reported dormant
- [x] 1.4 Churn guard on id overlap; shrink warning in the outcome and refresh record
- [x] 1.5 `BUILD_VERSION` 3

## 2. Report

- [x] 2.1 `report-stale.mjs`: Broken / To check / Out of season sections, `--summary`
- [x] 2.2 Workflow: open or comment when broken or to check; close with "All clear" when healthy
- [x] 2.3 Job summary shows dormant and warning outcomes

## 3. App

- [x] 3.1 Line popup: "Hors saison" pill from meta `dormant_since`; borrowed-shape note from `shape_seen_on`

## 4. Verify

- [x] 4.1 Unit tests: refresh record (dormant, warning), report sections, churn overlap, resolver, shape borrowing
- [x] 4.2 Build the six networks of issue #4 locally against the published data: shuttles dormant, Altigo rebuilt from v7 with borrowed shapes, Charente rebuilt with 2 live and 19 archived lines and a warning
- [x] 4.3 Preview with those networks; `npm run lint`, `npm test`, `npm run build`
- [x] 4.4 Full rebuild of the 63 networks against the published data: no failure; the first-stop fix changes timetable summaries in 10 networks (Zou departures about 8 minutes earlier, Grenoble C2 778 trips instead of 390, Altigo's lines no longer empty)
