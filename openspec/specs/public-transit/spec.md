# public-transit Specification

## Purpose
The public-transit overlay shared by every bus and coach network: the data schema the build emits, how lines and stops appear at each zoom, their popups, filters and highlighting, and the build pipeline that turns GTFS feeds into map data.
## Requirements
### Requirement: Provider-backed transit overlay registration

The system SHALL expose a `ProviderConfig` interface and a generic transit-overlay module such that each public-transit provider is registered by supplying a single config object — id, label, attribution, a `linesPmtilesUrl` to that provider's `lines.pmtiles`, a `stopsGeoJsonUrl` to that provider's `stops.geojson`, line color, and a `timetableSearchUrl(line)` function — with no edits required to the rendering, popup, or build infrastructure. Build-time concerns that vary by operator (e.g. how TAD is encoded) SHALL be handled in the provider's own build script by composing helpers exported from `scripts/transit/lib/`; the shared library SHALL NOT carry provider-specific heuristics.

#### Scenario: A new provider is added by a config-only change

- **WHEN** a developer appends an entry to `scripts/transit/providers.config.mjs` and builds its artifacts
- **THEN** the app derives that provider's `ProviderConfig` from the entry (`src/transit/providers.ts`) and renders its lines and stops on the map without any other file being edited — no per-provider runtime file, no registration list, and no change to `transitOverlay.ts`, `transitPopup.tsx`, or the line/stop property schema

#### Scenario: The map and the pipeline cannot disagree
- **WHEN** a provider's label, region, colour, attribution or default visibility is changed in `providers.config.mjs`
- **THEN** the app MUST show the new value with no other edit, because it holds no copy of those fields

#### Scenario: Provider config is missing required fields

- **WHEN** a config entry lacks one of `id`, `label`, `region`, `attribution`, `lineColor`, `displayDefaultOn` or `timetable` (search keywords, or a reso-m.fr agency code)
- **THEN** TypeScript SHALL fail the build at compile time, via the declared types in `providers.config.d.mts`

### Requirement: Stable transit data schema

The system SHALL emit and consume a stable `TransitLineProperties` schema (route id, route short/long name, color, text color, `reservation`, `reservation_detail`, `observed_from`, `observed_to`, `archived`, `last_seen_on`, `last_seen_day`, `last_feed_valid_to`, `stops_count`, `endpoints`, `service.{weekday,saturday,sunday}` with `firstDep`/`lastDep`/`trips`/`avgGapMin`, optional `timetable_url`, `runs_weekday`, `runs_saturday`, `runs_sunday`, `is_low_freq`) and a `TransitStopProperties` schema (stop id, stop name, `serving_lines: [{ route_id, short_name, color, reservation, archived? }]`, `runs_<day>`, `has_high_freq_line`, `archived`). The `reservation` value on each `ServingLine` entry SHALL mirror the originating route's `reservation` status from `TransitLineProperties`, enabling stop-popup consumers to surface per-line reservation warnings without a runtime lookup into the lines source. `lines.pmtiles` SHALL contain exactly **one** line Feature per `route_id`; that Feature's geometry SHALL be the dissolved union of all the route's shape variants (a `LineString` when a single branch remains, otherwise a `MultiLineString`). `TransitLineProperties` SHALL NOT include `shape_id`. The popup component SHALL consume these properties without any provider-specific branching.

`observed_from` / `observed_to` report the active-date window as published — an observation, not a classification. The provenance fields (`archived`, `last_seen_on`, `last_seen_day`, `last_feed_valid_to`) are defined by the `transit-line-ledger` capability. The `reservation` field is three-state and is defined by the `transit-reservation-status` capability.

Whether a line must be booked is carried by `reservation` and `reservation_detail`, never by a boolean: a boolean cannot tell a line that needs no booking from one whose feed says nothing about it. The runtime SHALL treat a missing `reservation` as `unknown`, so incomplete data understates certainty rather than overstating it.

The schema SHALL NOT classify lines as seasonal. A short active-date window cannot tell a winter-only line from a feed that publishes only a few weeks ahead, so the window is published as `observed_from` / `observed_to`, an observation rather than a verdict, and uncertainty is carried by `archived` / `last_seen_on`. The runtime SHALL treat a missing `archived` as `false`.

#### Scenario: Property shape is consistent across providers

- **WHEN** two providers each ship their `lines.pmtiles` and `stops.geojson`
- **THEN** every Feature in both bundles SHALL satisfy `TransitLineProperties` (lines) or `TransitStopProperties` (stops), and the popup SHALL render identically structured content for both

#### Scenario: ServingLine carries reservation status from its originating route

- **WHEN** a stop is served by a route whose `TransitLineProperties.reservation` is `required`
- **THEN** the corresponding `ServingLine` entry in the stop's `serving_lines` array SHALL have `reservation: 'required'`; for routes resolved to `not_required` or `unknown`, the corresponding `ServingLine.reservation` SHALL carry that same value

#### Scenario: One Feature per route carries the unioned geometry

- **WHEN** a route in the source GTFS feed has multiple shape variants (e.g. a forking or branching line)
- **THEN** `lines.pmtiles` SHALL contain exactly one Feature for that `route_id`, whose geometry is a `LineString`/`MultiLineString` covering the union of all variants, and no Feature in the bundle SHALL carry a `shape_id` property

#### Scenario: Line features carry provenance instead of a seasonal verdict

- **WHEN** a provider build emits `lines.pmtiles`
- **THEN** every line Feature SHALL carry `archived`, `last_seen_on` and `last_seen_day`, and SHALL NOT carry `seasonal`, `season_from` or `season_to`

#### Scenario: Artifacts built before the change degrade to unknown

- **WHEN** the runtime reads a line Feature that carries no `reservation` property
- **THEN** it SHALL treat that line's reservation status as `unknown` rather than as not requiring reservation

### Requirement: Route geometry is the dissolved union of its shape variants

The shared transit build SHALL, for each `route_id`, dissolve all of that route's GTFS shape variants into a single union geometry before emitting the route's line Feature. Shared trunk segments covered by more than one variant SHALL appear once in the output; segments where variants diverge (forks/branches) SHALL be preserved. Coverage SHALL be determined by a distance tolerance (a single named constant, on the order of 10–15 m) such that segments lying within the tolerance of already-kept geometry are treated as duplicates and dropped, while segments beyond it are kept as additional branches. The dissolve SHALL be deterministic: repeated builds over an unchanged feed SHALL produce byte-identical geometry. This behavior SHALL be implemented once in the shared build and SHALL apply uniformly to every provider, existing and future, without per-provider configuration.

#### Scenario: Overlapping trunk is emitted once

- **WHEN** two or more shape variants of a route run along the same road within the tolerance before diverging
- **THEN** the shared road SHALL be represented by a single line in the emitted geometry (not one line per variant), so overlapping variants do not stack

#### Scenario: Divergent branches are preserved

- **WHEN** shape variants of a route follow different roads beyond the tolerance (a genuine fork)
- **THEN** each divergent branch SHALL be present as a distinct member of the route's union geometry

#### Scenario: Dissolve is deterministic across builds

- **WHEN** the build runs twice against the same unchanged GTFS feed
- **THEN** the emitted union geometry for every route SHALL be identical between the two runs

#### Scenario: Applies to every provider without per-provider config

- **WHEN** a new provider is added to `scripts/transit/providers.config.mjs` and built
- **THEN** its routes SHALL be emitted as one unioned Feature each, using the same shared dissolve step, with no provider-specific code required

### Requirement: Phased zoom thresholds for transit visibility

The system SHALL render transit lines at every zoom level (no minzoom gating), hide transit stops below zoom 9, and hide line chips and stop labels below zoom 12. At and above each threshold, the corresponding layer SHALL be rendered (subject to the provider's overlay toggle).

#### Scenario: Country-scale zoom
- **WHEN** the map is at zoom 6 with the provider's overlay on
- **THEN** transit lines are rendered, and no transit stops, chips, or stop labels are rendered

#### Scenario: Regional zoom shows lines only
- **WHEN** the map is at zoom 8 with the provider's overlay on
- **THEN** transit lines are rendered, and no transit stops, chips, or stop labels are rendered

#### Scenario: Stops appear at zoom 9
- **WHEN** the map is at zoom 9 with the provider's overlay on
- **THEN** transit lines and stops are rendered, and no chips or stop labels are rendered

#### Scenario: Agglomeration-scale zoom
- **WHEN** the map is at zoom 12 with the provider's overlay on
- **THEN** the lines, stops, chips, and stop labels are all rendered

### Requirement: Line click popup

The system SHALL show a MapLibre `Popup` anchored to the nearest point on the clicked line's geometry (not the raw click point), containing: line label and color chip, operator name, a reservation pill for every line — `required` additionally showing its booking detail, `not_required` and `unknown` carried by the pill alone — a "Dernière mise à jour" pill coloured by the age of the data, the feed's published validity end date where it declares one, a freshness badge and warning when `archived` is true, stops count and endpoints, three rows of service stats (weekday / Saturday / Sunday) showing first–last departure (a single time when there is one trip) and trips/day — not `avgGapMin`, which is taken over both directions merged and so does not say how often a bus passes in either, a "Voir le tracé sur la carte" action that toggles the route-highlight overlay for the clicked route, a "Voir les horaires →" link, and a footer stating that data is indicative and may be out of date. The nearest-point computation SHALL consider every segment of the clicked feature's geometry, including every linestring of a `MultiLineString`, so the popup's tail visually points at the line regardless of the fattened hit-area offset. The "Voir le tracé sur la carte" action SHALL be labelled "Masquer le tracé" when the clicked route is the currently highlighted route, and SHALL toggle the highlight off in that state.

#### Scenario: Popup anchors at the nearest point on the line

- **WHEN** the user clicks the fattened hit-area of a bus line at a point that is offset a few pixels from the visible line
- **THEN** the popup SHALL open with its anchor set to the nearest point on the underlying line geometry, not to the raw click point, so the popup tail visually meets the line

#### Scenario: Click a regular weekday-and-weekend line

- **WHEN** the user clicks a line that runs every day and is in the current feed
- **THEN** the popup SHALL show three populated service rows, a reservation pill, a "Dernière mise à jour" pill, no freshness warning, a "Voir le tracé sur la carte" action, and a "Voir les horaires →" link

#### Scenario: Click a line that requires reservation

- **WHEN** the user clicks a line whose `reservation` is `required`
- **THEN** the popup SHALL state that reservation is required and SHALL show the booking detail carried on that line

#### Scenario: Click a line whose reservation status is unknown

- **WHEN** the user clicks a line whose `reservation` is `unknown`
- **THEN** a reservation pill reading "Réservation : inconnue" SHALL be shown, with no explanatory paragraph beneath it

#### Scenario: Click a line that has no Sunday service

- **WHEN** the user clicks a line whose Sunday `ServiceWindow` is null
- **THEN** the Sunday row SHALL read "Pas de service"

#### Scenario: MultiLineString line

- **WHEN** the user clicks a feature whose geometry is a `MultiLineString` and the click lands closer to a segment in the second linestring than the first
- **THEN** the popup SHALL anchor at the nearest point on that second linestring

#### Scenario: Toggle action shows the active label when the route is already highlighted

- **WHEN** the user opens the line popup for a `route_id` that is currently the highlighted route in its provider
- **THEN** the action SHALL read "Masquer le tracé" instead of "Voir le tracé sur la carte"

### Requirement: Stop click popup

The system SHALL show a MapLibre `Popup` when the user clicks a transit stop (at zoom ≥ 11), containing the stop name and a list of serving-line chips. The chip list SHALL be filtered to the lines that are currently visible under the active day filter and "Hide low-frequency lines" toggle; when one or more chips are dropped by the filter, the popup SHALL show a muted `+N hidden by filter` hint below the chip list. For each chip whose `ServingLine.reservation` is `required`, the popup SHALL render an inline warning row, immediately associated with that chip, reading `⚠︎ {route_short_name} sur réservation`; for each chip whose status is `unknown` it SHALL render a muted row noting that the reservation requirement is not known. Clicking a chip SHALL dismiss the stop popup and open the popup for that line.

#### Scenario: Click a stop served by one line

- **WHEN** the user clicks a stop served by exactly one line with no day filter active
- **THEN** the popup SHALL show the stop name and a single line chip
- **AND** no hidden-by-filter hint SHALL be shown

#### Scenario: Click a stop served by multiple lines

- **WHEN** the user clicks a stop served by N lines with no day filter active
- **THEN** the popup SHALL show N line chips

#### Scenario: Filter hides some serving lines

- **WHEN** the user clicks a stop served by 5 lines with a day or low-freq filter active that visually filters 2 of them
- **THEN** the popup SHALL show 3 chips and a "+2 hidden by filter" hint

#### Scenario: Reservation warning appears for a booking-required serving line

- **WHEN** the user clicks a stop whose `serving_lines` contains an entry with `reservation: 'required'` and short name `T40`
- **THEN** the popup SHALL render an inline warning row reading `⚠︎ T40 sur réservation` immediately associated with the `T40` chip

#### Scenario: No warning when every serving line is known not to need booking

- **WHEN** every entry in the clicked stop's `serving_lines` has `reservation: 'not_required'`
- **THEN** no reservation row SHALL appear

#### Scenario: Unknown reservation status is shown as unknown

- **WHEN** a clicked stop's `serving_lines` contains an entry with `reservation: 'unknown'`
- **THEN** the popup SHALL note that the reservation requirement is not known for that chip, rather than leaving it indistinguishable from a line known not to need booking

### Requirement: Timetable link strategy

For each line, the popup's "Voir les horaires →" link SHALL be derived as follows: if `feature.properties.timetable_url` is non-null, use that value; otherwise call the provider's `timetableSearchUrl(line)` function. The system SHALL load curated overrides at build time from `public/transit/<provider>/line-urls.json` when that file is present, populating `timetable_url` on matching features.

#### Scenario: A line has a curated override
- **WHEN** `line-urls.json` contains an entry for the line's `route_short_name`
- **THEN** the popup link SHALL point to that URL

#### Scenario: A line has no override
- **WHEN** `line-urls.json` is absent or has no entry for the line
- **THEN** the popup link SHALL point to the URL returned by `timetableSearchUrl(line)`

### Requirement: Build-time validity metadata and banner

Each provider build SHALL emit `meta.json` containing at least `provider_id`, `label`, `attribution`, `built_at`, `last_checked_on`, `feed_valid_from`, `feed_valid_to`, `license`, `source_url`, and `line_count`. The map control panel SHALL display a validity badge for each enabled provider reading from its `meta.json`, and that badge SHALL switch to an amber state when the current date is past `feed_valid_to`.

`built_at` SHALL record when the provider's artifacts were last generated.
`last_checked_on` SHALL record when its feed was last downloaded and compared,
whether or not that comparison led to a rebuild. A refresh that finds a feed
unchanged SHALL update `last_checked_on` and leave `built_at` alone, so the two
dates diverge exactly when the publisher has not moved.

#### Scenario: Feed within validity window
- **WHEN** the current date is on or before a provider's `feed_valid_to`
- **THEN** the validity badge SHALL display in its default (non-amber) state

#### Scenario: Feed past validity window
- **WHEN** the current date is after a provider's `feed_valid_to`
- **THEN** the validity badge SHALL display in an amber state with a tooltip explaining the data may be stale

#### Scenario: An unchanged feed is confirmed without a rebuild
- **WHEN** a refresh downloads a feed identical to the one behind the current artifacts
- **THEN** `last_checked_on` SHALL advance to the refresh date while `built_at` keeps the date the artifacts were generated

#### Scenario: A rebuilt provider's dates agree
- **WHEN** a provider is rebuilt from a changed feed
- **THEN** `built_at` and `last_checked_on` SHALL both reflect that build

### Requirement: ODbL attribution

Each provider's MapLibre line source (PMTiles `vector`) and stop source (GeoJSON) SHALL include an `attribution` string identifying the data publisher, the license, and the upstream source. The string SHALL appear in the standard MapLibre attribution control whenever any of that provider's layers is visible.

#### Scenario: Provider overlay is visible

- **WHEN** a provider's overlay is enabled and at least one of its layers is rendered
- **THEN** the MapLibre attribution control SHALL include the provider's attribution string

### Requirement: Layer ordering relative to existing overlays

The transit overlays SHALL be inserted such that, top to bottom, user overlays (curated hikes, GPX) remain on top, followed by transit chips, transit stops, transit lines (solid), transit lines halo, then rail stations, then the rail network, then the basemap.

#### Scenario: Transit and rail overlays both enabled

- **WHEN** both the rail overlay and a transit overlay are on
- **THEN** transit lines SHALL render above rail lines and transit chips SHALL render above transit stops

### Requirement: Build-time service-day and frequency flags

Each provider's `lines.geojson` SHALL include three flat boolean properties — `runs_weekday`, `runs_saturday`, `runs_sunday` — on every line feature, true when the line has at least one trip on that service day. Each `stops.geojson` SHALL include the same three booleans on every stop feature, true when at least one serving line of that stop runs on that day. Each line feature SHALL additionally include a boolean `is_low_freq`, true when `service.weekday.trips <= LOW_FREQ_THRESHOLD` AND the line runs on neither Saturday nor Sunday. Each stop feature SHALL include a boolean `has_high_freq_line`, true when at least one serving line of that stop has `is_low_freq = false`. The `LOW_FREQ_THRESHOLD` SHALL be configurable per provider in its build script; the default for Cars Région Isère SHALL be 4.

#### Scenario: Cars Région Isère build emits the new booleans
- **WHEN** the Cars Région Isère build script runs against the current snapshot
- **THEN** every feature of `lines.geojson` SHALL have `runs_weekday`, `runs_saturday`, `runs_sunday`, and `is_low_freq` as booleans
- **AND** every feature of `stops.geojson` SHALL have `runs_weekday`, `runs_saturday`, `runs_sunday`, and `has_high_freq_line` as booleans
- **AND** the count of lines where `is_low_freq = true` SHALL be approximately 250 (±10%)

#### Scenario: A weekend-only seasonal line is flagged correctly
- **WHEN** a line has zero weekday trips and at least one Saturday trip
- **THEN** `runs_weekday = false`, `runs_saturday = true`, `runs_sunday` reflects the Sunday data, and `is_low_freq = false`

### Requirement: Day filter applied to lines and stops

The system SHALL expose a global day filter with four states — `any`, `weekday`, `saturday`, `sunday` — defaulting to `any`. When the user selects `weekday`, `saturday`, or `sunday`, the system SHALL hide every line whose corresponding `runs_<day>` boolean is false and every stop whose corresponding `runs_<day>` boolean is false. The filter SHALL apply atomically to the line, halo, chip, stop, stop-label, and line/stop hit-area layers of every selected provider via MapLibre `setFilter`. The filter state SHALL persist across reloads.

#### Scenario: User selects "Sunday"

- **WHEN** the day filter is changed from `any` to `sunday`
- **THEN** only lines with `runs_sunday = true` SHALL render
- **AND** only stops with `runs_sunday = true` SHALL render
- **AND** no provider's source data SHALL be re-fetched

#### Scenario: Day filter "any" restores all features

- **WHEN** the day filter is changed back to `any`
- **THEN** every line and stop that was visible before any day filter was applied SHALL be visible again

#### Scenario: Day filter persists across reload

- **WHEN** the user sets the day filter to `saturday` and reloads the page
- **THEN** the day filter SHALL initialise to `saturday` with no visible flash of unfiltered features

### Requirement: Hide-low-frequency toggle

The system SHALL expose a global "Hide low-frequency lines" toggle, defaulting to off. When on, the system SHALL hide every line whose `is_low_freq = true` and every stop whose `has_high_freq_line = false`, composed in MapLibre `setFilter` with the day filter. The toggle SHALL persist across reloads.

#### Scenario: Toggle is enabled
- **WHEN** the user enables "Hide low-frequency lines" with the day filter at `any`
- **THEN** every line with `is_low_freq = true` SHALL be hidden
- **AND** every stop with `has_high_freq_line = false` SHALL be hidden

#### Scenario: Toggle composes with day filter
- **WHEN** the day filter is `saturday` AND "Hide low-frequency lines" is on
- **THEN** only lines with `runs_saturday = true AND is_low_freq = false` SHALL render
- **AND** only stops with `runs_saturday = true AND has_high_freq_line = true` SHALL render

### Requirement: Per-provider color override

Each provider SHALL expose a color override stored in `localStorage` under `providerColor:<provider-id>`, defaulting to the provider's hard-coded `provider.lineColor`. The override SHALL be picked from a curated palette of approximately six high-contrast colors plus a "Reset" affordance restoring the default. The override affordance SHALL be the color popover anchored to the provider's pill in the pill row (see "Pill-based bus provider selector"); it SHALL NOT be rendered as a permanently stacked block under the Bus section. Changing the color SHALL update the line, halo, chip `text-halo-color`, and stop `circle-color` paint properties of that provider's layers via `map.setPaintProperty`, with no data refetch.

#### Scenario: User picks a palette color

- **WHEN** the user picks a palette color in the pill's color popover for a selected provider
- **THEN** that provider's lines, halos, stops, and chip text-halos SHALL re-render in the new color immediately
- **AND** no other provider's color SHALL be affected
- **AND** the override SHALL persist across reloads
- **AND** the pill's color ring SHALL fill with the new color

#### Scenario: User resets color

- **WHEN** the user clicks "Reset" in the pill's color popover
- **THEN** the provider's layers SHALL re-render in the provider's hard-coded `provider.lineColor`
- **AND** the `localStorage` override SHALL be cleared
- **AND** the pill's color ring SHALL fill with the hard-coded default

#### Scenario: Two providers share a color

- **WHEN** the user picks the same palette color for two selected providers
- **THEN** the system SHALL render both providers' layers in that color without warning or restriction

### Requirement: Build-time stop merging by name and proximity

The transit build pipeline SHALL include a shared helper that clusters per-provider stops into a single merged stop when they share a normalised `stop_name` and lie within a configurable proximity threshold (default 75 metres) of one another. Each merged stop SHALL carry:

- The centroid coordinates of the cluster members.
- The first (sorted by `stop_id` ascending) member's `stop_id` as the canonical id.
- The `stop_name` of the first sorted member.
- The union of `serving_lines` across members, deduplicated by `route_id`, preserving first-seen order.
- A boolean OR across members of `runs_weekday`, `runs_saturday`, `runs_sunday`, and `has_high_freq_line`.
- A `display_color` recomputed from the merged `serving_lines` list (single-line → that line's color; multi-line → `#FFFFFF`).

The helper SHALL be provider-agnostic and live under `scripts/transit/lib/` so future GTFS providers can call it without modification.

#### Scenario: Two opposite-direction poles merge into one feature
- **WHEN** the Cars Région Isère build runs against a feed containing two stops named "LES AVENIERES STADE" located 17 metres apart
- **THEN** the emitted `stops.geojson` SHALL contain exactly one feature whose coordinates are the midpoint of the two source poles, whose `serving_lines` is the deduped union of the two source `serving_lines`, and whose `runs_<day>` and `has_high_freq_line` are the boolean OR of the two source values.

#### Scenario: Same name, far apart, are NOT merged
- **WHEN** the build runs against a feed containing two stops named "MAIRIE" located 5 kilometres apart
- **THEN** the emitted `stops.geojson` SHALL contain both as distinct features.

#### Scenario: Cars Région Isère shrinkage
- **WHEN** the Cars Région Isère build runs with the default threshold of 75 metres
- **THEN** the emitted `stops.geojson` feature count SHALL drop from approximately 6,529 to approximately 3,670 (±10%).

#### Scenario: Merge result is deterministic across rebuilds
- **WHEN** the build runs twice against the same input feed
- **THEN** the resulting `stops.geojson` SHALL be byte-identical (modulo build timestamps in `meta.json`).

### Requirement: Fattened click targets for lines and stops

The system SHALL render an invisible 12-pixel-wide hit-area line layer above each provider's visible line layer, and an invisible 12-pixel-radius hit-area circle layer above each provider's visible stop layer. Click, mouseenter, and mouseleave handlers SHALL be registered on the hit-area layers instead of the visible layers, so that clicks near (but not directly on) a visible line or stop register as hits on the underlying feature. The hit-area layers SHALL inherit the same day and low-frequency filters as their visible siblings so hidden features remain unclickable.

#### Scenario: Click near a line

- **WHEN** the user clicks within 6 pixels of a visible bus line
- **THEN** the line's popup SHALL open with the feature whose hit-area was clicked

#### Scenario: Click near a stop

- **WHEN** the user clicks within 6 pixels of a visible stop at zoom ≥ 9
- **THEN** the stop's popup SHALL open

#### Scenario: Filter hides the hit target too

- **WHEN** the active day filter or low-frequency toggle hides a line
- **THEN** clicking within the hit-area of that line SHALL NOT open its popup

#### Scenario: Stop label is clickable

- **WHEN** the map is at zoom ≥ 12 and the user clicks a visible stop label
- **THEN** the stop's popup SHALL open as if the dot itself were clicked

### Requirement: Transit sections reachable from mobile controls sheet

On viewports ≤ 768px wide, the Public Buses and Trains sections — including the bus pill row, the `Providers ▾` dropdown, the day picker, the hide-low-frequency toggle, the validity banner, the rail-network toggle, and the rail-stations toggle — SHALL all be reachable inside the mobile controls bottom sheet without any horizontal scrolling. The bus color popover anchored to a pill SHALL render fully inside the sheet (it MAY auto-flip to stay within bounds).

#### Scenario: Bus section visible inside mobile sheet

- **WHEN** the user expands the mobile controls sheet on a viewport ≤ 768px wide
- **THEN** the "Public Buses" header, the pill row of currently-selected providers, the `Providers ▾` dropdown control, and (when ≥1 bus provider is selected) the day picker, the hide-low-frequency toggle, and the transit validity banner MUST all be visible inside the sheet and reachable by vertical scrolling alone
- **AND** opening a pill's color popover MUST render the popover fully inside the sheet without horizontal scrolling

#### Scenario: Train section visible inside mobile sheet

- **WHEN** the user expands the mobile controls sheet on mobile with the rail overlay enabled
- **THEN** the "Trains" header, the rail-network toggle, the rail line color picker, and the rail-stations visibility toggle MUST all be visible inside the sheet

### Requirement: Mobile-friendly day picker chips

The `DayPicker` SHALL render its day chips with touch-friendly sizing on viewports ≤ 768px wide so that selecting a single day or dragging a range is reliable with a finger.

#### Scenario: Day chips are tap-friendly

- **WHEN** the day picker renders on a viewport ≤ 768px wide
- **THEN** each chip's hit area MUST be at least 44 CSS pixels in both width and height, and chips MUST wrap onto multiple rows rather than overflow the controls sheet horizontally

### Requirement: Pill-based bus provider selector

The Public Buses section SHALL expose its currently-selected providers as a horizontal wrap row of pills and SHALL let the user add new providers from a `Providers ▾` dropdown that lists only the providers not currently selected. Each pill SHALL render, in order: a circular color affordance with a dotted outline filled with the provider's active line color, the provider's `label`, and a remove "×" control. Clicking the color affordance SHALL open a color popover anchored to it whose contents are the existing curated palette plus a "Reset" affordance. Clicking the "×" SHALL deselect the provider (equivalent to setting its visibility boolean to false). The pill row and the dropdown SHALL replace the previous per-provider `OverlayToggle` button row and the always-stacked per-provider color palette blocks. Selection state SHALL persist across reloads using the same per-provider `localStorage` keys as the previous toggles, so no migration is needed.

#### Scenario: Selecting a provider from the dropdown

- **WHEN** the user opens the `Providers ▾` dropdown and selects a provider not yet on the map
- **THEN** a pill for that provider SHALL appear in the pill row, the provider's MapLibre layers SHALL become visible, and the selected provider SHALL no longer appear in the dropdown's list of selectable providers

#### Scenario: Removing a provider via the pill "×"

- **WHEN** the user clicks the "×" on a provider's pill
- **THEN** the pill SHALL be removed, the provider's MapLibre layers SHALL set `visibility: 'none'`, the provider SHALL reappear in the `Providers ▾` dropdown, and other providers' overlays SHALL be unaffected

#### Scenario: Editing a provider's color via the pill

- **WHEN** the user clicks the dotted color ring on a provider's pill
- **THEN** a color popover anchored to the ring SHALL open, showing the curated palette and a "Reset" affordance
- **AND** picking a palette color SHALL repaint that provider's lines, halos, stops, and chip text-halos in the new color, persist the override, and update the pill's color ring fill to match — without affecting any other provider

#### Scenario: Dropdown when all providers are selected

- **WHEN** every registered provider already has a pill in the pill row
- **THEN** the `Providers ▾` dropdown SHALL either render disabled or render with an empty list and a "Tous les fournisseurs sont sélectionnés" message — never offering a no-op selection

#### Scenario: Selection state persists across reload

- **WHEN** the user selects two providers via the dropdown and reloads the page
- **THEN** both pills SHALL render on the next load with no flash of an empty pill row, and the two providers' overlays SHALL be visible on the map at first paint

### Requirement: Solid bus line and stop paint

Each bus provider's line and halo layers SHALL render solid (no `line-dasharray`), with `line-width: 2.2` for the line layer and `line-width: 4.5` for the white halo. Each provider's stop circle layer SHALL paint `circle-color` uniformly with the provider's currently active line color (i.e. the value set by the pill's color popover, falling back to the provider's hard-coded `lineColor`). The stop circle SHALL retain a dark stroke ring (`circle-stroke-color: '#1f2937'`, `circle-stroke-width: 1`) for legibility against light basemaps. Booking-required (TAD) lines SHALL share that single line layer (and single halo layer, and single hit-area line layer) per provider; their status is shown in the popup, not by the line's paint.

Lines the feed no longer publishes are the one exception, and are drawn dashed in their own layer — see the `transit-line-ledger` capability.

#### Scenario: Lines render solid at the configured width

- **WHEN** any bus provider's overlay is visible at zoom ≥ 7
- **THEN** its line features SHALL render solid with `line-width: 2.2` and a white halo of `line-width: 4.5`, and no `line-dasharray` SHALL be applied to either layer

#### Scenario: Lines paint identically regardless of reservation status

- **WHEN** a provider's bundle contains lines whose `reservation` is `required`, `not_required` and `unknown`
- **THEN** all three SHALL render with the same color, width, and halo, distinguishable only by the chip layer's leading "·" prefix and by the reservation pill surfaced in line and stop popups

#### Scenario: Stop circles match the provider's active color

- **WHEN** any bus provider's overlay is visible at zoom ≥ 9
- **THEN** all of that provider's stop circles SHALL paint with `circle-color` equal to the provider's currently active line color (i.e. the pill color), with a dark stroke ring for legibility — independent of any per-stop `display_color` field in the data

### Requirement: Bus section is non-collapsible

The Public Buses section of the controls panel SHALL always render expanded. The section header SHALL NOT expose a collapse / expand caret or any other affordance that hides its body. The pill row, `Fournisseurs ▾` dropdown, day picker, hide-low-frequency toggle, and validity banner SHALL all remain visible whenever the section is rendered (subject only to the section-level visibility toggle defined below, which hides map layers, not panel chrome).

#### Scenario: No collapse caret in the Bus header

- **WHEN** the user views the controls panel on desktop or inside the mobile sheet
- **THEN** the Public Buses section header SHALL render without any collapse / expand caret
- **AND** clicking the header SHALL NOT change the visibility of the section's body

#### Scenario: Body always rendered

- **WHEN** the Public Buses section is rendered
- **THEN** its pill row, `Fournisseurs ▾` dropdown, day picker, hide-low-frequency toggle, and validity banner SHALL all be visible in the panel (their map layers' visibility is controlled separately by the section visibility toggle)

### Requirement: `Fournisseurs ▾` dropdown rendered below the pill row

The Public Buses section SHALL render the `Fournisseurs ▾` dropdown as a block element on its own row, placed below the pill row of currently-selected providers. The pill row SHALL wrap within the controls panel's max-width without ever sharing a row with the dropdown.

#### Scenario: Dropdown is on its own row

- **WHEN** the Public Buses section is rendered with zero, one, or many selected providers
- **THEN** the `Fournisseurs ▾` dropdown SHALL render on its own row beneath the pill row, never inline with any pill

#### Scenario: Pill row wraps within the panel width

- **WHEN** the user selects enough providers that the pill row would overflow the controls panel's max-width
- **THEN** the pill row SHALL wrap onto multiple lines instead of widening the panel

### Requirement: Bus section visibility (eye) toggle

The Public Buses section header SHALL render an icon button (eye / eye-off) that controls the visibility of every map layer owned by the section: each selected provider's line, halo, chip, stop, stop-label, and hit-area layers. When the toggle is in the "hidden" state, all of those layers SHALL be set to `visibility: 'none'` regardless of any other per-provider state. When it is in the "visible" state, each selected provider's layers SHALL be set to `visibility: 'visible'` (so the pre-existing per-provider selection, day filter, and hide-low-frequency filter resume taking effect). The toggle SHALL NOT clear, modify, or otherwise affect the persisted per-provider selection, day-filter state, hide-low-frequency state, or per-provider color overrides. The toggle's state SHALL persist across reloads in `localStorage` under the key `busSectionVisible`, defaulting to `true` for first-time users.

#### Scenario: Hide the Bus section

- **WHEN** the user clicks the eye button next to the Public Buses header while it is in the "visible" state
- **THEN** every selected provider's line, halo, chip, stop, stop-label, and hit-area layers SHALL be set to `visibility: 'none'` in the same frame
- **AND** the pill row SHALL keep its pills (the selection is not cleared)
- **AND** the day picker and hide-low-frequency toggle SHALL remain interactive in the panel

#### Scenario: Restore the Bus section

- **WHEN** the user clicks the eye-off button while the section is hidden
- **THEN** each selected provider's layers SHALL be set back to `visibility: 'visible'`, restoring the prior on-map state (subject to current day filter and hide-low-frequency state)

#### Scenario: Selection survives a hide / restore cycle

- **WHEN** the user has three selected providers, hides the section, reloads the page, and restores the section
- **THEN** the same three pills SHALL be present, and the three providers' layers SHALL render with the same colors, filters, and overrides as before

#### Scenario: First-load default is visible

- **WHEN** a user with no persisted `busSectionVisible` preference opens the application
- **THEN** the Bus section visibility toggle SHALL be in the "visible" state

### Requirement: Bus line geometry shipped as per-provider PMTiles

Each bus provider's line geometry SHALL be shipped as a PMTiles vector tile bundle at `public/transit/<provider>/lines.pmtiles`, registered at runtime as a MapLibre `vector` source via the existing `pmtiles://` protocol. The runtime SHALL NOT load any per-provider `lines.geojson` for bus providers. Stops SHALL continue to be shipped as `public/transit/<provider>/stops.geojson`.

#### Scenario: Bus line source is a PMTiles vector source

- **WHEN** a bus provider's overlay is activated
- **THEN** the MapLibre source registered for that provider's lines MUST be a `vector` source whose URL begins with `pmtiles://` and points at `public/transit/<provider>/lines.pmtiles`
- **AND** the provider's line, chip, and hit-area layers MUST declare `source-layer: 'transit'`

#### Scenario: Stops remain GeoJSON

- **WHEN** a bus provider's overlay is activated
- **THEN** the MapLibre source registered for that provider's stops MUST be a `geojson` source pointing at `public/transit/<provider>/stops.geojson`

#### Scenario: PMTiles file is committed to the repo

- **WHEN** the repository is freshly cloned
- **THEN** each provider directory under `public/transit/<provider>/` MUST contain a committed `lines.pmtiles` file built by the documented build pipeline, with no fallback fetch from an external service required at runtime

### Requirement: Route highlight overlay

The system SHALL render a per-provider route-highlight layer drawn above the provider's base line layer. At most one route SHALL be highlighted at a time across all providers. When a route is highlighted, the highlight layer SHALL render the feature whose `route_id` matches the highlighted route with a thicker, fully opaque stroke that visually distinguishes it from the base lines; the provider's base line layer SHALL be visually dimmed for every feature whose `route_id` does NOT match (e.g. by reducing `line-opacity` to roughly 0.2), while the matching `route_id` retains its normal styling underneath the highlight stroke. When no route is highlighted, the highlight layer SHALL render nothing and the base line layer SHALL render with its default opacity.

#### Scenario: No highlight active

- **WHEN** no route is highlighted
- **THEN** the highlight layer SHALL render no features and the base line layer SHALL render every line at its default (undimmed) opacity

#### Scenario: A route is highlighted

- **WHEN** a route is highlighted in provider P
- **THEN** the highlight layer for P SHALL render that route's single unioned feature (its `LineString`/`MultiLineString` geometry, covering all branches) with the highlight stroke, and every other line in P SHALL be visually dimmed

#### Scenario: Highlighting a different route replaces the previous highlight

- **WHEN** route A is highlighted and the user activates the highlight on route B
- **THEN** route A SHALL no longer be highlighted and route B SHALL be the only highlighted route

### Requirement: Route highlight activation from the line popup

The system SHALL toggle the route-highlight overlay in response to the line popup's "Voir le tracé sur la carte" action. When activated for a route that is not currently highlighted, the system SHALL set that route as the highlighted route AND call `map.fitBounds` on the union of the route's feature geometries (with padding and a sensible `maxZoom`) so the route fills the viewport. When activated for the currently highlighted route, the system SHALL clear the highlight. The highlight SHALL persist after the popup is closed.

#### Scenario: Activate highlight from popup

- **WHEN** the user clicks "Voir le tracé sur la carte" in the popup for route R
- **THEN** route R becomes the highlighted route AND the map fits the bounds of R's combined geometry

#### Scenario: Highlight persists when popup closes

- **WHEN** a route is highlighted from the popup and the user then closes the popup (close button, click-outside, or Escape)
- **THEN** the route SHALL remain highlighted on the map

#### Scenario: Toggle off from the same line popup

- **WHEN** the user reopens the popup for the currently highlighted route and clicks the action again
- **THEN** the highlight SHALL be cleared and the base line layer SHALL return to its default opacity

#### Scenario: Source not yet loaded skips fit-to-bounds

- **WHEN** highlight is activated for a route but `querySourceFeatures` returns no features for the line source
- **THEN** the route SHALL still be set as the highlighted route and the map view SHALL NOT be changed

### Requirement: Route highlight dismissal

The system SHALL clear the active route highlight when any of the following occurs: (a) the user toggles the action off from the line popup for the highlighted route; (b) the user highlights a different route; (c) the highlighted route's provider overlay is toggled off.

#### Scenario: Provider toggled off clears highlight

- **WHEN** a route in provider P is highlighted and the user turns provider P's overlay off
- **THEN** the highlight SHALL be cleared, and re-enabling provider P SHALL NOT restore the previous highlight

### Requirement: Bus providers default off

Every bus provider registered in the public-transit catalog (existing and future) SHALL have `displayDefaultOn: false`. On first load, with no persisted per-provider selection in `localStorage`, no bus overlay SHALL render on the map. Users opt into bus overlays explicitly via the pill row.

#### Scenario: First-time user loads the app
- **WHEN** a user opens the app with no prior `localStorage` state for any bus provider
- **THEN** no bus provider overlay SHALL render on the map

#### Scenario: Returning user with persisted selection
- **WHEN** a user previously enabled one or more bus providers and reloads the app
- **THEN** those providers' overlays SHALL render per the persisted selection, unaffected by the default-off catalog rule

#### Scenario: New bus provider added to the catalog
- **WHEN** a developer adds a new entry to `scripts/transit/providers.config.mjs`
- **THEN** that entry SHALL set `displayDefaultOn: false`

### Requirement: Select-all / clear-all bus providers control

The Public Buses section SHALL render a single two-state toggle control that operates on the whole provider catalog at once. When at least one registered provider is not currently selected, the control SHALL be labelled "Tout afficher" and, when activated, SHALL select every registered provider (equivalent to setting each provider's visibility boolean to true). When every registered provider is already selected, the control SHALL be labelled "Tout retirer" and, when activated, SHALL clear every selection (equivalent to setting each provider's visibility boolean to false). The control SHALL persist its effect through the same per-provider `localStorage` keys used by the pills and the `Fournisseurs ▾` dropdown, so behavior survives reloads with no migration. The control SHALL NOT modify the section eye (visibility) toggle, the day filter, the hide-low-frequency toggle, or any per-provider color override. The control SHALL render in the Public Buses section header row, adjacent to the "Bus" section title, so it stays fixed at the top of the section regardless of how many providers are selected.

#### Scenario: Show all providers in one click

- **WHEN** at least one provider is unselected and the user activates the "Tout afficher" control
- **THEN** a pill SHALL appear for every registered provider, every provider's map layers SHALL become visible (subject to the current section eye state and filters), the `Fournisseurs ▾` dropdown SHALL enter its "all selected" state, and the control SHALL relabel to "Tout retirer"

#### Scenario: Clear all providers in one click

- **WHEN** every provider is selected and the user activates the "Tout retirer" control
- **THEN** all pills SHALL be removed, every provider's map layers SHALL be set to `visibility: 'none'`, every provider SHALL reappear as selectable in the `Fournisseurs ▾` dropdown, and the control SHALL relabel to "Tout afficher"

#### Scenario: Bulk selection persists across reload

- **WHEN** the user activates "Tout afficher" and reloads the page
- **THEN** every provider's pill SHALL render on the next load and every provider's overlay SHALL be visible at first paint, exactly as if each had been selected individually

#### Scenario: Control leaves other transit state untouched

- **WHEN** the user has set a non-default day filter, enabled hide-low-frequency, applied a color override to one provider, and hidden the section via the eye toggle, then activates "Tout afficher"
- **THEN** the day filter, hide-low-frequency state, the color override, and the hidden (eye-off) state SHALL all be unchanged; only the set of selected providers SHALL change

### Requirement: Legible chip route number on any provider colour

The line chip's route number SHALL be rendered in a text colour chosen from the
chip's own pill colour (the provider's currently active line colour) so that the
number stays legible on both light and dark provider colours. A light pill
colour SHALL yield a dark route-number text colour, and a dark pill colour SHALL
yield a light route-number text colour. The choice SHALL be derived from the
pill colour's relative luminance against a single fixed threshold, so a provider
whose colour is dark does not produce a dark-on-dark, unreadable chip number.

#### Scenario: Chip number legible on a dark provider colour

- **WHEN** a provider's active line colour is dark and its line chip is shown at
  zoom ≥ 12
- **THEN** the chip's route number MUST render in a light text colour so it stays
  readable against the dark pill

#### Scenario: Chip number legible on a light provider colour

- **WHEN** a provider's active line colour is light and its line chip is shown at
  zoom ≥ 12
- **THEN** the chip's route number MUST render in a dark text colour so it stays
  readable against the light pill

### Requirement: Build-time resolution of the GTFS archive layout

The transit build pipeline SHALL locate the GTFS within a downloaded archive before extracting from it, rather than assuming the files sit at the top level. Resolution SHALL be automatic and provider-agnostic: a publisher that changes how it packages a feed SHALL NOT require a configuration change here.

Resolution SHALL accept three layouts, using `routes.txt` as the anchor that marks where a GTFS lives:

- **Flat** — the files at the top level of the archive.
- **Prefixed** — the files under a directory. Extraction SHALL strip the prefix so every reader downstream is oblivious to how the feed was packaged. Where more than one directory holds a `routes.txt`, the shallowest SHALL win, so a feed also shipping a nested sample or backup copy resolves to the real one.
- **Nested** — archives inside the archive, one per validity period. The archive SHALL be unwrapped and resolution applied to its contents, to a depth of at most three, beyond which the build SHALL fail rather than recurse.

Where a publisher ships several nested archives, the one covering the period in effect now SHALL be preferred: names carry the date the period starts, so the latest start date not in the future SHALL be chosen, and where every period is still ahead, the earliest. Candidates whose names carry no date SHALL rank last, so a dated candidate is always preferred over an undated one.

Each candidate SHALL be verified to contain the anchor before being accepted, and the next candidate tried when it does not, so a publisher naming its periods by some other convention still resolves rather than failing outright. When no candidate holds a usable GTFS, the build SHALL fail with a message naming what the archive did contain — not with a bare `unzip` exit code, which reports the packaging as though the feed were broken.

Rationale: a feed packaged differently is not a feed that has broken, and the build must not report one as the other.

#### Scenario: Files at the top level
- **WHEN** a provider builds from an archive whose `routes.txt` sits at the top level
- **THEN** extraction SHALL proceed with no prefix stripped

#### Scenario: Files under a directory
- **WHEN** a provider builds from an archive whose GTFS files all sit under a single directory
- **THEN** the build SHALL succeed and the extracted files SHALL land without that directory, rather than failing because no top-level `routes.txt` matched

#### Scenario: One archive per validity period
- **WHEN** an archive contains `20260803.zip` and `20270101.zip` and the current date falls between those two dates
- **THEN** `20260803.zip` SHALL be unwrapped and used, being the period in effect, and `20270101.zip` SHALL be ignored

#### Scenario: Every published period is still ahead
- **WHEN** every nested archive names a start date in the future
- **THEN** the earliest SHALL be used, as the nearest thing to a current period

#### Scenario: Nested archives that carry no date
- **WHEN** nested archives are named without a parseable date
- **THEN** resolution SHALL still select one that contains `routes.txt`, preferring any dated candidate over an undated one

#### Scenario: A candidate without a GTFS is passed over
- **WHEN** the preferred nested archive turns out not to contain `routes.txt`
- **THEN** the next candidate SHALL be tried, and the build SHALL only fail once none holds a usable GTFS

#### Scenario: A directory inside a nested archive
- **WHEN** a nested archive itself holds the GTFS under a directory
- **THEN** both SHALL be resolved — the archive unwrapped and the prefix stripped

#### Scenario: An unusable archive reports what it held
- **WHEN** an archive contains neither `routes.txt` nor any nested archive
- **THEN** the build SHALL fail with a message naming the entries it did contain, and the provider SHALL keep its previous artifacts

#### Scenario: Flat feeds resolve to themselves
- **WHEN** every configured provider is extracted
- **THEN** only feeds that are prefixed or nested SHALL resolve to anything other than the archive itself with an empty prefix

### Requirement: A provider may be built from several GTFS archives

The build SHALL accept `gtfsUrl` as either a single URL or an array of URLs, and
when given an array SHALL download every archive and combine them into one
provider. This exists because some authorities publish one network as several
archives — Nord (59) ships four contract lots (`CAR_HDF_59_1`…`_4`), which are
operational packages rather than places and would be meaningless as separate
user-facing toggles.

Identifiers SHALL be namespaced per source archive before combining, so that a
`route_id`, `trip_id`, `shape_id` or `stop_id` repeated across two archives
cannot silently merge two different lines into one.

The `feed_sha256` recorded in `meta.json` SHALL be computed over the combined
archives, so that change detection keeps working and a change in any one archive
triggers exactly one rebuild of that provider.

#### Scenario: A multi-lot department builds as one provider

- **WHEN** `hdf-nord-59` declares four archive URLs
- **THEN** the build SHALL produce a single `public/transit/hdf-nord-59/`, and the
  picker SHALL offer one toggle labelled for the department, not four labelled
  for contract lots

#### Scenario: Ids collide between archives

- **WHEN** two of a provider's archives each publish a route with `route_id` `1`
- **THEN** the two SHALL remain distinct lines after combining

#### Scenario: One archive of several changes

- **WHEN** one of four archives is republished and the other three are unchanged
- **THEN** the provider's `feed_sha256` SHALL change and the provider SHALL be
  rebuilt once

#### Scenario: One archive of several is unreachable

- **WHEN** one archive 404s or times out while the others download
- **THEN** the provider SHALL fail as a whole and keep its existing artifacts,
  rather than publish a partial network that would read as lines having
  disappeared

### Requirement: The provider picker scales to the full catalog

The bus provider picker SHALL group its entries under their `region` and SHALL
offer a text filter over provider labels.

This is a separate concern from "`Fournisseurs ▾` dropdown rendered below the
pill row", which governs where the dropdown sits and how the pill row wraps;
this one governs what the dropdown contains. With more than sixty networks, one
flat, unfiltered list is not usable.

Filter matching SHALL be accent- and separator-insensitive, reusing the
normalisation already used by place search rather than introducing a second,
subtly different matcher.

#### Scenario: Finding a provider by name

- **WHEN** the user opens the picker and types `bretagne` or `finistere`
- **THEN** the list SHALL narrow to matching providers, matching regardless of
  accents and separators

#### Scenario: Browsing by region

- **WHEN** the user opens the picker without typing
- **THEN** providers SHALL appear grouped under region headings

#### Scenario: Every provider is already enabled

- **WHEN** no unselected providers remain
- **THEN** the picker SHALL keep its existing "all selected" behaviour
