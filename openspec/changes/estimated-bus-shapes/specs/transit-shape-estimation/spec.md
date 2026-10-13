## ADDED Requirements

### Requirement: Trips without road-following geometry are estimated

When pfaedle is available, the build SHALL estimate a geometry for every trip
whose feed gives it no road-following shape. That is a trip with no
`shape_id`, a trip whose shape was rejected by `transit-shape-quality`, or a
trip whose shape is stop-to-stop.

A shape SHALL be stop-to-stop when both of these hold:

- at least 80% of its vertices lie within 25 m of a stop of the feed;
- it has fewer than 3 vertices per km.

A shape of fewer than 3 points SHALL count as stop-to-stop.

Only road vehicles SHALL be estimated: buses (`route_type` 3 and 700–799,
on-demand 715 included), coaches (200–299) and trolleybuses (11, 800). A
funicular, aerial lift, boat or any other route SHALL keep the feed's geometry
or none.

Candidate trips SHALL be grouped by route and ordered list of stops. One trip
per group SHALL be routed over OpenStreetMap with pfaedle, using its real
stops, stop times and route names.

A group SHALL NOT be estimated in either of these cases:

- its route has no shape in the feed and the ledger's recorded shape is used
  (see `transit-provider-catalog`);
- at least 90% of its stops lie within 200 m of the route's road-following
  shapes.

#### Scenario: A feed that ships no shapes

- **WHEN** Altigo's feed carries a line with no shape, and the ledger has no
  recorded shape its stops lie on
- **THEN** that line SHALL be drawn with an estimated geometry

#### Scenario: Stop-to-stop shapes are replaced

- **WHEN** a Cars Haute-Corse shape's vertices are its stops, with fewer than
  3 vertices per km
- **THEN** the trips using it SHALL be estimated, and the shape SHALL be
  replaced by their estimates

#### Scenario: A road-following shape is kept

- **WHEN** a trip's shape follows the road, with vertices between its stops
- **THEN** it SHALL NOT be estimated, however sparse its stops

#### Scenario: A funicular without a shape

- **WHEN** a feed's funicular (`route_type` 7) has no shape
- **THEN** it SHALL NOT be estimated over the roads

#### Scenario: An on-demand bus without a shape

- **WHEN** an on-demand bus (`route_type` 715) has no shape
- **THEN** it SHALL be estimated like any other bus

#### Scenario: A school variant already drawn

- **WHEN** a shapeless trip serves stops that all lie on its line's published
  shapes
- **THEN** it SHALL NOT be estimated

### Requirement: Hops pfaedle got wrong are cut

The estimate SHALL be sliced at each stop using pfaedle's
`shape_dist_traveled`. A hop between two consecutive stops SHALL be left out
of the geometry in either of these cases:

- its slice has no vertex between the two stops and is longer than 300 m
  (pfaedle's straight-line fallback);
- either of its stops is placed more than 100 m from the stop's position.

A cut hop SHALL leave a gap, drawing the route either side as separate parts,
as for a shape split at an invalid point. The build SHALL NOT bridge the gap
with a segment of its own.

When the estimate replaces a stop-to-stop shape, the gap SHALL instead be
filled with the straight segment between the hop's stops, which is the
geometry the feed published. A stop-to-stop shape SHALL be replaced only when
every group of trips using it was estimated. Otherwise it SHALL be kept as
published.

#### Scenario: A road missing from OSM

- **WHEN** pfaedle joins two stops 1.2 km apart with one straight segment
- **THEN** that hop SHALL NOT be drawn, and the line SHALL be drawn either side
  of it

#### Scenario: A stop snapped to the wrong road

- **WHEN** pfaedle places a bus-station stop 150 m from where it is
- **THEN** both hops touching that stop SHALL NOT be drawn

#### Scenario: Replacing an operator's straight lines

- **WHEN** a hop is cut in an estimate replacing a stop-to-stop shape
- **THEN** the published straight segment between its stops SHALL be drawn in
  its place

### Requirement: OpenStreetMap data covers every stop

The OSM data SHALL be the Geofabrik extracts containing any stop, or midpoint
between consecutive stops, of the trips to estimate. They SHALL be chosen
among the regions of metropolitan France and the neighbouring countries or
their sub-regions: Andorra, Belgium, Luxembourg, Monaco, Switzerland, Italy's
north-west, Catalonia, Aragon, Navarre, the Basque Country,
Baden-Württemberg, Rhineland-Palatinate and Saarland.

Each extract SHALL be filtered to roads, public-transport features and route
relations when downloaded, cached, and refreshed once older than 28 days. For
each build, the extracts SHALL be cropped to the bounding box of those points
plus a 0.15° margin, and the crops merged into one file. The time a network
spends reading OSM then depends on the area its estimated lines cover, not on
the size of the regions they touch.

#### Scenario: A line into Geneva

- **WHEN** a Cars Haute-Savoie line has stops in Geneva
- **THEN** the Switzerland extract SHALL be cropped and merged with
  Rhône-Alpes, and the line's Swiss roads SHALL be matched rather than cut

#### Scenario: A few stops across a border

- **WHEN** one Zou line has stops in Monaco and Italy
- **THEN** only the area around that line SHALL be read from the Monaco, Italian
  north-west and Provence-Alpes-Côte d'Azur extracts

### Requirement: Estimation is optional and never fails a build

The build SHALL find pfaedle through `PFAEDLE` (default: `pfaedle` on PATH)
and its configuration through `PFAEDLE_CONFIG`.

Without pfaedle, the build SHALL draw what the feed and ledger give, as
before, and SHALL log how many lines lack a road-following shape. When pfaedle
or the OSM download fails, the build SHALL log the error and carry on without
estimates.

#### Scenario: A contributor without pfaedle

- **WHEN** `npm run build:transit -- cars-haute-corse` runs on a machine
  without pfaedle
- **THEN** the build SHALL succeed and draw the feed's stop-to-stop shapes

### Requirement: Estimated geometry is attributed to OpenStreetMap

`DATA_LICENSES.md` SHALL list OpenStreetMap (ODbL) as a source of transit line
geometry, and SHALL say that estimated lines are derived from it.

#### Scenario: Reading the licences

- **WHEN** a reader looks up where bus line geometry comes from
- **THEN** `DATA_LICENSES.md` SHALL name the network's feed and, for estimated
  lines, OpenStreetMap under ODbL
