## 1. Data

- [x] 1.1 `scripts/transit/lib/service-days.mjs`: line mask (4 dates or half the running weeks), stop masks (covered ones dropped, union past 8), legacy mask, per-day-type trimming; unit tests
- [x] 1.2 `build.mjs`, `stops.mjs`, `emit-geojson.mjs`: `service_days` on lines, serving lines and stops; `is_low_freq`, `runs_<day>` and `has_high_freq_line` dropped (also from ledger features); `lowFreqThreshold` removed from the catalog
- [x] 1.3 `BUILD_VERSION` 4, so the Data workflow rebuilds every network once

## 2. App

- [x] 2.1 `serviceDays.ts`: selection type, MapLibre predicate over up to 8 masks, stop popup test; unit tests
- [x] 2.2 Weekend picker (Sam, Dim) in a small track beside its label, with a summary while a day is on, saved as `hp:bus-days` with weekdays dropped on reading; filters on lines, stops, hit areas and the stop popup
- [x] 2.3 Low-frequency toggle removed; no school label
- [x] 2.4 Bus section: eye beside the title, bus icon toggle, `BusNetworkMenu` (summary, filter, bulk actions, checkboxes by region, colour swatch, scrolled into view on opening); pills and "+ Fournisseurs ▾" removed

## 3. Verify

- [x] 3.1 `npm run lint`, `npm test`, `npm run build`
- [x] 3.2 Preview with every network rebuilt: Saturday + Sunday on Isère and Savoie; Saturday alone; Sunday alone; a stop served by a Saturday-only and a Sunday-only line hidden for both days; T60 visible with no day on; phone layout of the picker and the menu
