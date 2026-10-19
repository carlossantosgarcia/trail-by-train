# README media

The animations and screenshots in `docs/media/` are generated from the real
app by the scripts in this folder. When the interface changes, regenerate them
rather than editing the images by hand.

```bash
npm run media                # everything
npm run media -- explore bus # just these scenes
```

Scenes: `explore`, `gpx` (animations), `bus`, `hike`, `satellite`, `phone`
(stills), and `tutorial`, `tutorial-phone`, `tutorial-gpx`,
`tutorial-gpx-phone`, `tutorial-stills` for the app's first-visit tutorial. A full run takes a
few minutes on a laptop, about an hour on a slow single-board computer. Each
README output lands in `docs/media/<scene>.webp`; check them, then commit.

Captures use the French interface unless `UI_LANG=en` is set; `lib.mjs` holds
the few button labels the scenes look for, in both languages. The tutorial
scenes record each take twice, in French and English, and write to
`public/tutorial/`, which the app serves, as muted looping MP4s:
`explore-<layout>-<lang>.mp4` (`explore-tutorial.mjs`: a close-up on the
Explore button, a pull-back, a zone around one station) and
`gpx-<layout>-<lang>.mp4` (`gpx-tour.mjs`: open a track, see it in the list,
read its profile, explore 4 km around Saoû at its far end), each with a
`-still.webp` of its last frame for reduced motion. `tutorial-stills`
(`tutorial-stills.mjs`) writes `transit-<layout>-<lang>.webp`, a screenshot of
the transit layers with the D52's card open, a line away from the railway
(basemap paled and the line drawn in its card's colour, by the script), and `hike-map-<layout>.webp`, the bare
satellite map around a station-to-station hike, with the hike's smoothed trace in
those pixels as `src/features/tutorial/hike-trace-<layout>.json`. Every scene marks the
tutorial as seen, so it never covers a capture.

## What you need

- The datasets: `npm run data:download` (or your own `npm run build:data`).
- Chrome or Chromium. The scripts look in the usual places; set `CHROME_PATH`
  if yours is elsewhere.
- `ffmpeg` built with libwebp and libx264 (`ffmpeg -encoders | grep -E
  'libwebp_anim|libx264'`). Debian and Homebrew builds have both.
- On Linux, `curl` and `unzip`: the first run downloads the
  [Inter](https://rsms.me/inter/) font into `scripts/media/.cache/`, so the
  app's system font stack renders as it would on macOS or Windows rather than
  as DejaVu Sans.

## How it works

`build.sh` builds the app, serves it on port 4321 (`PORT` to change it),
drives Chromium with Puppeteer, then puts each capture into a frame and
encodes it with ffmpeg.

- **Smooth animations, even on a slow machine.** The page's clock
  (`performance.now`, `Date.now`, `requestAnimationFrame`) is frozen and
  advanced one frame at a time. After each step the script waits for map tiles
  to arrive and be drawn, then takes a screenshot, and the frames are played
  back at 30 fps. However long a frame takes to capture, the result is smooth.
- **No blank tiles.** The map's WebGL canvas keeps its buffer
  (`preserveDrawingBuffer`, forced by `open`), and before each screenshot the
  recorder checks the canvas has no see-through pixel, the mark of a tile not
  drawn yet (the style has no background); if it has, it waits a little more.
  Close-ups are captured within the viewport (`captureBeyondViewport: false`):
  Puppeteer otherwise resizes the page for a clipped shot, which can blank the
  map in that frame.
- **A visible cursor.** Headless Chromium draws none, so `lib.mjs` overlays an
  arrow, with a ripple on each click, that follows the scripted mouse.
- **Frames.** `frame.mjs` draws the browser window and `phoneframe.mjs` the
  iPhone, each with a transparent hole that the capture is placed under.
- **The zoom readout is hidden.** The large zoom number in the bottom-left
  corner is useful in the app but noise in a picture.

## Changing a scene

Each scene is a short script: `explore.mjs`, `gpx.mjs`, and `stills.mjs` for
the four stills. The framings are plain numbers in screen pixels (where the
zone is drawn, where the bus line is clicked). If the layout moves, adjust
them, run that one scene, and look at the result.
