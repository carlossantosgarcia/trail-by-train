# transit-provider-catalog Specification

## Purpose
The catalog of bus, coach and shuttle networks on the map: where a network is
declared, what each entry must say, which feed represents a region, how
networks are grouped and coloured, and what happens when one is retired. The
list of networks itself lives in `scripts/transit/providers.config.mjs`, not
here.
## Requirements
### Requirement: Each network is declared once

Every transit network SHALL be one entry in `scripts/transit/providers.config.mjs`.
The build pipeline SHALL read that entry to produce `public/transit/<id>/`, and
the app SHALL derive its provider list from the same entries
(`src/transit/providers.ts`), so a label, colour or attribution can never differ
between the two. The order of the entries SHALL be the map's layer order.

Each entry SHALL declare: `id`, `label`, `region`, `gtfsUrl` (one URL, or several
when a network is published as several archives), `sourceUrl` (the dataset page),
`license`, `attribution`, `lineColor`, `timetable`, `requiredFiles`,
`lowFreqThreshold`, `reservationPredicate` and `displayDefaultOn`.

Asset URLs SHALL NOT be declared: the app derives them from the id as
`transit/<id>/lines.pmtiles`, `transit/<id>/stops.geojson` and
`transit/<id>/meta.json` under the site's base path.

#### Scenario: Adding a network

- **WHEN** a contributor appends an entry and runs `npm run build:transit -- <id>`
- **THEN** the network SHALL appear in the provider picker, draw from its built
  artifacts, and credit its publisher, with no other file edited

### Requirement: Networks are off until chosen

Every network SHALL be `displayDefaultOn: false`, so a first visit is not
covered in sixty-odd overlapping networks. A network the user turns on SHALL
stay on across reloads.

#### Scenario: First visit

- **WHEN** a user opens the app with no saved selection
- **THEN** no bus network SHALL be drawn until the user picks one

### Requirement: Open data, credited where it is shown

A network SHALL be registered only from a feed published under an open licence.
Its `attribution` SHALL credit the publisher and name the licence, linking to the
dataset page, and SHALL appear in the map's attribution control while the
network is visible. `DATA_LICENSES.md` SHALL summarise the networks' licences
and point to the config for each one.

Where a feed states no licence, the entry SHALL record the licence that is
assumed and why — in its `license` value (for example "Licence Ouverte 2.0
(présumée, LOM)") or in a comment beside it.

#### Scenario: A network is turned on

- **WHEN** the user turns on a network
- **THEN** the attribution control SHALL include that network's attribution

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

### Requirement: Timetable links

Each entry's `timetable` SHALL be one of:

- `{ search }` — the line's link is a web search for the given keywords, the
  line's short and long names, and "horaires";
- `{ resoM, indexUrl }` — the line's link is its page on reso-m.fr, addressed as
  `<resoM>:<short name>` (URL-encoded), or `indexUrl` when the line has no short
  name.

A `line-urls.json` file in a network's output folder, mapping short names to
URLs, SHALL take precedence for the lines it lists.

#### Scenario: A reso-m.fr line

- **WHEN** the user follows the timetable link of line `N98` of a network
  declared with `resoM: 'GSV'`
- **THEN** it SHALL open `https://www.reso-m.fr/8-horaires.htm?code=GSV%3AN98`

#### Scenario: A searched line

- **WHEN** the user follows the timetable link of a line on a network declared
  with `{ search: 'cars région isère' }`
- **THEN** it SHALL open a web search for those keywords, the line's names and
  "horaires"

### Requirement: One feed per region, chosen by a stated precedence

Every provider SHALL be selected by a stated precedence rather than by
convenience, so that the next region added follows the same rule and a publisher
reshuffling its datasets has a defined answer. In order:

1. The official **region-wide interurban** feed published by the regional
   authority.
2. Failing that, the authority's **departmental interurban** feeds.
3. An **aggregate** feed that bundles urban networks with interurban ones SHALL
   NOT be used, even when it is the largest or most convenient dataset: it is out
   of the interurban scope, and it collapses many operators under one attribution
   so that the weekly refresh report cannot name which sub-network broke.
4. An **experimental** feed SHALL NOT be used when a stable feed covers the same
   territory.

Urban networks and resort or valley shuttles are added on their own merits, as
separate networks, where they reach trailheads.

#### Scenario: A region offers a region-wide feed and departmental feeds

- **WHEN** Grand Est publishes both a region-wide Fluo feed and ten departmental
  Fluo feeds
- **THEN** the region-wide feed SHALL be registered, and the departmental feeds
  SHALL NOT

#### Scenario: A region offers an aggregate covering more networks

- **WHEN** Bretagne publishes `breizhgo-car` alongside `Korrigo`, an aggregate of
  every Breton urban and interurban network
- **THEN** `breizhgo-car` SHALL be registered despite covering fewer lines, and
  `Korrigo` SHALL NOT

### Requirement: Providers declare their region

Every entry SHALL carry a `region` naming the French administrative region it
serves, which is what the picker groups by; labels do not reliably contain the
region. A network spanning several regions SHALL declare the region of the
authority that publishes it, not a list.

#### Scenario: Every provider is groupable

- **WHEN** the provider catalog is read
- **THEN** every entry SHALL have a non-empty `region`

### Requirement: Line colours

Two networks SHALL share a `lineColor` only when their regions are **not
adjacent**, and two networks in the same region SHALL always differ, so that two
same-coloured networks are never plausibly on screen together. Reuse is
permitted at all because sixty-odd mutually distinguishable line colours,
legible over both topographic and satellite basemaps in both themes, are not
achievable.

Resort and valley shuttles SHALL take lighter colours (Tailwind's 200–300 tiers)
than the interurban networks they connect to, so the dense local lines read as
secondary.

A network SHALL keep its `lineColor` when others are added, so that adding
coverage never repaints a map a user already knows.

This is a review obligation, not a machine-checked one: the contrast gate covers
`src/tokens.css` and does not inspect provider colours.

#### Scenario: A new provider reuses a distant hue

- **WHEN** a Breton provider is assigned the same hex as an Alpine provider
- **THEN** this SHALL be permitted, because Bretagne and Auvergne-Rhône-Alpes are
  not adjacent

#### Scenario: A new provider collides with a neighbour

- **WHEN** a new Normandie provider is assigned the same hex as an existing
  Hauts-de-France or Centre-Val de Loire provider
- **THEN** the assignment SHALL be rejected and a different hue chosen

### Requirement: Retiring a provider does not break a returning user

Saved state referencing a provider id that is no longer in the catalog SHALL be
discarded on load rather than treated as an error, and the app SHALL render
normally with the remaining networks. This applies whenever a network leaves the
catalog — because a region-wide feed replaces departmental ones, or because its
feed died permanently.

A replacing network SHALL start a fresh line ledger rather than inheriting the
retired one's, because `route_id`s from a different publisher export do not
correspond and merging them would present one operator's ids as another's
history.

#### Scenario: A user returns with toggles for retired providers

- **WHEN** a user who had `fluo-vosges` and `fluo-bas-rhin` enabled, with a
  custom colour on one of them, loads the app after those ids left the catalog
- **THEN** the stale entries SHALL be discarded silently, the app SHALL load, and
  no error SHALL surface

#### Scenario: A replacing provider's ledger is not merged forward

- **WHEN** `fluo-grand-est` is built for the first time
- **THEN** it SHALL begin an empty ledger, and SHALL NOT import entries from the
  departmental ids it replaces

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

