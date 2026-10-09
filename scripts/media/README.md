# README media

The animations and screenshots in `docs/media/` are generated from the real
app by the scripts in this folder. When the interface changes, regenerate them
rather than editing the images by hand.

```bash
npm run media                # everything
npm run media -- explore bus # just these scenes
```

Scenes: `explore`, `gpx` (animations), `bus`, `hike`, `satellite`, `phone`
(stills). A full run takes a few minutes on a laptop, about 15 on a slow
single-board computer. Each output lands in `docs/media/<scene>.webp`; check
them, then commit.

## What you need

- The datasets: `npm run data:download` (or your own `npm run build:data`).
- Chrome or Chromium. The scripts look in the usual places; set `CHROME_PATH`
  if yours is elsewhere.
- `ffmpeg` built with libwebp (`ffmpeg -encoders | grep libwebp_anim`). Debian
  and Homebrew builds have it.
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
  to arrive, then takes a screenshot, and the frames are played back at 30 fps.
  However long a frame takes to capture, the result is smooth.
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
