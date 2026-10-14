## Why

Line, stop and hike details sometimes open partly hidden. On phones, content a
little taller than the half snap point opened cut off until a drag carried the
sheet to full. On desktop, MapLibre places a popup below the point whenever the
point is within one popup-height of the map's top, without checking it fits
there, and measures against the whole map, which runs under the docks: a tall
popup hung under the elevation dock until a zoom flipped it above.

## What Changes

- A sheet whose content overflows half by at most 30 % of half opens whole:
  half is raised to the content for that sheet, and half and full merge.
- Desktop popups (bus line, stop, hike) choose their side from the visible part
  of the map: above the point if they fit there, below if they fit there,
  otherwise where there is more room; shifted sideways near a side dock.
  Re-placed on every map move and when their content changes size.

## Impact

`BottomSheet.tsx`; new `src/lib/popupPlacement.ts` (+ tests), used by
`TransitPopup.tsx` and `HikePopup.tsx`; the elevation dock is marked
`data-map-chrome="bottom"` so its real height is measured.
