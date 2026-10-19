## Context

The app is a static SPA whose chrome is a top-left Tracks dock (search,
Explore, open GPX, track list), a controls panel on desktop and one bottom
sheet on mobile. Modal surfaces already exist: the feedback form is a native
`<dialog>` opened from a small store. Per-browser preferences live in
`localStorage` behind `read*/write*` helpers that swallow storage errors.

## Goals / Non-Goals

**Goals:**

- Show a first-time visitor, in under a minute, what Explore does, what the
  train and bus layers are, and that a hike collection exists.
- Pictures first: an animation, pictograms, a few words per step.
- Same tutorial on desktop and phone, each with media made for its screen.
- Never shown twice on its own; always reachable from the dock.

**Non-Goals:**

- No guided tour that highlights live controls (coach marks): it breaks as
  soon as the layout moves, and the dock differs between viewports.
- No translations: the interface is French, so is the tutorial.
- No analytics on whether the tutorial was skipped or finished.

## Decisions

- **A native `<dialog>`, like the feedback form.** It gets focus trapping,
  Escape and the top layer for free and matches an existing surface. On
  mobile it becomes a bottom-anchored sheet filling most of the height,
  styled with the same tokens. A tiny store (`openTutorial`/`closeTutorial`)
  lets the dock button and the first-visit check open it.
- **One storage key, versioned.** `tutorial.seen` holds the tutorial version
  (`1`). Writing happens on close, whatever closed it: a user who dismisses
  it has decided. A later, materially different tutorial can bump the
  version to show itself once more. Storage that throws (private mode)
  degrades to "not seen", i.e. the tutorial may reopen per visit, which is
  acceptable and matches the other helpers.
- **First visit opens on mount, after the map has started.** The dialog
  opens from an effect so the map behind it is already drawing; it is not
  opened while Explore mode is active.
- **Dedicated media rather than the README hero.** `docs/media/explore.webp`
  is 1.6 MB and drawn inside a browser frame, which looks wrong in a dialog
  and is heavy on mobile data. Two new scenes reuse `explore.mjs`'s choreography:
  `tutorial` (desktop viewport, no frame, scaled to 640 px) and
  `tutorial-phone` (the 393×708 phone viewport, touch-drawn lasso). Each also
  writes a still of its last frame as the reduced-motion poster. The files go
  to `public/tutorial/` so Vite serves them under the base path. A
  `<picture>` picks the phone clip at the mobile breakpoint; the image is
  only rendered while the first step is shown, so nothing is fetched until
  the tutorial opens.
- **Reduced motion shows the poster.** `prefers-reduced-motion: reduce`
  swaps the animated WebP for its still, in line with the global
  reduced-motion rule.
- **Everything from the real app.** Explore and GPX are what the app does
  over time, so they are recorded; trains/buses is a screenshot of the app
  (weekend filters on, so the map is readable, and a line's card open). The
  GPX clip opens a track, shows it in the dock's list, scrubs its profile,
  then searches Saoû, at its far end: picking a place opens Explore around
  that point, and the clip brings the radius in to 4 km on its slider, so
  the result is the village's buses. On a phone the profile sheet covers the
  track, so the clip frames it above the sheet before scrubbing; the app's
  own framing is unchanged. The track is a copy of a test GPX renamed to a plain
  "Crest – Saoû", since the app shows the file's own name.
- **Close-ups by the recorder, not the app.** Both clips open close up on
  the button they press, then pull back: the recorder screenshots a smaller
  part of the page at a larger scale (Puppeteer's clip scale), so the
  close-up stays sharp and every frame keeps the page's size. Each frame
  waits for the map's tiles to be decoded and drawn: the canvas keeps its
  buffer for the capture and is checked for see-through pixels before each
  screenshot, so a flight shows no blank or half-drawn patches. The Explore
  zone surrounds one station with few buses (Luc-en-Diois), so the results
  read at a glance.
- **Touch-ups on the transit still, in the script.** To make the clicked
  line stand out, the capture pales the raster basemap and draws that line
  thick in its card's chip colour, as a layer of its own from the same
  tiles. The line is the D52 (Crest – Saoû – Bourdeaux), chosen because it
  keeps away from the railway, where a line along the tracks would hide in
  them. It has no colour of its own, so its chip is white: the capture then
  uses the line's map colour for both. Nothing changes in the app.
- **The hike map: a capture plus a drawn trace.** The media script exposes
  the app's map from the React fiber of its container (no hook in the app),
  frames a station-to-station hike from `test_data/` (Alès to Chamborigaud,
  not a curated hike), captures the bare satellite map with its railways, and
  writes the hike's trace, a moving average sampled to ~200 points, projected
  to the capture's pixels (`hike-trace-<layout>.json`). The tutorial draws
  that trace and its A/B ends over the image like the curated-hikes layer
  does, in an orange (`--illus-hike`) that holds on imagery, so the line reads
  as an illustration without misplacing anything.
- **Video, not animated images.** The clips are muted, looping,
  inline-playing H.264 MP4s: an animated WebP of a map flight is two to three
  times larger (2.5 MB against 950 kB for the GPX take). They look like GIFs,
  play on every current browser and keep a WebP still for reduced motion.
- **Clips per language.** Each scene is captured with `UI_LANG=fr` and `en`
  (`lib.mjs` holds the few labels the scenes click by); the step picks
  `<base>-<layout>-<lang>.mp4` from the current language and viewport.
- **The layer toggles, not new pictograms.** Step 2 shows the train and bus
  toggles by composing `OverlayToggle`'s own classes in their "on" state, so
  they cannot drift from the controls.
- **GPX from the tutorial.** The dock's picker logic moves to
  `gpx/pickFiles.ts`; the step's button feeds the same function.
- **No hike count, no hike picked out.** Step 4 says what these hikes are,
  not how many there are, and shows the curated-hikes toggle as step 2 shows
  the train and bus ones, with a line on it and one on the hike card. It has
  no button of its own: one that flew to "the" hike only made sense while the
  collection held one, so the step needs no edit as it grows.
- **Navigation.** Next/back buttons, step dots, arrow keys, and horizontal
  swipe on touch. The language switch and "Passer le tutoriel" share a bar above the
  picture, so neither covers a clip.
  "Passer le tutoriel" closes from any step; the last step's primary button is
  "C’est parti !".
- **The help button** is an icon-only secondary action (Lucide
  `circle-help`; on a phone, where the button is a round tile, the question
  mark alone, larger),
  with the accessible name "Comment ça marche" ("How it works"), placed last in the dock's action
  row, after Explore and the GPX open action, so the actions a visitor came
  for come first.

## Risks / Trade-offs

- [The animations go stale when the interface changes] → they come from the
  same scripted pipeline as the README media and are regenerated with
  `npm run media -- tutorial tutorial-phone tutorial-gpx tutorial-gpx-phone
  tutorial-stills`.
- [A modal on first load hides the map] → one tap closes it for good, and it
  is the only time it opens unasked.
- [Media weight] → capped by encoding at 640 px wide (desktop) and 360 px
  (phone), lossy quality; fetched only when step 1 is visible.
