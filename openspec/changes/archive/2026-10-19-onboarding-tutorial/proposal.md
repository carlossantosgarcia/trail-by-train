## Why

A first visit lands on a map full of lines with no hint of what the app is for
or where to start. Explore, the main feature, is one button among others, and
nothing says that the coloured lines are buses, that the network is refreshed
weekly, or that the hike collection exists and is only beginning. A short,
visual introduction shown once, and reachable again later, answers that
without adding text to the map itself.

## What Changes

- A **tutorial** dialog of four short, picture-led steps, every picture taken
  from the app itself, in the interface language:
  1. **Explorer**: a clip that opens close up on the Explore button, pulls
     back, and draws a zone around one station to get its buses, stations
     and hikes (a desktop take, or a phone one on mobile), with the Explore
     button as the call to action.
  2. **Trains et bus**: a screenshot of the app between Crest and Bourdeaux
     with the weekend filters on and the card open of a line that keeps away
     from the railway, the line picked out in its card's colour; then the train and bus layer toggles as the controls show them,
     one line each, and how to read a line or a stop.
  3. **Repérez les transports près de votre trace GPX**: a clip that opens a track from the dock,
     shows it in the track list, reads its elevation profile with the track
     in view and explores a few kilometres around Saoû, at its far end, and a button that opens the file picker.
  4. **Randonnées**: a satellite capture around a station-to-station hike
     with its smoothed trace and A/B ends, one line on what these hikes are
     (no count, so it never needs updating), and the curated-hikes layer
     toggle with a line on what it does and on what a hike's card gives.
- The language switch and "Passer le tutoriel" sit in a bar above the picture.
- The tutorial opens by itself on a first visit. Closing it by any means
  (skip, finish, Escape, backdrop) records that it was seen in `localStorage`,
  so it does not open again on that browser. It is never sent anywhere.
- A **help button** (a question mark in a circle) to the right of the
  Explore and GPX buttons in the dock
  reopens the tutorial at any time, on desktop and mobile.
- The README media pipeline gains the tutorial's scenes: the Explore and GPX
  clips on desktop and phone, in French and English, as small muted MP4s with
  still posters for reduced motion, and the two stills.
  Every scene marks the tutorial as seen so it does not cover the captures.

## Capabilities

### New Capabilities

- `onboarding-tutorial`: the tutorial's steps, when it opens on its own, how
  "seen" is stored, how it is reopened, and how it behaves on mobile and with
  reduced motion.

### Modified Capabilities

- `map-chrome`: the Tracks dock also holds the help action, right of the
  Explore entry and the GPX open action.

## Impact

- New `src/features/tutorial/` (store, storage, dialog, steps).
- `src/components/TracksDock.tsx`: help action; `src/App.tsx`: mounts the
  dialog.
- `scripts/media/`: `tutorial` scenes and `open()` marks the tutorial seen.
- New committed media under `public/tutorial/` (0.4–1.5 MB per clip, about
  0.1 MB per still, each fetched only when its step shows).
- No new dependency, no data or workflow change.
