## MODIFIED Requirements

### Requirement: Only networks that can be drawn

The build SHALL draw a route from the shapes its trips reference in
`shapes.txt`. A route with no usable shape in the current feed — including a
feed that no longer ships `shapes.txt`, which SHALL be extracted when present
rather than required — SHALL take the geometry recorded for the same line in
its ledger, when at least 90% of the stops the line serves in the current feed
lie within 200 m of that geometry, and SHALL carry
`shape_seen_on`: the date that shape was last published. Its popup SHALL say
"Tracé relevé le <date> : le réseau ne publie plus le tracé de ses lignes."

The build SHALL NOT fabricate geometry from stop sequences: a route with no
usable shape and no matching ledger geometry SHALL be omitted, and stops left
with no drawn route SHALL be dropped. A feed from which no route can be drawn
SHALL NOT be registered, and a registered network whose feed stops yielding any
drawable route SHALL fail its build and keep its last good artifacts.

#### Scenario: A candidate feed without shapes

- **WHEN** a feed ships no `shapes.txt`, or no trip in it references a shape
- **THEN** it SHALL NOT be registered, and the area it would cover SHALL be
  treated as a known gap

#### Scenario: A registered feed loses its shapes

- **WHEN** a network's new feed ships no `shapes.txt`, its lines are in the
  ledger, and the stops they serve lie on their recorded shapes
- **THEN** its build SHALL succeed, drawing those lines with their recorded
  geometry and `shape_seen_on`, and the timetable data SHALL come from the new
  feed

#### Scenario: A line that now runs elsewhere

- **WHEN** a line in a feed without shapes serves stops more than 200 m from
  its recorded shape, beyond one stop in ten
- **THEN** that line SHALL NOT be drawn with the recorded shape

#### Scenario: A new line in a feed without shapes

- **WHEN** a feed without shapes carries a line the ledger has never seen
- **THEN** that line SHALL NOT be drawn

#### Scenario: A registered feed yields nothing drawable

- **WHEN** a network's new feed yields no drawable route, even with the ledger's
  geometry
- **THEN** its build SHALL fail without overwriting `lines.pmtiles` or
  `stops.geojson`, and the other networks SHALL still be built

### Requirement: Whole feeds, whatever files they ship

A network SHALL be built from its whole feed, with no per-line inclusion or
exclusion, except that routes whose GTFS `route_type` is rail — `2`, or the
extended rail types `100` to `117` — SHALL be left out, with the trips that run
them and any stops and shapes only they use. Trains are drawn by the rail overlay,
not as bus lines. A network MAY keep named rail routes the rail overlay does not
draw, listed as route_id prefixes in its `keepRailRoutes` with a comment giving the
reason. Every other route type SHALL be kept, including road coaches
that share a train's number, trams, metro, funiculars and cable cars. Excluded
routes SHALL NOT be archived in the network's line ledger, and the number left out
SHALL be reported per network in the build log and job summary.

`requiredFiles` SHALL list exactly the files that feed ships, and the build SHALL
accept feeds that:

- carry service days only as exceptions in `calendar_dates.txt`, with no
  `calendar.txt`;
- omit `feed_info.txt`, or ship one without dates — the published validity in
  `meta.json` is then null.

A trip's first stop SHALL be its stop with the lowest `stop_sequence`, whatever
number the feed starts from: GTFS only requires the numbers to increase.

`shapes.txt` SHALL be extracted when the feed ships it and SHALL NOT fail the
build when it does not (see "Only networks that can be drawn").

Any other required file missing from a download SHALL fail that network's build
with a message naming the file.

#### Scenario: A feed with no calendar.txt

- **WHEN** a network is built from a feed whose services are all in
  `calendar_dates.txt`
- **THEN** the build SHALL succeed and its lines SHALL still carry per-day
  service statistics

#### Scenario: A feed with no feed_info.txt

- **WHEN** a network's feed ships no `feed_info.txt`
- **THEN** the build SHALL succeed with `feed_valid_from` and `feed_valid_to` null
  in `meta.json`

#### Scenario: A bus feed that bundles trains

- **WHEN** the Zou feed publishes TER line K24 with `route_type` 2
- **THEN** K24 SHALL NOT be drawn, searched or matched as a bus line, and the build
  summary SHALL count it among Zou's excluded rail routes

#### Scenario: A coach sharing a train's number

- **WHEN** the same feed publishes coach P25 with `route_type` 3 alongside train P25
- **THEN** coach P25 SHALL be drawn as a bus line

#### Scenario: A train already in the ledger

- **WHEN** a network's ledger holds a line that is now excluded as rail
- **THEN** that line SHALL be removed, not drawn as a line no longer published;
  stops served only by it SHALL be dropped, and no stop SHALL list it among its
  lines

#### Scenario: A train the rail overlay does not draw

- **WHEN** Zou keeps `CFP:` routes, the Chemins de fer de Provence (line 49, Nice –
  Digne), which are not on the SNCF network
- **THEN** line 49 SHALL still be drawn, as a train

#### Scenario: A funicular network

- **WHEN** a network's routes are `route_type` 7
- **THEN** they SHALL be kept

#### Scenario: A feed that numbers its stops from 2

- **WHEN** every trip of a feed starts at `stop_sequence` 2
- **THEN** each trip SHALL count in its line's per-day service, departing at the
  time of its stop numbered 2, and the line's endpoints SHALL name its real
  first and last stops

## ADDED Requirements

### Requirement: The dataset's current file is fetched

The build SHALL download, for a network declared with a single `gtfsUrl` and a
`sourceUrl` naming a transport.data.gouv.fr dataset, the dataset's current
GTFS file, looked up in the transport.data.gouv.fr catalogue once per run: the
dataset's only available GTFS resource, or, when it has several, the configured
`gtfsUrl` if it is still one of them and otherwise the most recently updated.
The configured `gtfsUrl` SHALL be used whenever the lookup fails or finds no
GTFS resource. The URL used SHALL be recorded in `meta.json` as `gtfs_url`, and
a change of URL SHALL force a fresh download.

#### Scenario: A newer edition replaces the pinned file

- **WHEN** a network's config names a dated file and the dataset now lists only
  a newer one
- **THEN** the build SHALL download the newer file and record its URL

#### Scenario: The catalogue cannot be reached

- **WHEN** the catalogue request fails
- **THEN** every network SHALL be built from its configured `gtfsUrl`

#### Scenario: A dataset with several feeds

- **WHEN** a dataset lists several GTFS resources and the configured URL is one
  of them
- **THEN** the build SHALL keep the configured URL
