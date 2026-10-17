# app-identity Specification

## Purpose
TBD - created by archiving change app-icons. Update Purpose after archive.
## Requirements
### Requirement: The app carries its icon everywhere a browser shows one

The site SHALL ship a favicon in ICO and SVG form, an Apple touch icon, and a web
app manifest naming the app "Trail by Train" with 192 px and 512 px icons and a
separate maskable icon, all linked from `index.html`. Every icon and manifest
link SHALL resolve under the configured base path, and the manifest SHALL use
paths relative to itself. Home-screen icons SHALL have an opaque square
background, leaving the device to apply its own shape.

#### Scenario: Browser tab
- **WHEN** the app is opened in a desktop browser
- **THEN** the tab and bookmarks show the Trail by Train icon rather than a generic page

#### Scenario: Deployed under a sub-path
- **WHEN** the app is built with a base path such as `/trail-by-train/`
- **THEN** the favicon, touch icon and manifest load from under that path, and the manifest's start URL, scope and icons resolve within it

#### Scenario: Added to a phone's home screen
- **WHEN** a hiker adds the app to their home screen
- **THEN** the launcher shows the Trail by Train icon, uncropped on launchers that apply a mask

### Requirement: Icons are reproducible from a committed design

The logo, favicons, home-screen icons and manifest SHALL be produced by the icon
studio in `tools/favicon-studio/` from a design file committed next to it. The
studio SHALL run locally without network requests or new dependencies, and SHALL
NOT be linked from or bundled into the built app.

#### Scenario: A contributor changes the icon
- **WHEN** a contributor runs `npm run icons` and loads the committed design file
- **THEN** the studio shows the current icon, and its exported kit replaces every icon file and the manifest

#### Scenario: The studio stays out of the app
- **WHEN** the app is built
- **THEN** `dist/` contains the icons but not the studio

