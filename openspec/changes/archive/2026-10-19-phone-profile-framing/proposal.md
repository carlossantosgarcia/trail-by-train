## Why

On a phone, the elevation profile is a segment of the bottom sheet. Opened,
the sheet covers the lower half of the map, and with it part of the track
it charts: the marker that follows a finger along the profile moves out of
sight, and the map does not move to show it.

## What Changes

- Opening the Profil segment, or opening the sheet on it, frames the
  selected track in the part of the map above the sheet, once the sheet has
  risen.
- A track already whole above the sheet is left where it is, so switching
  back and forth does not move the map.
- The tutorial's phone GPX clip records this framing instead of making its
  own.

## Capabilities

### Modified Capabilities

- `responsive-ui`: the open profile keeps its track in view.

## Impact

- `src/components/MobileSheet.tsx`: frames the selected track when the
  profile shows.
- `src/features/gpx/store.ts`, `src/components/map/useGpxTracks.ts`: a zoom
  request can carry a bottom inset and leave a track already in frame.
- `scripts/media/gpx-tour.mjs` and the phone GPX clips under
  `public/tutorial/`.
