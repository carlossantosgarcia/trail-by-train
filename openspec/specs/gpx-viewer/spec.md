# gpx-viewer Specification

## Purpose
Viewing your own GPX tracks: loading them, drawing them on the map, their elevation profile, distance and climb, and effort estimates.
## Requirements
### Requirement: Load GPX files via drag-and-drop and file picker

The application SHALL accept GPX files from the user via two equivalent
input paths: drag-and-drop onto the map surface, and a file-picker button.
Both `<trk>` tracks and `<rte>` routes SHALL be accepted as loadable
geometry; a file SHALL be rejected as unusable only when it yields no
line geometry at all.

#### Scenario: Drop a GPX file onto the map

- **WHEN** the user drags a `.gpx` file from their desktop onto the map
- **THEN** the application MUST recognise the drag, show a translucent
  drop-target overlay while the drag is active, accept the file on drop,
  parse it, add it as a new track, and render its line on the map within
  one second for files up to 5,000 points

#### Scenario: Opening a file frames it

- **WHEN** one or more GPX files finish loading
- **THEN** the map MUST animate to frame every track just loaded, padded clear of
  the docks and the elevation panel, wherever the map was before

#### Scenario: Open a GPX file via the file-picker button

- **WHEN** the user clicks the "Open .gpx" button and selects one or more
  `.gpx` files
- **THEN** the application MUST load every selected file as a new track
  with the same behaviour as a drag-and-drop

#### Scenario: Non-GPX files are rejected

- **WHEN** the user drops a file whose extension is not `.gpx` or whose
  contents cannot be parsed as GPX
- **THEN** the application MUST surface a clear error message
  (e.g. "Could not read <filename>: not a valid GPX file") and MUST NOT
  alter the existing loaded tracks

#### Scenario: A route-only GPX file loads as a track

- **WHEN** the user loads a `.gpx` file whose only line geometry is one or
  more `<rte>` routes, with no `<trk>` element
- **THEN** the application MUST load it as a track and render its line,
  exactly as it would for an equivalent `<trk>` file

#### Scenario: Routes and tracks in the same file

- **WHEN** a `.gpx` file contains both `<trk>` and `<rte>` line geometry
- **THEN** the application MUST load all of it, and MUST NOT silently drop
  either kind

#### Scenario: A file with no line geometry is rejected

- **WHEN** the user loads a `.gpx` file that parses as valid GPX but
  contains only waypoints, with no `<trk>` and no `<rte>`
- **THEN** the application MUST surface an error message stating that the
  file contains no track or route geometry, and MUST NOT alter the
  existing loaded tracks

#### Scenario: A loaded track records whether it came from a route

- **WHEN** a track is loaded from `<rte>` geometry
- **THEN** the application MUST retain that distinction on the feature so
  the UI can present a planned route differently from a recorded track

### Requirement: Render tracks on the map

The application SHALL render each loaded track as a coloured line on the
map, layered above the active basemap. The hover marker that mirrors the
elevation-chart cursor SHALL be **visually unmissable** on every
supported basemap and SHALL take the active track's colour so the user
can read it as "this is where you are on *this* track".

#### Scenario: Track is drawn after load

- **WHEN** a track has been loaded successfully
- **THEN** its GeoJSON geometry MUST be rendered as a line on the map with
  the colour assigned to that track, visible above the active basemap,
  and with a contrasting halo so it remains legible on the satellite
  basemap

#### Scenario: Toggling track visibility

- **WHEN** the user toggles a track's visibility off in the sidebar list
- **THEN** the corresponding map line MUST be hidden without removing the
  track from the store, and MUST become visible again when toggled back on

#### Scenario: Removing a track

- **WHEN** the user removes a track from the sidebar list
- **THEN** the line MUST be removed from the map, the track MUST be deleted
  from persistent storage, and any per-track UI state (selected, hovered)
  MUST be cleared

#### Scenario: Hover marker is unmissable and track-tinted

- **WHEN** the user hovers a point on the elevation chart of the selected
  track
- **THEN** the resulting map marker MUST render with at least an enlarged
  inner dot AND a translucent halo behind it, the halo MUST be tinted with
  the selected track's colour, and the marker MUST remain visible against
  each basemap (satellite, topographic, street) without
  blending into the background

### Requirement: Track sidebar list

The application SHALL display a list of every loaded track inside the **Tracks dock** — the top-left desktop surface defined by `map-chrome`, which also hosts the GPX open action and the Explore entry as its head. The open action and the track list SHALL read as one surface, not as separate floating elements.

#### Scenario: List enumerates loaded tracks

- **WHEN** at least one track is loaded
- **THEN** the Tracks dock MUST be visible at the top-left of the map, listing every loaded track with its name, a colour swatch, a visibility toggle, and a remove control

#### Scenario: Open action heads the dock

- **WHEN** the application is rendered on desktop
- **THEN** the GPX open action and the Explore entry MUST render as the head of the Tracks dock, sharing its surface material, rather than as independently-positioned pills stacked above it

#### Scenario: Selected track is visibly distinct

- **WHEN** the user selects a track in the list
- **THEN** that row MUST be visibly distinguished from the unselected rows

#### Scenario: Rename a track

- **WHEN** the user edits a track's displayed name in the list
- **THEN** the new name MUST be persisted and the file's original name MUST be preserved as metadata for reference

#### Scenario: Recolour a track

- **WHEN** the user picks a new colour for a track via the list's colour control
- **THEN** the map line MUST update to the new colour immediately and the new colour MUST be persisted

#### Scenario: Zoom to track

- **WHEN** the user invokes the "Zoom to track" control for a track
- **THEN** the map MUST animate to a viewport that contains the track's bounding box, padded clear of the app's chrome using the geometry tokens defined by `map-chrome`

### Requirement: Persist loaded tracks across reloads

The application SHALL persist loaded tracks in the browser's IndexedDB so
they remain available after the page is closed and reopened.

#### Scenario: Tracks survive a reload

- **GIVEN** the user has loaded one or more tracks in a previous session
- **WHEN** the user opens the application again in the same browser
  profile
- **THEN** every previously-loaded track MUST be re-hydrated and rendered
  on the map without re-uploading the file

#### Scenario: Removing a track clears storage

- **WHEN** the user removes a track from the sidebar list
- **THEN** both the track's metadata and its geometry MUST be deleted from
  IndexedDB and MUST NOT reappear on next reload

#### Scenario: Storage-quota errors are surfaced

- **WHEN** a write to IndexedDB fails with a quota error
- **THEN** the application MUST show an actionable message
  ("Browser storage is full — remove some tracks to free space.") and MUST
  NOT corrupt the existing stored tracks

### Requirement: Elevation profile panel

The application SHALL display a collapsible **Details** panel along the bottom of the viewport on desktop. On mobile it SHALL instead render as the **profile segment** of the single persistent bottom sheet, in an embedded form without its own surface, positioning or fold — the sheet supplies all three — and it SHALL NOT implement a sheet of its own.

When a track is selected, the panel SHALL show — in this order, top-down — a row of **effort estimates** for the track and an **elevation profile chart** of altitude vs cumulative distance.

When the user hovers the profile chart, the application SHALL present a clearly visible **hover readout** that surfaces the key quantities at the hovered point without requiring the user to look beneath or beside the chart. The panel header SHALL be labelled "Details" to reflect that it hosts more than the chart alone.

On first paint the panel's collapsed/expanded state SHALL be driven by whether any GPX tracks are loaded: with zero tracks the panel SHALL start collapsed so the map keeps maximum real estate; with one or more tracks (e.g. a returning visitor with IndexedDB-persisted tracks) it SHALL start expanded. When the **first** track is added during a session the panel SHALL auto-expand once; subsequent additions MUST NOT re-open a manually-collapsed panel, and removing the last track MUST NOT auto-collapse it.

The chevron icon on the desktop panel handle SHALL reflect the click affordance: when the panel is collapsed the chevron SHALL point **upward** (the click opens the panel upward), and when the panel is expanded the chevron SHALL point **downward** (the click closes the panel downward).

#### Scenario: Profile panel shows the selected track

- **WHEN** the user selects a track in the Tracks dock
- **THEN** the elevation panel MUST display a line chart of that track's elevation against cumulative distance, with axes labelled (distance in km, elevation in m)

#### Scenario: Profile is a segment on mobile

- **WHEN** the application is loaded on a viewport ≤ 768px wide
- **THEN** the elevation profile MUST be reachable as the profile segment of the single persistent sheet, and MUST NOT render as a separate bottom panel competing with the sheet for the bottom edge

#### Scenario: Panel is collapsible

- **WHEN** the user clicks the desktop panel's collapse handle
- **THEN** the panel MUST collapse to a thin handle along the bottom edge, and MUST expand again when the handle is clicked

#### Scenario: Panel starts collapsed for a fresh visitor

- **WHEN** the application is first loaded with no GPX tracks persisted or otherwise present
- **THEN** the Details panel MUST render in its collapsed state, so the map fills the maximum available viewport height

#### Scenario: Adding the first track auto-expands the panel

- **WHEN** the user adds a GPX track (drag-and-drop or file picker) while the panel is collapsed AND no tracks are currently loaded
- **THEN** the Details panel MUST transition to its expanded state in the same render the new track appears in the Tracks dock

#### Scenario: Adding further tracks does not override a manual collapse

- **WHEN** the user has manually collapsed the panel while at least one track is loaded, and then adds another track
- **THEN** the panel MUST remain collapsed (no auto-expand for any transition other than 0 → 1 tracks)

#### Scenario: Removing the last track does not auto-collapse the panel

- **WHEN** the user removes the only remaining track while the panel is expanded
- **THEN** the panel MUST stay expanded (it is the user's job, not the system's, to collapse the now-empty panel)

#### Scenario: Chevron glyph matches collapsed/expanded state

- **WHEN** the desktop panel toggles between collapsed and expanded
- **THEN** the chevron rendered inside the handle MUST be `▴` while the panel is collapsed (signalling "click to open upward") and `▾` while the panel is expanded (signalling "click to close downward"), switching instantly on click without waiting for any expansion animation to settle

#### Scenario: Track without elevation data

- **WHEN** the selected track contains no elevation values (all altitudes missing or zero)
- **THEN** the elevation panel MUST show a "No elevation data" placeholder rather than an empty chart

#### Scenario: Hovering the chart highlights the map

- **WHEN** the user hovers a point on the elevation chart
- **THEN** a marker MUST appear on the map at the geographic coordinate corresponding to that distance along the track, and MUST disappear when the cursor leaves the chart

#### Scenario: Hover readout shows distance, altitude, and slope

- **WHEN** the user hovers a point on the elevation chart
- **THEN** a readout MUST be displayed in or directly adjacent to the chart (not relying solely on the uPlot default legend) that shows at least: cumulative distance from the start (km), altitude at the hovered point (m), and the local slope (% over a small along-track window). The readout MUST update on every cursor movement and MUST hide when the cursor leaves the chart

#### Scenario: Hover readout shows time and pace when timestamps are present

- **WHEN** the user hovers a point on the chart for a track whose GPX points include timestamps
- **THEN** the readout MUST additionally show the elapsed time from the start of the track to the hovered point, and the rolling pace (e.g. `min/km` over the same along-track window used for slope)

#### Scenario: Chart adopts the palette

- **WHEN** the elevation chart is rendered in either theme
- **THEN** its fill, axes, gridlines and hover crosshair MUST derive from the design tokens rather than from colours hard-coded in the chart configuration, and MUST rebuild when the theme changes

### Requirement: Per-track summary statistics

The application SHALL compute and show summary statistics for each loaded
track. The ascent (D+) and descent (D−) values SHALL be computed from a
**smoothed and hysteresis-thresholded** elevation series — not from raw
point-to-point altitude deltas — so that the reported values approximate
those a hiker would see for the same activity on Komoot. The smoothing
window and hysteresis threshold SHALL be exposed as named constants in
the parser module so they can be re-tuned without changing the algorithm.
When a track carries no usable elevation of its own, the application SHALL
derive an elevation series from the terrain model rather than reporting a
flat track. The application SHALL additionally compute and surface, for
every track, four **effort / duration estimates**, each clickable to
reveal an explanation of how it was computed and its limitations.

#### Scenario: Summary stats in the sidebar

- **WHEN** a track is loaded
- **THEN** its sidebar entry MUST show at least: total distance (km),
  total ascent (m), total descent (m), and point count

#### Scenario: Elapsed time when timestamps are present

- **WHEN** a track's GPX points include timestamps
- **THEN** the sidebar entry MUST additionally show elapsed time as
  `Hh MMm`

#### Scenario: Ascent and descent ignore sub-threshold noise

- **WHEN** a track contains a long flat section whose recorded elevation
  jitters by less than the configured hysteresis threshold (default 5 m)
  around a steady value
- **THEN** that section MUST contribute zero metres to both `ascentM`
  and `descentM`, regardless of how many up-and-down samples it contains

#### Scenario: Ascent and descent capture real climbs made of small steps

- **WHEN** a track climbs continuously by an amount greater than the
  hysteresis threshold, even if every individual sample-to-sample
  delta is below that threshold (e.g. 2 m steps over a 120 m hill)
- **THEN** the cumulative climb MUST be credited to `ascentM` — the
  threshold MUST gate confirmed turning points, not individual deltas

#### Scenario: Tracks without elevation are enriched from terrain

- **WHEN** a loaded track has no point with a non-zero `<ele>` value
- **THEN** the application MUST derive an elevation series for it from the
  terrain model and report D+/D− from that series, and MUST record the
  track's elevation source as terrain-derived

#### Scenario: Tracks without elevation and without terrain coverage

- **WHEN** a loaded track has no point with a non-zero `<ele>` value and no
  terrain elevation can be obtained for it
- **THEN** the `hasElevation` flag MUST be false, `ascentM` and `descentM`
  MUST be reported as 0, and the UI MUST present the elevation as
  unavailable rather than as a genuine flat profile

#### Scenario: Effort metrics are displayed for the selected track

- **WHEN** a track is selected and the Details panel is expanded
- **THEN** the panel MUST display, above the elevation chart, four
  effort estimates for that track, each rendered as a small chip with
  a metric-specific icon and accent colour:
  - **Effort km** — `distance_km + ascent_m / 100`
  - **Naismith time** — `distance_km / 5 + ascent_m / 600` hours
  - **Tobler time** — integrated Tobler hiking velocity over the track
  - **Minetti cost** — integrated Minetti walking energy cost over the
    track, in kJ (and optionally also in kcal)

#### Scenario: Effort metrics that require per-sample data degrade gracefully

- **WHEN** a track's per-sample geometry is unavailable, malformed, or
  contains no elevation differences (so Tobler and Minetti cannot be
  meaningfully integrated)
- **THEN** the Details panel MUST render those two chips' values as a
  "—" placeholder rather than show a misleading zero, and the
  explainer popover for each MUST state why the value is unavailable

### Requirement: GPX files stay in the browser

Track parsing, storage and rendering SHALL happen entirely in the browser: no
GPX file, and no part of one, is uploaded to any server. The one network use
of a track's data SHALL be elevation for a track that carries no `<ele>`: its
sampled coordinates, and nothing else from the file, are sent to IGN's public
altimetry service (see `terrain-elevation`). A track that carries its own
elevation SHALL cause no request at all.

#### Scenario: No network request carries the GPX content

- **WHEN** a GPX file is dropped or picked
- **THEN** the application MUST NOT send the file's contents to any server

#### Scenario: A track with its own elevation stays offline

- **WHEN** a GPX file whose points carry `<ele>` is loaded
- **THEN** no request derived from the file MUST be made

#### Scenario: A track without elevation sends only coordinates

- **WHEN** a GPX file with no usable `<ele>` is loaded
- **THEN** the only requests derived from it MUST be to IGN's altimetry
  service, carrying sampled coordinates and no name, time or other file content

### Requirement: Distinct colours on batch add

The application SHALL assign every newly-loaded GPX track a colour distinct from every other currently-loaded track, up to the size of the track palette, even when multiple files are added in a single drag-and-drop or file-picker batch. Once the palette is exhausted, colours MAY cycle.

#### Scenario: Drop N files at once, get N distinct colours

- **WHEN** the user drops N GPX files onto the map in a single
  drag-and-drop gesture, with no tracks currently loaded, and N is less
  than or equal to the palette size
- **THEN** each of the N resulting tracks MUST have a colour distinct
  from every other track in the batch, and that colour MUST be visible
  both on the map line and in the sidebar swatch

#### Scenario: Pick N files at once, get N distinct colours

- **WHEN** the user selects N GPX files via the file-picker control in
  one open-dialog interaction, with no tracks currently loaded, and N
  is less than or equal to the palette size
- **THEN** each of the N resulting tracks MUST have a colour distinct
  from every other track in the batch

### Requirement: Elevation-algorithm benchmark against Komoot reference tracks

The repository SHALL ship a runnable benchmark that evaluates the
parser's D+/D− algorithm against a corpus of GPX files whose Komoot-
reported distance, D+ and D− are encoded in the filename, so that any
change to the algorithm or its tuning parameters can be measured for
accuracy regression. The benchmark MUST be runnable offline with no
network access and no browser, using only the dependencies already in
the repository (plus the standard Node runtime).

The benchmark SHALL additionally provide a terrain mode that ignores the
fixtures' own `<ele>` values and re-derives elevation by querying IGN's
altimetry service through the same module the browser uses, so that the
terrain tuning is regression-tested on the same corpus and against the same
budget as the recorded-elevation tuning. Only terrain mode needs network
access; the default mode runs in CI on every pull request.

#### Scenario: Benchmark runs on the bundled fixtures

- **GIVEN** the `test_data/` directory contains GPX files named
  `<name>_<km>_<dplus>_<dminus>.gpx` whose D+ and D− are the Komoot-
  reported values in metres
- **WHEN** a contributor runs the benchmark command (e.g.
  `node scripts/benchmark-elevation.mjs`)
- **THEN** the script MUST parse every `*.gpx` under `test_data/`,
  extract the expected D+/D−/distance from the filename, run the
  current parser algorithm against each file, and print a table with
  one row per fixture showing expected vs computed values and the
  per-fixture percentage error for D+ and D−

#### Scenario: Benchmark reports aggregate accuracy

- **WHEN** the benchmark finishes processing all fixtures
- **THEN** it MUST print the mean absolute percentage error (MAPE) for
  D+ across all fixtures, the MAPE for D−, and the worst-case absolute
  percentage error across all fixtures

#### Scenario: Benchmark exit code reflects the accuracy budget

A fixture is considered **within budget** if **either** its absolute
percentage error is at most 20 % **or** its absolute error in metres
is at most 120 m on both D+ and D−. The 120 m floor exists because
Komoot resamples altitude from its own DEM and the file's `<ele>`
series can disagree with that DEM by tens of metres on tracks whose
total D+ or D− is small — a residual that cannot be closed from the
GPX file alone.

- **WHEN** the benchmark finishes
- **THEN** it MUST exit with status code 0 if every fixture is within
  budget by the rule above **and** the mean absolute percentage error
  computed over fixtures that did NOT hit the 120 m absolute floor is
  at most 10 % for D+ and at most 10 % for D−; otherwise it MUST exit
  with a non-zero status code

#### Scenario: Benchmark flags DEM-divergent fixtures

- **WHEN** a fixture passes the budget by the 120 m absolute floor but
  exceeds 20 % percentage error
- **THEN** the benchmark MUST mark that fixture's row in the output
  (e.g. with a trailing `(DEM)` annotation) so the contributor can
  see at a glance that the residual reflects Komoot's DEM resampling
  rather than an algorithm regression

#### Scenario: Tuning parameters can be overridden from the CLI

- **WHEN** the benchmark is invoked with `--window <metres>` and/or
  `--threshold <metres>` flags
- **THEN** it MUST use those values instead of the parser defaults for
  the smoothing window and the hysteresis threshold, and MUST print
  the active values alongside the results so runs are reproducible

#### Scenario: Terrain mode re-derives elevation from the altimetry service

- **WHEN** the benchmark is invoked in terrain mode (e.g. with a `--dem`
  flag)
- **THEN** it MUST ignore each fixture's `<ele>` values, resample the
  fixture's geometry and query the altimetry service for it, compute
  D+/D− with the terrain tuning, and print the same per-fixture and
  aggregate comparison against the Komoot references

#### Scenario: Terrain mode reports an unreachable service

- **WHEN** the benchmark is invoked in terrain mode and the altimetry
  service cannot be reached
- **THEN** it MUST exit with a non-zero status and a message saying so,
  rather than reporting fabricated or zero results

#### Scenario: Terrain mode uses the same sampler as the application

- **WHEN** the benchmark samples elevation in terrain mode
- **THEN** it MUST use the same resampling and altimetry-sampling code the
  browser uses, so a benchmark pass cannot diverge from application
  behaviour

#### Scenario: Terrain mode is held to the same budget

- **WHEN** the benchmark finishes in terrain mode
- **THEN** it MUST apply the same exit-code budget as the default mode, so
  a regression in the terrain tuning fails the run

#### Scenario: Batch added on top of existing tracks

- **WHEN** the user has K tracks already loaded and then adds a batch
  of N more (by drop or by picker), with K + N less than or equal to the
  palette size
- **THEN** each of the N new tracks MUST receive a colour distinct from
  every existing track AND from every other track in the same batch

#### Scenario: Colours cycle once the palette is exhausted

- **WHEN** the user has loaded enough tracks that the palette has been
  exhausted (more total tracks than palette entries)
- **THEN** the application MAY assign a colour that duplicates an
  existing track's colour for any further tracks, since no further
  unused colour is available; the user can disambiguate via the
  existing per-track recolour control

### Requirement: Click-to-explain popover for every effort metric

Each effort metric chip rendered in the Details panel SHALL be a
focusable, clickable control that opens an inline popover explaining
the metric.
The popover SHALL contain at minimum: a plain-English one-line
definition, the exact formula (with parameters), the actual input
numbers the application used for *this* track (distance, ascent,
descent, body mass, slope window — whichever are relevant), a
citation or external reference for the formula, and an explicit
"Limitations" section. The popover SHALL be dismissible via the
Escape key and via a click outside the popover.

#### Scenario: Clicking a metric opens its explainer

- **WHEN** the user clicks (or activates with Enter/Space) a metric
  chip in the Details panel
- **THEN** a popover MUST appear anchored to that control, containing
  the metric's plain-English definition, formula, the inputs used to
  compute it for the current track, an external reference (e.g. a URL
  to Wikipedia or the original paper), and a Limitations section
  listing at least one explicit caveat (e.g. "assumes a steady fit
  walker; does not model trail surface, weather, or fatigue")

#### Scenario: Popover closes on Escape and click-outside

- **GIVEN** a metric explainer popover is open
- **WHEN** the user presses Escape **or** clicks anywhere outside the
  popover
- **THEN** the popover MUST close and keyboard focus MUST return to
  the control that opened it

#### Scenario: Popover content lives next to the metric math

- **WHEN** the application renders a metric's popover
- **THEN** the popover content (label, formula, references,
  limitations) MUST be sourced from the same module that computes the
  metric — there MUST NOT be duplicate hand-maintained copies of the
  formula in the UI and in the math layer

### Requirement: Effort metric computation is a pure, dependency-free module

The application SHALL compute every effort metric from a single,
pure, framework-agnostic module that takes track inputs and returns a
deterministic `EffortMetrics` object, so the same numbers can be
exercised from unit tests, from offline benchmarking, and from the
browser UI without divergence.

#### Scenario: Module is callable from Node and the browser

- **WHEN** the elevation benchmark (or any future offline tool) imports
  the effort module and feeds it a track's distance, ascent, descent,
  and per-sample list
- **THEN** the module MUST return the same `EffortMetrics` object that
  the browser UI would render for the same inputs — there MUST NOT be
  a separate browser-only implementation

#### Scenario: Minetti gradient is clamped before evaluating the polynomial

- **WHEN** the Minetti integration encounters a per-sample gradient
  outside [-0.5, +0.5] (50 % grade)
- **THEN** the gradient MUST be clamped to that range before being fed
  into the Minetti polynomial, and the popover's Limitations section
  MUST disclose the clamp

### Requirement: Fattened hit area for GPX tracks

Each rendered GPX track SHALL include an invisible 12-pixel-wide hit-area line layer above its visible line and halo layers. The hit-area layer SHALL share the visible line's source and visibility, and SHALL be present for the lifetime of the track on the map. Pointer interactions (click handlers and the pointer cursor on hover) SHALL be wired to the hit-area layer rather than the visible line so that interactions near the line register as hits.

#### Scenario: Hover near a track shows the pointer cursor
- **WHEN** the user moves the pointer within 6 pixels of a visible GPX track
- **THEN** the cursor SHALL become a pointer

#### Scenario: Track visibility couples the hit area
- **WHEN** the user hides a GPX track via the track list
- **THEN** the track's hit-area layer SHALL also be hidden so no interactions are reported for it

### Requirement: Start/end endpoint markers for every GPX track

The application SHALL render two point markers at the geographic endpoints of every visible uploaded GPX track: one labeled "A" at the first coordinate of the track's geometry, and one labeled "B" at the last coordinate. The markers SHALL use the same color as the track's line, with a contrasting white letter and a halo so they remain legible on every supported basemap.

When the first and last coordinates of a track lie within a small geographic threshold (closed-loop tracks), the application SHALL render a single combined marker labeled "A/B" at that location instead of two overlapping markers.

The endpoint markers' visibility SHALL be coupled to the track's own visibility: hiding the track in the sidebar SHALL hide its endpoint markers, and showing it again SHALL restore them. Recoloring the track SHALL update the endpoint markers' color in the same render.

#### Scenario: Open track gets A and B markers

- **WHEN** a user uploads an open (non-loop) GPX track and it becomes visible on the map
- **THEN** an "A" marker MUST render at the track's first coordinate and a "B" marker MUST render at its last coordinate, both filled with the track's assigned color and showing a white letter

#### Scenario: Closed-loop track gets a single A/B marker

- **WHEN** a user uploads a GPX track whose first and last coordinates are within the configured loop threshold
- **THEN** a single combined marker labeled "A/B" MUST render at that location instead of two stacked markers

#### Scenario: Endpoint markers follow track visibility

- **WHEN** the user toggles a GPX track's visibility off in the sidebar list
- **THEN** the corresponding "A" and "B" (or "A/B") markers MUST also be hidden, and they MUST reappear when the track is toggled back on

#### Scenario: Endpoint markers follow track color

- **WHEN** the user recolors a GPX track via the sidebar color control
- **THEN** the track's endpoint markers MUST update to the new color in the same render, with no stale-color flicker

#### Scenario: Removing a track removes its endpoints

- **WHEN** the user removes a GPX track from the sidebar list
- **THEN** both the line layers and the endpoint markers for that track MUST be removed from the map

#### Scenario: Degenerate tracks render no endpoints

- **WHEN** a GPX track contains zero or one coordinate
- **THEN** no endpoint markers MUST be rendered for that track, and no error MUST be surfaced

### Requirement: Mobile-optimised Details panel sizing

On viewports ≤ 768px wide, the Details panel (effort row + elevation chart) SHALL render at a reduced expanded height so that the map remains the dominant surface even when the panel is expanded.

#### Scenario: Details panel capped height on mobile

- **WHEN** the Details panel is expanded on a viewport ≤ 768px wide
- **THEN** its expanded height MUST be capped at ≤ 50% of viewport height, leaving at least 50% of the viewport for the map

#### Scenario: Collapsed handle preserves map area on mobile

- **WHEN** the Details panel is collapsed on a viewport ≤ 768px wide
- **THEN** only its handle (with the chevron and label) MUST be visible and the handle's total height MUST NOT exceed 48 CSS pixels

### Requirement: GPX track sidebar list is reachable on mobile

The GPX tracks surface (open action, list of loaded tracks, per-track stats) SHALL remain reachable on viewports ≤ 768px wide as the **tracks segment of the application's single persistent bottom sheet**, and SHALL NOT implement a sheet of its own.

#### Scenario: Tracks reachable from the sheet head on mobile

- **WHEN** the application is loaded on a viewport ≤ 768px wide
- **THEN** the tracks segment MUST be selectable from the persistent sheet's segmented control, exposing only the sheet head at the peek snap point

#### Scenario: Tracks usable when the sheet is raised

- **WHEN** the user selects the tracks segment and raises the sheet
- **THEN** the file picker / drag-and-drop affordance, the list of loaded tracks, and per-track selection, removal, and visibility controls MUST all be reachable and operable with touch input

#### Scenario: Switching to tracks preserves sheet height

- **WHEN** the user switches to the tracks segment while the sheet is at its half or full snap point
- **THEN** the sheet MUST stay at that snap point and swap only its content

