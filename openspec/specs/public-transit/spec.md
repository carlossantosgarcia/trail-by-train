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
- `line-stops.json` — each line's stops in calling order, and its extent (see
  "A line's stops in calling order");
- `meta.json` — the build's metadata;
- the network's line ledger (see `transit-line-ledger`).

Each line Feature SHALL carry: `route_id`, `route_short_name`,
`route_long_name`, `route_color`, `route_text_color`, `reservation`,
`reservation_detail`, `observed_from`, `observed_to`, `archived`,
`last_seen_on`, `last_seen_day`, `last_feed_valid_to`, `stops_count`,
`endpoints`, `service.{weekday,saturday,sunday}`, `service_days`, an optional
`timetable_url` and, when the line is not a plain bus, `service_kind`: `train`
for a rail route the network keeps on purpose, `rail_replacement` for a road
route the same feed also publishes as a train with the same number and long
name. A line no longer in the feed is labelled by the same rule against the
current feed. A line whose geometry was estimated from its stops (see
`transit-shape-estimation`) SHALL carry `shape_estimated`: `all` when every
variant is estimated, `part` when some of the feed's shapes remain. It SHALL
NOT carry a `shape_id`.

`meta.json` SHALL carry `estimated_line_count`, the number of lines drawn with
an estimated geometry.

Each stop Feature SHALL carry: `stop_id`, `stop_name`,
`serving_lines: [{ route_id, short_name, color, reservation, service_days, archived? }]`,
`service_days` and `archived`. A serving line's `reservation` and
`service_days` SHALL mirror its route's, so the stop card can warn about
booking and filter by day without looking the route up.

#### Scenario: A line's days

- **WHEN** a network is built and one of its routes runs Monday to Friday
- **THEN** that line's Feature SHALL carry `service_days: "1111100"`

#### Scenario: An estimated line

- **WHEN** a route's only shapes are stop-to-stop and every one of them is
  replaced by an estimate
- **THEN** its Feature SHALL carry `shape_estimated: "all"`

### Requirement: Per-day service statistics

For each route, the build SHALL compute `service_days`, seven characters from
Monday to Sunday, each `1` when the line runs on that day of the week
regularly: on at least 4 dates of the feed, or in at least half of the weeks in
which the line runs at all. Otherwise it SHALL be `0`. Dates count over every
trip of the route, both directions.

It SHALL also compute one service window per day type — weekday, Saturday,
Sunday — with both directions merged: `firstDep` and `lastDep` (earliest and
latest trip departure, `HH:MM`, sorted by time), `trips` (the number of trips)
and `avgGapMin` (the mean gap between consecutive departures). A trip counts
towards a day type when its service runs on at least one such day in the feed.
A day type SHALL be `null` when it has no trips or when `service_days` has none
of its days.

A stop's `service_days` SHALL list the distinct masks of its lines,
comma-separated, leaving out any mask another of them covers (one that has
every day the first has). When more than 8 remain, it SHALL be their union.

#### Scenario: Weekday-only line

- **WHEN** a route runs on weekdays only
- **THEN** its `service_days` SHALL be `1111100`, its `service.weekday` SHALL be
  populated, and `service.saturday` and `service.sunday` SHALL be `null`

#### Scenario: One Saturday in a year

- **WHEN** a route runs every weekday for 40 weeks and on a single Saturday
- **THEN** its `service_days` SHALL be `1111100` and `service.saturday` SHALL be
  `null`

#### Scenario: Summer Saturdays

- **WHEN** a route runs every weekday of a 52-week feed and on 9 summer
  Saturdays
- **THEN** its `service_days` SHALL be `1111110`

#### Scenario: A stop with a weekday line and a weekend line

- **WHEN** a stop is served by lines with `1111100`, `0000011` and `0010000`
- **THEN** its `service_days` SHALL be `1111100,0000011`

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
hidden (as Explore does) costs no stop download. Lines still in the feed SHALL
render solid, in the line's colour (see "One colour per line"), at one shared
width (`TRANSIT_LINE_WIDTH`) that grows with the zoom, whatever their booking
status. Lines the feed no longer publishes are drawn in their own layer — see
`transit-line-ledger`. Stops SHALL be white dots ringed in the line's colour.

Visibility SHALL be phased by zoom: lines at every zoom; stops and line
numbers from zoom 12; stop names from zoom 14. The focused line's stops show
earlier (see "Route highlight"). A line's number SHALL be its short name on an
upright pill of the line's colour, with nothing added for booking: booking is
stated in the cards.

The transit layers SHALL sit above the rail stations and rail network and below
the user's overlays (hikes, GPX tracks); within a network, labels above stops,
stops above lines.

#### Scenario: Regional zoom

- **WHEN** the map is at zoom 10 with a network on and no line focused
- **THEN** its lines SHALL render, and no stops, numbers or stop names

#### Scenario: Street zoom

- **WHEN** the map is at zoom 14 with a network on
- **THEN** its lines, stops, line numbers and stop names SHALL all render

#### Scenario: A booking-required line

- **WHEN** a line with `reservation: 'required'` is drawn at zoom 12
- **THEN** its number pill SHALL read its short name alone, and the line itself
  SHALL be drawn like any other

### Requirement: Generous click targets

Each network SHALL have an invisible 12 px hit area over its lines and a hit
circle over its stops, and one tap handler SHALL serve every network. A tap
that reaches a stop SHALL select the stop nearest to it, before any line; the
stop's hit circle stays small, so a tap beside it still reaches the line. Among
lines, the focused line SHALL win over the lines it runs along. The hit areas
SHALL carry the same filters as the visible layers, so a hidden line or stop
cannot be tapped.

#### Scenario: Click near a line

- **WHEN** the user clicks within 6 px of a visible line
- **THEN** that line's card SHALL open

#### Scenario: A stop on a line

- **WHEN** the user taps a stop drawn on a line
- **THEN** the stop's card SHALL open, not the line's

#### Scenario: A filtered line

- **WHEN** the day filter hides a line
- **THEN** clicking where it would be SHALL NOT open its card

### Requirement: Line popup

Clicking a line SHALL focus it (see "Route highlight") and open its card,
anchored at the nearest point of the line's geometry (every segment of every
linestring considered), not at the raw click point. The card SHALL contain, in
order:

- the line's number chip and long name, then the network's label and the
  line's number of stops;
- the line's route (see "The line's route in its card");
- a row of pills: when the line has a `service_kind`, "Train" or "Car de
  remplacement TER"; the reservation pill when the status is known (see
  `transit-reservation-status`); when the line has `shape_estimated`, a
  pastel orange pill with a warning sign reading "Tracé estimé", or "Tracé en
  partie estimé" when it is `part`; the archived label when the line is
  `archived`; "Hors saison" when the network's feed is dormant; and the
  last-update pill coloured by the age of the data;
- one notes block gathering what the reader must weigh before relying on the
  line: the booking detail when booking is required; when the line is
  archived, why and the dates it ran; the dormant network's note; "Reconstitué
  d'après les arrêts et OpenStreetMap, faute de tracé détaillé publié par le
  réseau." when the line has `shape_estimated`; and when the feed no longer
  gives a shape, the date of the last one;
- one tile per day type (Lun–Ven, Sam, Dim), each with its number of trips
  and its first and last departure ("05:53–20:49", or one time for a single
  trip), or "Pas de service". The direction-merged `avgGapMin` SHALL NOT be
  shown: it does not say how often a bus passes in either direction;
- a "Cadrer la ligne" action (see "Route highlight") and a "Horaires" link:
  the operator's timetable PDF when there is one, otherwise the line's
  `timetable_url` when the build set one, otherwise the network's timetable
  link (see `transit-provider-catalog`); several PDFs are listed beneath;
- a footer with the data's dates, a note that the data is indicative and may
  be out of date, and the feedback button.

Escape SHALL close it.

#### Scenario: A TER replacement coach

- **WHEN** the user opens Zou's P25 coach (Grenoble – Clelles – Veynes), which the
  feed also publishes as a train
- **THEN** the card SHALL show a "Car de remplacement TER" pill

#### Scenario: A kept train

- **WHEN** the user opens Zou's line 49 (Nice – Digne-les-Bains)
- **THEN** the card SHALL show a "Train" pill

#### Scenario: A plain bus

- **WHEN** the user opens a coach line with no train on its route
- **THEN** the card SHALL show no service-kind pill

#### Scenario: A line with no Sunday service

- **WHEN** the user opens a line whose Sunday window is `null`
- **THEN** its Sunday tile SHALL read "Pas de service"

#### Scenario: A line whose reservation status is unknown

- **WHEN** the user opens a line with `reservation: 'unknown'`
- **THEN** no reservation pill SHALL be shown

#### Scenario: The card anchors on the line

- **WHEN** the user clicks the hit area a few pixels off a line
- **THEN** the card's tail SHALL point at the nearest point on the line

#### Scenario: An estimated line

- **WHEN** the user opens a Cars Haute-Corse line whose geometry was estimated
- **THEN** the card SHALL show a "Tracé estimé" pill with a warning sign, and
  its notes SHALL say "Reconstitué d'après les arrêts et OpenStreetMap, faute
  de tracé détaillé publié par le réseau."

#### Scenario: A line with its published shape

- **WHEN** the user opens a line drawn from its feed's shapes
- **THEN** the card SHALL say nothing about how its route was drawn

### Requirement: Stop popup

Clicking a stop SHALL open a card with the stop's name, the network's label
and its number of lines, and one row per line serving it: the line's chip,
a phone when the line must be booked, and a chevron. The rows SHALL be
limited to the lines whose `service_days` include every day the day filter
selects, with "+N masquée(s) par le filtre" beneath when some are hidden; a
serving line without `service_days` SHALL be shown. When a listed line must
be booked, a legend SHALL say what the phone means ("Sur réservation"). The
focused line's row SHALL be marked as such. Tapping a row SHALL open that
line's card and focus it.

#### Scenario: The filter hides some lines

- **WHEN** a stop is served by 5 lines, 2 of them weekday-only, and the day
  filter selects Saturday
- **THEN** the card SHALL show 3 rows and "+2 masquées par le filtre"

#### Scenario: A line that must be booked

- **WHEN** one of the lines serving the stop has `reservation: 'required'`
- **THEN** its row SHALL carry a phone, and the legend "Sur réservation" SHALL
  appear beneath the rows

#### Scenario: No line needs booking

- **WHEN** no line serving the stop has `reservation: 'required'`
- **THEN** no phone and no legend SHALL appear

### Requirement: Route highlight

At most one line SHALL be focused at a time, across all networks. Tapping a
line, a line row in a stop card, a search result for a line, or an Explore
chip SHALL focus that line. The focused line SHALL be drawn above its network
as a thicker line in its colour over a white casing, with its stops from zoom
8 and their names from zoom 11. While a line is focused, every other line
SHALL dim to a faint wash, other stops SHALL fade and lose their names, and
only the focused line's number SHALL stay on the map. The focus SHALL outlast
the card, and SHALL clear on a tap on empty map, from the focus bar, when
another line is focused, or when the line's network is turned off.

"Cadrer la ligne" SHALL focus the line and frame its whole extent in one move
(maximum zoom 13), padded clear of the chrome and below the focus bar, and
SHALL put the card away so it does not cover the line; the focus bar then
names the line. The extent SHALL come from `line-stops.json`; for data built
without it, the map SHALL frame what the tiles hold and widen the frame as
more of the line loads.

#### Scenario: Focusing a second line

- **WHEN** line A is focused and the user taps line B
- **THEN** only line B SHALL be focused

#### Scenario: A tap on empty map

- **WHEN** a line is focused and the user taps the map where there is no line
  or stop
- **THEN** the focus SHALL clear and every line SHALL return to its usual look

#### Scenario: Framing a long line

- **WHEN** the user taps "Cadrer la ligne" on a line running from Grenoble to
  Gap while the map shows Grenoble at zoom 13
- **THEN** the map SHALL move once to show the whole line, the card SHALL
  close, and the focus bar SHALL name the line

#### Scenario: The network is turned off

- **WHEN** the focused line's network is turned off and on again
- **THEN** no line SHALL be focused

### Requirement: Day filter

The Bus section SHALL offer a weekend filter of two small toggles, "Sam" and
"Dim", named "samedi" and "dimanche" for assistive technology, beside the label
"Week-end", none selected by default,
and the selection saved across reloads. No weekday SHALL be offered: a hiker
needs to know whether a line runs at the weekend, and most lines run on every
weekday. With no day selected every line and stop
SHALL render. With days selected, every line SHALL be hidden unless its
`service_days` has all of them. A stop SHALL be hidden unless one of its masks
has all of them. This SHALL apply on every visible layer of every network,
including the hit areas, through MapLibre filters with no data refetched. A line
or stop without `service_days` SHALL render.

While a day is selected, a line under the toggles SHALL say what is shown:
"Lignes circulant le samedi", "Lignes circulant le dimanche" or "Lignes
circulant le samedi et le dimanche". With none selected, no line SHALL be
shown.

#### Scenario: Saturday and Sunday

- **WHEN** the user selects Sam and Dim
- **THEN** only lines running on both Saturday and Sunday SHALL render, and the
  summary SHALL read "Lignes circulant le samedi et le dimanche"

#### Scenario: A stop with a Saturday line and a Sunday line

- **WHEN** a stop's lines run on Saturdays only and on Sundays only, and the
  user selects Sam and Dim
- **THEN** the stop SHALL be hidden

#### Scenario: Data built before the masks

- **WHEN** a network's tiles carry no `service_days` and Sunday is selected
- **THEN** all its lines and stops SHALL render

#### Scenario: Reload

- **WHEN** the user selects Sam and reloads
- **THEN** Sam SHALL still be selected, with no flash of unfiltered lines

#### Scenario: A weekday saved by an earlier picker

- **WHEN** the saved selection holds Wednesday and Sunday
- **THEN** only Dim SHALL be selected

### Requirement: Choosing networks

The Bus section SHALL summarise the chosen networks on one line: "Tous les
réseaux", "Aucun réseau", or "<n> réseau(x) sur <total>". Activating the summary
SHALL open, in flow, a list of every network grouped under its region, each with
a checkbox and its colour, filtered by a typed query matched regardless of
accents and separators with the same normalisation as place search, with "Tout
cocher" and "Tout décocher" above the list. Ticking or unticking a network SHALL
show or hide it without reordering the list. Opening the list SHALL scroll the
panel or sheet holding it just enough to show the whole list, never past the
summary, and the list SHALL take at most half the screen height, scrolling on
its own beyond that.

A bus icon toggle beside the summary SHALL be on while any network is chosen.
Turning it on with none chosen SHALL choose every network; turning it off SHALL
clear the choice, leaving the filters, colours and the section's eye alone.

The selection SHALL be saved per network and restored on load before the first
paint.

#### Scenario: Turning buses on

- **WHEN** no network is chosen and the user turns the bus toggle on
- **THEN** every network SHALL be drawn and the summary SHALL read "Tous les
  réseaux"

#### Scenario: Finding a network by name

- **WHEN** the user types `finistere` in the network list's filter
- **THEN** "BreizhGo Car (Finistère)" SHALL be listed

#### Scenario: Keeping three networks

- **WHEN** the user activates "Tout décocher" and ticks three networks
- **THEN** only those three SHALL be drawn and the summary SHALL read "3 réseaux
  sur <total>"

#### Scenario: Opening the list on a short screen

- **WHEN** the window is 600 px tall, the Bus section sits low in the controls
  panel, and the user activates "Tous les réseaux"
- **THEN** the panel SHALL scroll so the filter, "Tout cocher" / "Tout
  décocher" and several networks are visible

### Requirement: Network colours can be changed

A network's swatch in the network list SHALL open a palette of three
high-contrast swatches, the browser's colour picker, and "Reset" back to the
catalog colour. A chosen colour SHALL repaint that network's lines, stops and
label halos at once, with no refetch, SHALL be saved across reloads, and SHALL
NOT affect other networks; two networks MAY be given the same colour.

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
own, and SHALL be laid out like the Trains section: a header holding the title
"Bus" with its eye toggle beside it, then a row with the bus icon toggle and the
network summary. The day filter, the archived-line toggle and the validity
banner appear once at least one network is chosen. The eye SHALL hide or show
every transit layer at once without touching the selection, filters or colours,
saved across reloads and visible by default. On phones the whole section SHALL
be reachable in the controls sheet by vertical scrolling alone, with the
network list and colour palettes kept inside the sheet, the weekend toggles
on the same row as their label, each at least 30 px tall, and network rows at least 44 px tall.

#### Scenario: Hiding and restoring the section

- **WHEN** the user hides the section with its eye, reloads, and shows it again
- **THEN** the same networks SHALL be drawn, with the same colours and filters

#### Scenario: A first visit

- **WHEN** the user selects a first network with nothing saved
- **THEN** neither Sam nor Dim SHALL be selected, every line SHALL render, and
  "Afficher les lignes hors horaire actuel" SHALL be ticked

#### Scenario: Every network chosen

- **WHEN** every network is chosen
- **THEN** the section SHALL show one summary line, not one entry per network

### Requirement: Line and stop details as a sheet on phones

The line card and the stop card SHALL, on viewports at or below the mobile
breakpoint, render as a transient bottom sheet instead of a map-anchored card:
full width, scrollable, opening at half height capped to its content, with the
line's chip and long name — or the stop's name — and a close button in the
head. Its content and actions SHALL be those of the card. Tapping a line row
in a stop's sheet SHALL show that line in the same sheet. The sheet SHALL close
on its close button, `Escape`, the back action, a decisive downward drag, or a
tap on the map that opens no feature (see `responsive-ui`). On wider viewports
the cards SHALL stay anchored on the map as described in "Line popup" and
"Stop popup".

#### Scenario: A tapped line on a phone

- **WHEN** the user taps a bus line on a 390 px wide viewport
- **THEN** the line's details MUST open in a sheet spanning the screen's width,
  entirely on screen, with "Cadrer la ligne" and "Horaires" reachable by
  scrolling the sheet

#### Scenario: From a stop to one of its lines

- **WHEN** the user taps a stop on a phone and then one of its line rows
- **THEN** the same sheet MUST show that line's details

#### Scenario: Framing from the sheet

- **WHEN** the user taps "Cadrer la ligne" in a line's sheet
- **THEN** the sheet MUST close and the whole line MUST be framed between the
  focus bar and the bottom of the screen

### Requirement: Operator timetable PDFs

The operator timetable PDFs known for a network's lines SHALL be committed as
`data/timetable-pdfs/<provider id>.csv`, with the header
`route_id,line,url,label,valid_from,valid_to,scope`:

- `route_id`: the line, as in the network's data; `line`: its short name, for
  readers only;
- `url`: a document the line's operator publishes on its official site;
- `label`: short French text without dates, such as "Fiche horaire", "Guide du
  réseau" or "Fiche horaire (été)";
- `valid_from`, `valid_to`: `YYYY-MM-DD` as the operator states them, next to
  the link or in the PDF, or empty. They SHALL NOT be inferred from an edition
  name such as "2026-2027" or from a September start;
- `scope`: `line`, or `network` for a document covering every line.

A line's rows SHALL be in order of preference, its own sheets before
`network` documents. A URL SHALL appear once per line. The test suite SHALL
reject a file with another header, a row without a `route_id` or a valid URL, a
malformed date, `valid_from` after `valid_to`, an unknown `scope`, a duplicate,
or a name that is not a provider id.

The app SHALL load a network's file at most once per session, only when one of
its lines is opened. A network without a file, or whose file fails to load,
SHALL behave as if no line had a PDF.

#### Scenario: Fixing a link

- **WHEN** an operator moves a line's sheet and someone edits that row's `url`
- **THEN** the next deployment SHALL link the new URL, with no data rebuild

#### Scenario: A sheet that only gives its start

- **WHEN** a sheet says "Horaires valables à partir du 01/09/2026" and gives no
  end date
- **THEN** its row SHALL have `valid_from` `2026-09-01` and an empty `valid_to`

#### Scenario: Line codes that repeat across departments

- **WHEN** Rémi publishes a sheet for line "10" in Eure-et-Loir and another for
  line "10" in Loiret
- **THEN** each SHALL be listed under its own department's `route_id`

### Requirement: One colour per line

A line SHALL look the same on the map as in everything that names it — its
card's chip and rail, the stop cards' rows, the focus bar, Explore's chips:
the network's colour, or the one the user chose for the network, or, while
Explore draws the line, its Explore palette colour. A feed's own
`route_color` SHALL NOT be shown.

#### Scenario: A line in Explore

- **WHEN** Explore draws a matched line in a palette colour and the user opens
  its card
- **THEN** the card's chip and rail SHALL be in that palette colour

#### Scenario: A network the user recoloured

- **WHEN** the user picks a colour for a network and opens one of its lines
- **THEN** the line, its chip in the card and its row in a stop card SHALL be
  in that colour

### Requirement: A line's stops in calling order

The build SHALL write, per network, `line-stops.json`: a table of the merged
stops (id, name, position) and, per line, its extent and its variants. A
variant is one way the line runs — its merged stops in calling order, with
two poles of one merged stop in a row counted once — with the direction it
runs in and how many trips run it. A stop pattern whose stops all appear, in
the same order, in a longer pattern of the same direction SHALL be folded
into it, its trips counted for it, so short turns and runs that skip stops do
not show as variants. Each direction SHALL keep its 6 busiest variants,
busiest first. Direction 0 SHALL run from the card's first terminus to its
second. A line the feed no longer carries SHALL keep the variants of the last
build. A line's number of stops in its card SHALL count its distinct merged
stops over every variant, when the file has it.

#### Scenario: An express beside the stopping service

- **WHEN** a line's trips run one 40-stop pattern and one 15-stop pattern that
  skips stops of the first
- **THEN** the line SHALL have one variant in that direction, counting the
  trips of both

#### Scenario: Two branches

- **WHEN** a line's trips leave one terminus for two different hamlets
- **THEN** the line SHALL have two variants in that direction, the busier one
  first

### Requirement: The line's route in its card

The line card SHALL show the line's route on a vertical rail in the line's
colour: its two termini, and between them a fold reading "N arrêts
intermédiaires", with "· K parcours" when the direction has several variants.
Unfolding SHALL list the stops in calling order, rail and dots on one axis.
When the direction has several variants, a choice between them SHALL be
offered, each named by its first and last stops and its number of stops,
busiest first. "Sens inverse" SHALL show the other direction when the line has
one, and "Masquer les arrêts" SHALL fold the list again. Tapping a stop in the
list SHALL bring the map to it (at least zoom 14), open that stop's card and
keep the line focused. Without `line-stops.json` for the network, the route
SHALL show the two termini only.

#### Scenario: A line with two branches

- **WHEN** the user unfolds the stops of a line with two variants in its
  first direction
- **THEN** both variants SHALL be offered, and picking one SHALL list its stops

#### Scenario: From the list to the map

- **WHEN** the user taps a stop in the list
- **THEN** the map SHALL move to that stop, its card SHALL open, and the line
  SHALL stay focused

### Requirement: The focus bar

A bar at the top of the map SHALL name the focused line while its card is
closed: its chip, its long name and its network. Tapping the bar SHALL
reopen the line's card; its close button SHALL clear the focus.

#### Scenario: The card is put away

- **WHEN** the user focuses a line and closes its card
- **THEN** the focus bar SHALL name the line, and tapping it SHALL reopen the
  card

#### Scenario: Letting go from the bar

- **WHEN** the user taps the focus bar's close button
- **THEN** the focus SHALL clear and the bar SHALL disappear

### Requirement: The card stays on screen

On wider viewports, a line or stop card SHALL never be taller than the visible
map: a longer card SHALL scroll inside itself. When a card grows past the edge
of the map, as when its stop list is unfolded, the map SHALL pan so the whole
card is in view.

#### Scenario: Unfolding a long stop list

- **WHEN** the user unfolds the stops of a 40-stop line whose card is anchored
  low on a 720 px tall window
- **THEN** the whole card SHALL stay within the window, its list scrolling
  inside it

