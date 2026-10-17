## Why

The app has no icon: browser tabs, bookmarks and phone home screens show a
generic page, and the README has a commented-out slot waiting for a logo. A
mountain-and-train mark was designed in a small icon studio; it should ship with
the app, and stay editable by contributors.

## What Changes

- Favicons (ICO, SVG, 16/32 px PNG), an Apple touch icon, 192/512 px home-screen
  icons and a maskable icon in `public/`, with a web app manifest
  (`site.webmanifest`, relative paths so it works under `/trail-by-train/`) and
  the forest-green `theme-color`, all linked from `index.html` through
  `%BASE_URL%`.
- The logo heads the README (`docs/media/logo.svg`).
- The icon studio (`tools/favicon-studio/`, `npm run icons`) is committed with
  the design file the icons were made from; CONTRIBUTING explains how to change
  them. The studio is a development tool, not part of the built app.

## Non-goals

- No offline support or service worker: the manifest only makes the app
  installable where browsers allow it.
- No logo inside the map chrome.

## Impact

`index.html`, `nginx.conf` (manifest MIME type), `README.md`, `CONTRIBUTING.md`,
`package.json` (`icons` script);
new files in `public/`, `docs/media/` and `tools/favicon-studio/`. New
`app-identity` capability.
