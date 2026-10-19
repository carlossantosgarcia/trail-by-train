## 1. Tutorial feature

- [x] 1.1 `lib/tutorialStorage.ts`: versioned `tutorial.seen` read/write, storage errors swallowed
- [x] 1.2 `features/tutorial/store.ts`: open/close store; closing records the tutorial as seen
- [x] 1.3 `TutorialDialog`: native `<dialog>`, steps, dots, Précédent/Suivant/Passer, arrow keys, swipe
- [x] 1.4 Step 1: `<picture>` with desktop/phone animation, reduced-motion poster, Explore button
- [x] 1.5 Step 2: rail and bus pictograms with one line each
- [x] 1.6 Step 3: hike count from the manifest, "Voir sur la carte" turning the curated layer on
- [x] 1.7 Mobile: bottom sheet, 44 px targets, fits the viewport height

- [x] 1.8 Second pass after review on a preview: transit step redrawn in the map's marks (rails, station plate, bus lines and stops, a filled-in line card), toggles as in the controls, no network count
- [x] 1.9 GPX step: track with A/B ends, nearby bus line, elevation panel; its button opens the picker (`gpx/pickFiles.ts`)
- [x] 1.10 Hikes step drawn with the same railway; language switch in the tutorial

- [x] 1.11 Third pass: Explore and GPX clips per language; GPX clip (open, fly, profile, explore an end); contour maps with the app's railway symbol, named stations and stops on their lines; stop card; hike from Die to Clelles-Mens

- [x] 1.12 Fourth pass: transit step is a screenshot of the app (weekend filters, Topo, a line's card); hike step is a capture of the map around Alès–Chamborigaud with the smoothed trace drawn over it; drawings removed
- [x] 1.13 Fifth pass: language and skip in a bar above the picture; clips open close up; transit line paled and picked out; GPX track list with a plain name; satellite hike map, no hike count
- [x] 1.14 Sixth pass: hikes step shows the layer toggle instead of a button; a bus line off the railway (D52); GPX clip framed above the phone sheet, Explore around Saoû at 4 km; info icon letter larger and centred
- [x] 1.15 Seventh pass: French texts reworded, English rewritten to read naturally; one transit note for click and tap; no blank tiles in the clips
- [x] 1.16 Eighth pass: the help button shows a question mark in a circle and sits after Explore and the GPX action; clips and stills re-recorded; final French and English texts

## 2. Chrome

- [x] 2.1 Lucide `circle-help` icon and the help action after Explore and the GPX action in `TracksDock`
- [x] 2.2 `App.tsx`: mount the dialog, open it on a first visit outside Explore

## 3. Media

- [x] 3.1 `open()` marks the tutorial seen for every scene
- [x] 3.2 `tutorial`, `tutorial-phone`, `tutorial-gpx`, `tutorial-gpx-phone`, `tutorial-stills` scenes, French and English: unframed animation + still poster into `public/tutorial/`
- [x] 3.3 Generate and commit the media; document the scenes in `scripts/media/README.md`

## 4. Verification

- [x] 4.1 `npm run lint`, `npm test`, `npm run build`
- [x] 4.2 Unit test for the storage helper (version, unreadable storage)
- [x] 4.3 Check on a preview: first visit, skip, reload, help button, phone layout
