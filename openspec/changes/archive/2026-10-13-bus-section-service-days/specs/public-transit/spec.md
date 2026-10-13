## MODIFIED Requirements

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
`endpoints`, `service.{weekday,saturday,sunday}`, `service_days`, an optional
`timetable_url` and, when the line is not a plain bus, `service_kind`: `train`
for a rail route the network keeps on purpose, `rail_replacement` for a road
route the same feed also publishes as a train with the same number and long
name. A line no longer in the feed is labelled by the same rule against the
current feed. It SHALL NOT carry a `shape_id`.

Each stop Feature SHALL carry: `stop_id`, `stop_name`,
`serving_lines: [{ route_id, short_name, color, reservation, service_days, archived? }]`,
`service_days` and `archived`. A serving line's `reservation` and
`service_days` SHALL mirror its route's, so the stop popup can warn about
booking and filter by day without looking the route up.

#### Scenario: A line's days

- **WHEN** a network is built and one of its routes runs Monday to Friday
- **THEN** that line's Feature SHALL carry `service_days: "1111100"`

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

- **WHEN** the day filter hides a line
- **THEN** clicking where it would be SHALL NOT open its popup

### Requirement: Stop popup

Clicking a stop SHALL open a popup with the stop's name and a chip for each line
serving it, limited to the lines whose `service_days` include every day the day
filter selects, with "+N masquée(s) par le filtre" beneath when some are hidden.
A serving line without `service_days` SHALL be shown. A line that must be
booked SHALL get a warning row, "<short name> sur réservation", and a line whose
status is unknown a muted row, "<short name> réservation inconnue". Clicking a
chip SHALL open that line's popup instead.

#### Scenario: The filter hides some lines

- **WHEN** a stop is served by 5 lines, 2 of them weekday-only, and the day
  filter selects Saturday
- **THEN** the popup SHALL show 3 chips and "+2 masquées par le filtre"

#### Scenario: Every line is known not to need booking

- **WHEN** every line serving the stop has `reservation: 'not_required'`
- **THEN** no reservation row SHALL appear

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

## REMOVED Requirements

### Requirement: Hiding low-frequency lines

**Reason**: It hid half the lines, including rural coaches with two round trips
a day, and changed nothing at the weekend; a trip count cannot say whether a
line suits a day out. The weekend filter replaces it.
**Migration**: The saved `hp:bus-hide-low-freq` setting is ignored.
`is_low_freq` and `has_high_freq_line` are no longer emitted.
