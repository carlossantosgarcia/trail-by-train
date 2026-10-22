## Why

A hike card shows its effort km and Naismith time, but nothing on it says
what they mean. The explanation existed only behind the GPX profile's chips,
so a hiker reading a curated hike had no way to find it.

## What Changes

- A "?" button after each effort metric's name on the hike card, on desktop
  and in the mobile sheet, opens the metric's explanation (definition,
  formula, the hike's values, reference, limitations).
- On desktop the explanation opens beside the hike card when the window has
  room, level with it, rather than over it.
- The explanation is drawn at the page's top level and capped to the room it
  has, so a map card or a phone sheet never clips it; a drag inside it no
  longer moves the phone sheet under it.

## Capabilities

### Modified Capabilities

- `curated-hikes`: the popup's metrics explain themselves.

## Impact

- `src/features/curated-hikes/HikePopup.tsx` and its CSS: the "?" buttons.
- `src/features/gpx/MetricPopover.tsx`: rendered on the body, sized to fit
  the viewport.
- `src/features/gpx/metricInputs.ts` (new): the "Values used" rows, moved
  out of `ElevationProfile.tsx` to be shared.
- `src/i18n`: the button's accessible name, `metric.help`.
