# public-transit Specification

## Purpose
The overlay shared by every bus, coach and shuttle network: the data the build
emits for each network, how lines and stops are drawn at each zoom, their
popups, the filters and highlight, the Bus section of the controls, and the
pipeline that turns GTFS feeds into map data. Which networks exist, and what each
declares, is the `transit-provider-catalog` capability.

## Requirements
### Requirement: One overlay module for every network

The app SHALL render every network with the same overlay module
(`src/transit/transitOverlay.ts`) and the same popup (`src/transit/TransitPopup.tsx`),
driven by the network's catalog entry, with no network-specific branching.
Build-time differences between operators (how a feed encodes booking, which
files it ships) SHALL be expressed in the catalog entry and handled by helpers
in `scripts/transit/lib/`; the shared library SHALL NOT carry heuristics aimed
at one operator.

#### Scenario: The map and the pipeline cannot disagree

- **WHEN** a network's label, region, colour, attribution or default visibility
  is changed in `providers.config.mjs`
- **THEN** the app MUST show the new value with no other edit, because it holds
  no copy of those fields

#### Scenario: A catalog entry is missing a field the app reads

- **WHEN** an entry lacks one of `id`, `label`, `region`, `attribution`,
  `lineColor`, `displayDefaultOn` or `timetable`
- **THEN** the TypeScript build SHALL fail, through the types declared in
  `providers.config.d.mts`

### Requirement: What the build emits per network

`npm run build:transit -- <id>` (or `all`) SHALL download a network's feed and
write `public/transit/<id>/`:

- `lines.pmtiles` — vector tiles, source layer `transit`, one line Feature per
  `route_id`;
- `stops.geojson` — one Point Feature per stop served by a drawn line;
- `meta.json` — the build's metadata;
- the network's line ledger (see `transit-line-ledger`).

Each line Feature SHALL carry: `route_id`, `route_short_name`,
`route_long_name`, `route_color`, `route_text_color`, `reservation`,
`reservation_detail`, `observed_from`, `observed_to`, `archived`,
`last_seen_on`, `last_seen_day`, `last_feed_valid_to`, `stops_count`,
`endpoints`, `service.{weekday,saturday,sunday}`, an optional `timetable_url`,
`runs_weekday`, `runs_saturday`, `runs_sunday` and `is_low_freq`. It SHALL NOT
carry a `shape_id`.

Each stop Feature SHALL carry: `stop_id`, `stop_name`,
`serving_lines: [{ route_id, short_name, color, reservation, archived? }]`,
`runs_weekday`, `runs_saturday`, `runs_sunday`, `has_high_freq_line` and
`archived`. A serving line's `reservation` SHALL mirror its route's, so the stop
popup can warn about booking without looking the route up.

`observed_from` / `observed_to` report the active-date window as published — an
observation, not a classification. The schema SHALL NOT classify lines as
seasonal: a short window cannot tell a winter-only line from a feed that
publishes only a few weeks ahead. Booking is carried by the three-state
`reservation` (see `transit-reservation-status`), never by a boolean. The runtime
SHALL treat a missing `reservation` as `unknown` and a missing `archived` as
`false`, so incomplete data understates certainty rather than overstating it.

#### Scenario: Two networks, one shape

- **WHEN** two networks are built
- **THEN** every Feature of both SHALL have the same properties, and the popup
  SHALL show the same structure for both

#### Scenario: A line with no reservation property

- **WHEN** the runtime reads a line Feature with no `reservation`
- **THEN** it SHALL treat the line's status as `unknown`, not as "no booking
  needed"

### Requirement: Per-day service statistics

For each route, the build SHALL compute one service window per day type —
weekday, Saturday, Sunday — with both directions merged: `firstDep` and
`lastDep` (earliest and latest trip departure, `HH:MM`, sorted by time),
`trips` (the number of trips) and `avgGapMin` (the mean gap between consecutive
departures). A trip counts towards a day type when its service runs on at least
one such day in the feed. A day type with no trips SHALL be `null`.

`runs_<day>` SHALL be true when the line has at least one trip that day, and a
stop's `runs_<day>` true when at least one of its lines does. `is_low_freq` SHALL
be true when a line has at least one and at most `lowFreqThreshold` weekday trips
(set per network in the catalog) and runs neither Saturday nor Sunday. A stop's
`has_high_freq_line` SHALL be true when at least one of its lines is not
low-frequency.

#### Scenario: Weekday-only line

- **WHEN** a route runs on weekdays only
- **THEN** its `service.weekday` SHALL be populated and `service.saturday` and
  `service.sunday` SHALL be `null`

#### Scenario: Departures in a feed's non-padded time format

- **WHEN** a feed writes departures as `9:05:00` and `10:00:00`
- **THEN** `firstDep` SHALL be `09:05`

### Requirement: Line geometry is the dissolved union of its shape variants

The build SHALL, for each `route_id`, dissolve all of that route's shape variants
into one geometry: segments shared by several variants, within a single
named distance tolerance of the order of 10–15 m, SHALL appear once, and
diverging branches SHALL be kept. The result is a `LineString` when one branch
remains, otherwise a `MultiLineString`. The dissolve SHALL be deterministic —
repeated builds over an unchanged feed produce identical geometry — and SHALL
apply to every network without configuration.

#### Scenario: Overlapping trunk is emitted once

- **WHEN** two variants of a route run along the same road before diverging
- **THEN** the shared road SHALL be drawn once, not once per variant

#### Scenario: Divergent branches are preserved

- **WHEN** variants of a route follow different roads beyond the tolerance
- **THEN** each branch SHALL be part of the route's geometry

### Requirement: Stops merged by name and proximity

The build SHALL merge stops that share a normalised `stop_name` and lie within
75 m of one another (a shared helper in `scripts/transit/lib/`), so the two
poles of a stop on either side of the road become one. A merged stop SHALL take
the centroid of its members, the first member's `stop_id` and `stop_name` by
ascending `stop_id`, the union of their `serving_lines` deduplicated by
`route_id`, and the OR of their `runs_<day>` and `has_high_freq_line`. The merge
SHALL be deterministic.

#### Scenario: Two poles of one stop

- **WHEN** a feed has two stops with the same name 17 m apart
- **THEN** `stops.geojson` SHALL contain one stop at their midpoint, served by
  the lines of both

#### Scenario: Same name, far apart

- **WHEN** two stops named "MAIRIE" lie 5 km apart
- **THEN** both SHALL remain

### Requirement: Build-time resolution of the GTFS archive layout

The build SHALL locate the GTFS within a downloaded archive before extracting
from it, rather than assuming the files sit at the top level, with no
per-network configuration. Using `routes.txt` as the anchor, it SHALL accept:

- **Flat** — the files at the top level of the archive.
- **Prefixed** — the files under a directory. Extraction SHALL strip the prefix.
  Where more than one directory holds a `routes.txt`, the shallowest SHALL win.
- **Nested** — archives inside the archive, one per validity period, unwrapped to
  a depth of at most three, beyond which the build SHALL fail.

Among nested archives, the one in effect now SHALL be preferred: the latest
start date (read from the name) not in the future, or the earliest when all are
ahead; undated candidates rank last. Each candidate SHALL be checked for the
anchor and the next one tried when it lacks it. When none holds a GTFS, the build
SHALL fail with a message naming what the archive contained, because a feed
packaged differently is not a feed that has broken.

#### Scenario: Files under a directory

- **WHEN** an archive's GTFS files all sit under one directory
- **THEN** the build SHALL succeed, with the files extracted without it

#### Scenario: One archive per validity period

- **WHEN** an archive contains `20260803.zip` and `20270101.zip` and today falls
  between those dates
- **THEN** `20260803.zip` SHALL be used

#### Scenario: A candidate without a GTFS is passed over

- **WHEN** the preferred nested archive has no `routes.txt`
- **THEN** the next candidate SHALL be tried, and the build SHALL fail only when
  none holds a GTFS

#### Scenario: An unusable archive reports what it held

- **WHEN** an archive holds neither `routes.txt` nor a nested archive
- **THEN** the build SHALL fail naming the entries it did contain, and the
  network SHALL keep its previous artifacts

### Requirement: A network may be built from several archives

`gtfsUrl` SHALL accept one URL or several. Given several, the build SHALL
download every archive and combine them into one network, because some
authorities publish one network as several contract lots — operational packages,
meaningless as separate toggles. Identifiers (`route_id`, `trip_id`, `shape_id`,
`stop_id`) SHALL be namespaced per archive before combining, and `feed_sha256`
SHALL be computed over all of them. If any archive fails to download, the
network SHALL fail as a whole and keep its existing artifacts rather than
publish a partial network.

#### Scenario: A multi-lot department

- **WHEN** `hdf-nord-59` declares several archive URLs
- **THEN** the build SHALL produce one `public/transit/hdf-nord-59/` and the
  picker SHALL offer one toggle

#### Scenario: Ids collide between archives

- **WHEN** two archives each publish a route with `route_id` `1`
- **THEN** they SHALL remain two lines

### Requirement: Build metadata and the validity banner

Each build SHALL write `meta.json` with at least `provider_id`, `label`,
`attribution`, `built_at`, `last_checked_on`, `feed_sha256`, `feed_valid_from`,
`feed_valid_to`, `license`, `source_url` and `line_count`.

`built_at` SHALL record when the artifacts were last generated, and
`last_checked_on` when the feed was last downloaded and compared. A refresh that
finds the feed unchanged (same `feed_sha256`) SHALL skip the rebuild, advance
`last_checked_on` and leave `built_at` alone.

The Bus section SHALL show one validity banner for the networks currently
selected, reporting the worst of them: a feed past its `feed_valid_to`, or else
one ending within 30 days. Dates SHALL be compared as calendar dates in French
time (Europe/Paris), so a feed is valid until the end of its last day. When every selected feed is valid for longer, or
declares no end date, the banner SHALL NOT render.

#### Scenario: An unchanged feed

- **WHEN** a refresh downloads a feed identical to the one behind the artifacts
- **THEN** `last_checked_on` SHALL advance while `built_at` keeps its date

#### Scenario: A selected feed has expired

- **WHEN** one selected network's `feed_valid_to` is in the past
- **THEN** the banner SHALL name that network and the date it expired, marked as
  a warning

#### Scenario: The last valid day

- **WHEN** today, in France, is a selected network's `feed_valid_to`
- **THEN** the feed MUST NOT be reported as expired

#### Scenario: Every selected feed is current

- **WHEN** every selected network's feed is valid for more than 30 days
- **THEN** no banner SHALL render

### Requirement: Lines and stops on the map

Each network SHALL be drawn from a PMTiles `vector` source (`pmtiles://`, source
layer `transit`) for its lines and a GeoJSON source for its stops, both loaded
from the site's own `transit/<id>/` folder. A network's `stops.geojson` SHALL be
fetched only when its stops are first shown, so a network mounted with stops
hidden (as Explore does) costs no stop download. Lines still in the feed SHALL render
solid, in the network's active colour, at one shared width
(`TRANSIT_LINE_WIDTH`), whatever their booking status. Lines the feed no longer
publishes are drawn in their own layer — see `transit-line-ledger`. Stops SHALL
be circles in the network's active colour with a dark stroke.

Visibility SHALL be phased by zoom: lines at every zoom, stops from zoom 9, and
line labels and stop names from zoom 12. A line's label is its short name,
preceded by "·" when the line must be booked.

The transit layers SHALL sit above the rail stations and rail network and below
the user's overlays (hikes, GPX tracks); within a network, labels above stops,
stops above lines.

#### Scenario: Country-scale zoom

- **WHEN** the map is at zoom 6 with a network on
- **THEN** its lines SHALL render, and no stops or labels

#### Scenario: Agglomeration-scale zoom

- **WHEN** the map is at zoom 12 with a network on
- **THEN** its lines, stops, line labels and stop names SHALL all render

#### Scenario: A booking-required line

- **WHEN** a line with `reservation: 'required'` is labelled at zoom 12
- **THEN** its label SHALL read "· <short name>", and the line itself SHALL be
  drawn like any other

### Requirement: Generous click targets

Each network SHALL have an invisible 12 px hit area over its lines and over its
stops, and the click and hover handlers SHALL listen on those, so a click near a
line or stop selects it. Stop names SHALL also open the stop's popup. The hit
areas SHALL carry the same filters as the visible layers, so a hidden line or
stop cannot be clicked.

#### Scenario: Click near a line

- **WHEN** the user clicks within 6 px of a visible line
- **THEN** that line's popup SHALL open

#### Scenario: A filtered line

- **WHEN** the day filter or the low-frequency toggle hides a line
- **THEN** clicking where it would be SHALL NOT open its popup

### Requirement: Line popup

Clicking a line SHALL open a popup anchored at the nearest point of the line's
geometry (every segment of every linestring considered), not at the raw click
point, containing:

- the line's short-name chip and long name, and the network's label;
- a reservation pill for every line, with the booking detail when booking is
  required;
- a "Dernière mise à jour" pill coloured by the age of the data, and the feed's
  published end date where it declares one;
- a warning when the line is `archived`;
- the number of stops and the two endpoints;
- one row per day type: "05:53–20:49 · 5 trajets", or "20:49 · 1 trajet" for a
  single trip, or "Pas de service". The direction-merged `avgGapMin` SHALL NOT be
  shown: it does not say how often a bus passes in either direction;
- a "Voir le tracé sur la carte" action, reading "Masquer le tracé" when this line
  is the highlighted one;
- a "Voir les horaires →" link: the line's `timetable_url` when the build set one,
  otherwise the network's timetable link (see `transit-provider-catalog`);
- a footer saying the data is indicative and may be out of date.

Escape SHALL close it.

#### Scenario: A line with no Sunday service

- **WHEN** the user opens a line whose Sunday window is `null`
- **THEN** its Sunday row SHALL read "Pas de service"

#### Scenario: A line whose reservation status is unknown

- **WHEN** the user opens a line with `reservation: 'unknown'`
- **THEN** a pill reading "Réservation : inconnue" SHALL be shown, with no
  explanation beneath it

#### Scenario: The popup anchors on the line

- **WHEN** the user clicks the hit area a few pixels off a line
- **THEN** the popup's tail SHALL point at the nearest point on the line

### Requirement: Stop popup

Clicking a stop SHALL open a popup with the stop's name and a chip for each line
serving it, limited to the lines the day filter and the low-frequency toggle
currently show, with "+N masquée(s) par le filtre" beneath when some are hidden.
A line that must be booked SHALL get a warning row, "<short name> sur
réservation", and a line whose status is unknown a muted row, "<short name>
réservation inconnue". Clicking a chip SHALL open that line's popup instead.

#### Scenario: The filter hides some lines

- **WHEN** a stop is served by 5 lines and the active filter hides 2
- **THEN** the popup SHALL show 3 chips and "+2 masquées par le filtre"

#### Scenario: Every line is known not to need booking

- **WHEN** every line serving the stop has `reservation: 'not_required'`
- **THEN** no reservation row SHALL appear

### Requirement: Route highlight

"Voir le tracé sur la carte" SHALL make that line the highlighted route and fit
the map to it (maximum zoom 13, padded clear of the chrome). At most one route
SHALL be highlighted at a time, across all networks. The highlighted route SHALL
be drawn above its network as a thicker line in the network's colour over a
white casing, while the network's other lines dim to a faint wash. The highlight
SHALL outlast the popup, and SHALL clear when the action is used again, when
another route is highlighted, or when the route's network is turned off.

When the line's geometry is not loaded yet, the route SHALL still be highlighted
and the map left where it is.

#### Scenario: Highlighting a second route

- **WHEN** route A is highlighted and the user highlights route B
- **THEN** only route B SHALL be highlighted

#### Scenario: The network is turned off

- **WHEN** the highlighted route's network is turned off and on again
- **THEN** the highlight SHALL be gone

### Requirement: Day filter

The Bus section SHALL offer a day filter — "Tous", "Lun–Ven", "Sam", "Dim" —
defaulting to "Tous" and saved across reloads. A day SHALL hide every line and
stop whose `runs_<day>` is false, on every visible layer of every network
including the hit areas, through MapLibre filters with no data refetched.

#### Scenario: Sunday

- **WHEN** the day filter is set to "Dim"
- **THEN** only lines and stops with `runs_sunday` SHALL render

#### Scenario: Reload

- **WHEN** the user sets "Sam" and reloads
- **THEN** the filter SHALL start on "Sam", with no flash of unfiltered lines

### Requirement: Hiding low-frequency lines

The Bus section SHALL offer "Masquer les lignes peu fréquentes", off by default
and saved across reloads, which hides every line with `is_low_freq` and every
stop without a `has_high_freq_line`, combined with the day filter.

#### Scenario: Combined with a day

- **WHEN** the day filter is "Sam" and low-frequency lines are hidden
- **THEN** only lines with `runs_saturday` and not `is_low_freq` SHALL render

### Requirement: Choosing networks

The Bus section SHALL list the selected networks as a wrapping row of pills, each
with its colour, label and a remove control, and SHALL offer the others from a
"+ Fournisseurs ▾" picker on its own row below. The picker SHALL group networks
under their region and filter them by a typed query, matched regardless of
accents and separators with the same normalisation as place search. When every
network is selected it SHALL say "Tous les fournisseurs sont sélectionnés".

A "Tout afficher" / "Tout retirer" control in the section header SHALL select or
clear every network at once, leaving the filters, colours and the section's
visibility toggle alone.

The selection SHALL be saved per network and restored on load before the first
paint.

#### Scenario: Picking a network

- **WHEN** the user picks a network in the picker
- **THEN** its pill SHALL appear, its lines SHALL show, and it SHALL leave the
  picker's list

#### Scenario: Finding a network by name

- **WHEN** the user types `finistere` in the picker
- **THEN** "BreizhGo Car (Finistère)" SHALL be listed

#### Scenario: Clearing every network

- **WHEN** every network is selected and the user activates "Tout retirer"
- **THEN** every pill SHALL be removed and the control SHALL read "Tout afficher"

### Requirement: Network colours can be changed

A network's colour ring on its pill SHALL open a palette of three high-contrast
swatches, the browser's colour picker, and "Reset" back to the catalog colour.
A chosen colour SHALL repaint that network's lines, stops and label halos at
once, with no refetch, SHALL be saved across reloads, and SHALL NOT affect other
networks; two networks MAY be given the same colour.

A line label's text colour SHALL be chosen from the luminance of its pill colour
against one fixed threshold, so the number stays readable on light and dark
colours alike.

#### Scenario: Picking a swatch

- **WHEN** the user picks a swatch for one network
- **THEN** that network SHALL repaint in it, and the choice SHALL survive a
  reload

#### Scenario: A dark colour

- **WHEN** a network's colour is dark
- **THEN** its line labels SHALL use light text

### Requirement: The Bus section

The Bus section of the controls SHALL always be expanded, with no fold of its
own. Its pills and picker are always shown; the day filter, the low-frequency
and archived-line toggles and the validity banner appear once at least one
network is selected. Its header SHALL carry
an eye toggle that hides or shows every transit layer at once without touching
the selection, filters or colours, saved across reloads and visible by default.
On phones the whole section SHALL be reachable in the controls sheet by vertical
scrolling alone, with colour popovers kept inside the sheet and day chips at
least 44 px in each dimension.

#### Scenario: Hiding and restoring the section

- **WHEN** the user hides the section with its eye, reloads, and shows it again
- **THEN** the same networks SHALL be drawn, with the same colours and filters
