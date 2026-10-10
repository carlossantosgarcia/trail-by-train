## 1. Sheet primitive

- [x] 1.1 `BottomSheet`: measure head + content, publish `--sheet-content`, cap half/full with it; snap among distinct heights only; `openSnap` prop for the head tap
- [x] 1.2 `src/lib/backStack.ts`: history-backed close stack; `BottomSheet` registers while above peek (persistent) or while shown (transient)
- [x] 1.3 `src/lib/mapGestures.ts`: `pan` / `tap` signal with `claimMapTap()`; `Map.tsx` publishes; transit, curated-hike and GR click handlers claim; the hike sheet closes on an unclaimed tap

## 2. Consumers

- [x] 2.1 `MobileSheet`: quick toggles (hikes, GR, Trains, Bus) and an icon-only expand button at peek when layers is the only segment; lowers on pan / tap
- [x] 2.2 `ExplorePanel`: results sheet keeps its own snap, lowers on pan / unclaimed tap, never exits Explore
- [x] 2.3 `TransitPopup`: transient sheet on mobile with chip + name head and close; closes on unclaimed tap; desktop popup unchanged
- [x] 2.4 Search: picking a result collapses the field
- [x] 2.5 Zoom readout not rendered on mobile; scale bar offset no longer reserves room for it

## 3. Verify

- [x] 3.1 Unit tests for the back stack and the tap-claim signal
- [x] 3.2 Phone walkthrough (390×844): quick toggles, sheet heights, pan/tap lowering, Explore results drag, line sheet (the stop sheet shares its code and was not tapped), back button, search collapse
- [x] 3.3 Desktop unchanged: controls panel, popups, readout
- [x] 3.4 `npm run lint`, `npm test`, `npm run build` pass; preview deployed
