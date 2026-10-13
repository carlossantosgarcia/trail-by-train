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
current feed. A line whose geometry was estimated from its stops (see
`transit-shape-estimation`) SHALL carry `shape_estimated`: `all` when every
variant is estimated, `part` when some of the feed's shapes remain. It SHALL
NOT carry a `shape_id`.

`meta.json` SHALL carry `estimated_line_count`, the number of lines drawn with
an estimated geometry.

Each stop Feature SHALL carry: `stop_id`, `stop_name`,
`serving_lines: [{ route_id, short_name, color, reservation, service_days, archived? }]`,
`service_days` and `archived`. A serving line's `reservation` and
`service_days` SHALL mirror its route's, so the stop popup can warn about
booking and filter by day without looking the route up.

#### Scenario: A line's days

- **WHEN** a network is built and one of its routes runs Monday to Friday
- **THEN** that line's Feature SHALL carry `service_days: "1111100"`

#### Scenario: An estimated line

- **WHEN** a route's only shapes are stop-to-stop and every one of them is
  replaced by an estimate
- **THEN** its Feature SHALL carry `shape_estimated: "all"`

### Requirement: Line popup

Clicking a line SHALL open a popup anchored at the nearest point of the line's
geometry (every segment of every linestring considered), not at the raw click
point, containing:

- the line's short-name chip and long name, and the network's label;
- when the line has a `service_kind`, a pill saying so before the others: "Train",
  or "Car de remplacement TER";
- a reservation pill for every line, with the booking detail when booking is
  required;
- a "Dernière mise à jour" pill coloured by the age of the data, and the feed's
  published end date where it declares one;
- a warning when the line is `archived`;
- when the line has `shape_estimated`, one line reading "Tracé estimé d'après
  les arrêts et OpenStreetMap, faute de tracé détaillé publié par le réseau.",
  beginning "Tracé en partie estimé" when it is `part`;
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

#### Scenario: A TER replacement coach

- **WHEN** the user opens Zou's P25 coach (Grenoble – Clelles – Veynes), which the
  feed also publishes as a train
- **THEN** the popup SHALL show a "Car de remplacement TER" pill

#### Scenario: A kept train

- **WHEN** the user opens Zou's line 49 (Nice – Digne-les-Bains)
- **THEN** the popup SHALL show a "Train" pill

#### Scenario: A plain bus

- **WHEN** the user opens a coach line with no train on its route
- **THEN** the popup SHALL show no service-kind pill

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

#### Scenario: An estimated line

- **WHEN** the user opens a Cars Haute-Corse line whose geometry was estimated
- **THEN** the popup SHALL say "Tracé estimé d'après les arrêts et
  OpenStreetMap, faute de tracé détaillé publié par le réseau."

#### Scenario: A line with its published shape

- **WHEN** the user opens a line drawn from its feed's shapes
- **THEN** the popup SHALL say nothing about how its route was drawn
