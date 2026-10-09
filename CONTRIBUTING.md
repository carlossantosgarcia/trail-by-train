# Contributing to Trail by Train

Thanks for wanting to help. Whether you spotted a wrong bus time, know a
network we're missing, or want to build a feature, you're welcome here.

## Ways to help, no code needed

- **Something looks wrong on the map?** A bus line that doesn't run any more, a
  station in the wrong place, a trail that's been rerouted:
  [open an issue](https://github.com/carlossantosgarcia/trail-by-train/issues/new?template=bug.yml)
  with a link to the spot on the map.
- **A bus network is missing?** If it serves trailheads,
  [tell us about it](https://github.com/carlossantosgarcia/trail-by-train/issues/new?template=new-network.yml).
  A link to its timetable data is the most useful thing you can add.
- **Walked a hike that starts from a station or a bus stop?** Share it, see
  [Sharing a hike](#sharing-a-hike) below.

## Getting set up

You need [Node.js](https://nodejs.org/) 20 or later.

```bash
git clone https://github.com/carlossantosgarcia/trail-by-train.git
cd trail-by-train
npm ci
npm run data:download
npm run dev
```

The app opens at <http://localhost:1002> and reloads as you edit.

Before you open a pull request, run the same checks as CI:

```bash
npm run lint && npm run format:check && npm test && npm run bench:elevation && npm run build
```

For anything bigger than a fix, open an issue first so we can agree on the
approach before you spend time on it.

## Adding a bus network

Most networks publish their timetables as GTFS on
[transport.data.gouv.fr](https://transport.data.gouv.fr/). Pick one with an open
licence (ODbL or Licence Ouverte) whose files include `shapes.txt`, the
routes' geometry.

1. Add an entry to
   [`scripts/transit/providers.config.mjs`](scripts/transit/providers.config.mjs).
   Copying the entry of a neighbouring network is the easiest start. Give it a
   colour that differs from the networks next to it.
2. Build it with `npm run build:transit -- <id>` and check it with
   `npm run dev`.

That's all: the map picks it up from the config, and once merged the weekly
data run keeps it up to date.

## Sharing a hike

Hikes live in [`public/curated/manifest.json`](public/curated/manifest.json).
The Vercors hike from Die station is a good example to copy.

1. Put your GPX in `public/curated/tracks/`.
2. Add an entry to the manifest with `"source": "community"`, a title, where
   it starts and ends, the distance and climb, and
   `"track": { "gpx": "curated/tracks/<file>.gpx", "license": "CC-BY-4.0" }`.
3. Check it on the map with `npm run dev`.

Share hikes you walked yourself. By adding the track you agree to publish it
under CC-BY 4.0, so others can use it with credit.

## How the code is organised

| Where                    | What                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `src/components/Map.tsx` | Creates the map and adds every layer, in the order they're drawn          |
| `src/components/map/`    | One hook per part of the map: buses, your tracks, Explore, search…        |
| `src/features/`          | Each feature's state, panels and popups (GPX, hikes, Explore, search, GR) |
| `src/transit/`           | Everything about bus networks in the app                                  |
| `scripts/`               | The scripts that build each dataset from its source                       |
| `openspec/specs/`        | How each part of the app is meant to behave                               |

Larger changes start as a short proposal in `openspec/changes/`, reviewed with
the code. See [OpenSpec](https://openspec.dev/) for the format. Small fixes don't
need one.

<details>
<summary>Design conventions</summary>

- **Tokens.** Every colour, size, spacing and z-index is a CSS variable in
  `src/tokens.css`. Stylesheets use `var(--…)` and no literal values.
- **Panels.** Floating panels share one surface,
  `composes: surface from '../styles/surface.module.css'`. MapLibre popups get
  the same look from `styles.css`; keep the two in step.
- **Themes.** Light and dark are applied as `data-theme` on `<html>` before the
  first paint. Canvas drawings read colours with `readToken()` from
  `src/lib/useTheme.ts`.
- **Contrast.** `npm run lint` checks text contrast in both themes, over both
  the lightest and darkest basemaps. Prefer a more opaque surface over darker
  text, and never lower a threshold to make the check pass.
- **Mobile.** One bottom sheet (`src/components/BottomSheet.tsx`) holds the
  controls; popups opened from the map use it with `variant="transient"`.
- **Tile servers.** OpenTopoMap and OpenStreetMap run on donations: no
  prefetching or bulk downloads.

</details>

<details>
<summary>Updating the README screenshots</summary>

The images and animations in `docs/media/` are generated from the app. If your
change alters what they show, run `npm run media` (or `npm run media -- gpx`
for one scene) and commit the new files with your change. It needs Chromium
and ffmpeg; see [`scripts/media/README.md`](scripts/media/README.md).

</details>

<details>
<summary>Troubleshooting</summary>

**`EMFILE: too many open files` when running `npm run dev`.** Vite watches many
files at once. Run `ulimit -n 8192` first. If that's not enough, raise the
inotify limits:

```bash
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches
echo 512    | sudo tee /proc/sys/fs/inotify/max_user_instances
```

</details>

## Code of conduct

Be kind, assume good intent, and remember there's a person on the other side of
every issue and review.
