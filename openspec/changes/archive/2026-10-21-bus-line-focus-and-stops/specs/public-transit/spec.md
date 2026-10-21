## MODIFIED Requirements

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

## ADDED Requirements

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
