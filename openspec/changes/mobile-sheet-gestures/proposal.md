## Why

On a phone the map's panels are hard to open, close and get out of the way:

- The collapsed layers sheet shows only the word "Calques" and a 4 px grabber:
  nothing says it opens, and turning a layer on or off always means opening it.
- Opened, the sheet stops at 46 % of the screen, which cuts the Bus section off,
  or at 88 %, which leaves its lower half empty: the controls need about 60 %.
- Tapping or panning the map leaves the sheet open; the only way to close it is
  to aim for the grabber.
- The Explore results sheet is fixed at half height. It cannot be lowered to see
  the circle or raised to read every result.
- A tapped bus line or stop opens a 320 px MapLibre popup next to the tap. On a
  390 px screen it is often cut off at the edge, cannot scroll, and covers the
  map, while a tapped hike opens as a sheet.
- The phone's back button leaves the site instead of closing what is open.
- After a search result is picked, the search field stays open over the dock.
- The large zoom number takes the bottom-left corner of a small screen and
  shows through under the Explore radius card.

## What Changes

- **Sheets fit their content.** The half and full heights become caps: a sheet
  is never taller than its content, so a short sheet has one open height and a
  long one stops where its content ends.
- **The map gets the sheet out of the way.** Panning the map, or tapping it away
  from any feature, lowers the persistent sheet and the Explore results to their
  collapsed height, and closes a transit sheet.
- **Back closes before it leaves.** While a sheet is open, or a transient sheet
  is shown, the browser's back action closes it instead of leaving the page.
- **Explore results can be lowered and raised** like any other sheet. Lowered,
  they show their summary line and "Changer le rayon".
- **Line and stop details open in a transient sheet on phones**, full width and
  scrollable, like a tapped hike. Desktop keeps the map popup.
- **The collapsed layers sheet carries quick toggles**: curated hikes, GR,
  trains and buses, with a "Calques" button that opens the full panel. Tapping
  a toggle changes the layer without opening the sheet.
- **The search field closes once a result is picked**, on phones.
- **No zoom number on phones.** The scale bar stays.
- The spec for the mobile basemap switcher is corrected: it has been an inline
  row of thumbnails in the layers sheet, not a floating pill, since the single
  sheet was introduced.

## Capabilities

### Modified Capabilities

- `responsive-ui`: content-fitted sheet heights, map gestures and back action
  close sheets, chrome budget without the zoom readout.
- `map-chrome`: the persistent sheet's collapsed head carries quick toggles;
  transit sheets join the transient sheets; a map tap lowers the persistent sheet.
- `map-viewer`: controls sheet peek content; zoom readout desktop-only; scale bar
  on phones; basemap switcher description corrected.
- `explore-mode`: the results sheet can be lowered and raised.
- `public-transit`: line and stop details as a transient sheet on phones.
- `place-search`: picking a result closes the field on phones.

## Impact

- `src/components/BottomSheet.tsx` / `.module.css`: content-fitted heights,
  snap points deduplicated, map-gesture and back-action handling.
- `src/lib/mapGestures.ts`, `src/lib/backStack.ts` (new): a map tap/pan signal
  and a history-backed close stack.
- `src/components/MobileSheet.tsx`, `src/App.tsx`: quick-toggle head.
- `src/transit/TransitPopup.tsx`: sheet on mobile.
- `src/features/explore/ExplorePanel.tsx`: snap state for the results sheet.
- `src/features/search/store.ts`: collapse on select.
- `src/components/ZoomLevelReadout`, `src/styles.css`: no readout on mobile.
- Desktop is unchanged.
