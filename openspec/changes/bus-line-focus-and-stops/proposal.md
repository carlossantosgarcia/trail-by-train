## Why

Bus lines and stops were drawn and described in several inconsistent ways: a
line had one colour on the map, another in its popup and a third in Explore;
stops crowded the map from zoom 9 and caught taps meant for lines; "Voir le
tracé" highlighted a line but left it unnamed once the popup closed, and only
framed the part of it already loaded, so it took several taps to see a long
line whole; and the popup gave a line's two ends but not where it stops. This
is the last large piece to settle before calling the app a beta.

## What Changes

- One colour rule: a line looks the same on the map as in its card, its
  chips and the focus bar: the network's colour (or the user's), or its
  Explore palette colour while Explore draws it. GTFS route colours are no
  longer shown.
- Zoom phasing: lines at every zoom; stops, as white dots ringed in the
  line's colour, and line-number pills from zoom 12; stop names from zoom 14.
  Booking is no longer marked on the map, only in the cards.
- Tapping a line opens its card **and focuses it**: the line is drawn bold
  over a white casing with its stops from zoom 8 and their names from zoom
  11; every other line, stop and number steps back. A **focus bar** names
  the focused line while its card is closed, reopens the card, or lets the
  line go; a tap on empty map lets it go too.
- The line card is rebuilt: the route on a rail in the line's colour, from
  terminus to terminus, unfolding into the stops in calling order with a
  choice between the line's variants and "Sens inverse"; a stop in that list
  opens the stop's card on the map; one tile per day type; the booking pill
  only when the status is known; caveats gathered in one notes block;
  "Cadrer la ligne" and "Horaires" actions.
- "Cadrer la ligne" replaces "Voir le tracé sur la carte": it frames the
  whole line in one move, clear of the focus bar, and puts the card away.
- The card never grows past the visible map: a long stop list scrolls inside
  it, and the map pans so the whole card shows.
- The stop card lists its lines as rows, with a phone beside each line that
  must be booked.
- The transit build writes `line-stops.json` per network: each line's stops
  in calling order, folded into variants, and its full extent.
- Explore: matched lines show their stops from zoom 12; a first tap on a
  line chip focuses and frames the line, a second opens its card.

## Capabilities

### Modified Capabilities

- `public-transit`: emitted data, map layers, line and stop cards, focus,
  framing, the phone sheet.
- `transit-reservation-status`: the reservation pill only shows a known
  status.
- `explore-mode`: matched lines' stops, chip taps.

## Impact

- `scripts/transit/build.mjs`, `scripts/transit/lib/line-stops.mjs` (new),
  `scripts/transit/lib/stops.mjs`: `line-stops.json`; `BUILD_VERSION` 6, so
  every network is rebuilt on the next data run. Until then the cards show
  only the two ends, and framing falls back to what the tiles hold.
- `src/transit/`: `transitOverlay.ts`, `TransitPopup.tsx`, `FocusBar.tsx`
  (new), `lineColors.ts` (new), `lineStops.ts` (new), `highlightStore.ts`.
- `src/components/map/`: `transitInteractions.ts`, `useTransitLayers.ts`,
  `useExploreMap.ts`; `src/lib/popupPlacement.ts`.
- `src/features/explore/`: `exploreMapLayers.ts`, `ExplorePanel.tsx`.
- Strings in `src/i18n/`.
