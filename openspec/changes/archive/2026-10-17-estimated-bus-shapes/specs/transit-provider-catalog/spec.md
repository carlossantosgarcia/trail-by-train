## MODIFIED Requirements

### Requirement: Only networks that can be drawn

The build SHALL draw a route from the shapes its trips reference in
`shapes.txt`, when they follow the road. A route with no usable shape in the
current feed SHALL take the geometry recorded for the same line in its ledger,
when both of these hold:

- at least 90% of the stops the line serves in the current feed lie within
  200 m of that geometry;
- that geometry was published by the network rather than estimated.

This includes a feed that no longer ships `shapes.txt`, which SHALL be
extracted when present rather than required. Such a route SHALL carry
`shape_seen_on`: the date that shape was last published. Its popup SHALL say
"Tracé relevé le <date> : le réseau ne publie plus le tracé de ses lignes."

Otherwise, a route whose trips have no road-following shape SHALL be drawn
with geometry estimated from its stops over OpenStreetMap (see
`transit-shape-estimation`), and SHALL carry `shape_estimated`. A route with
neither a usable shape, a matching ledger geometry nor an estimate SHALL be
omitted, and stops left with no drawn route SHALL be dropped.

A feed without shapes MAY be registered when its lines can be estimated. A
registered network whose feed stops yielding any drawable route SHALL fail its
build and keep its last good artifacts.

#### Scenario: A candidate feed without shapes

- **WHEN** a feed ships no `shapes.txt`, or no trip in it references a shape
- **THEN** it MAY be registered, and its lines SHALL be drawn as estimates

#### Scenario: A registered feed loses its shapes

- **WHEN** a network's new feed ships no `shapes.txt`, its lines are in the
  ledger, and the stops they serve lie on their recorded shapes
- **THEN** its build SHALL succeed, drawing those lines with their recorded
  geometry and `shape_seen_on`, and the timetable data SHALL come from the new
  feed

#### Scenario: A line that now runs elsewhere

- **WHEN** a line in a feed without shapes serves stops more than 200 m from
  its recorded shape, beyond one stop in ten
- **THEN** that line SHALL NOT be drawn with the recorded shape, and SHALL be
  estimated instead

#### Scenario: A new line in a feed without shapes

- **WHEN** a feed without shapes carries a line the ledger has never seen
- **THEN** that line SHALL be drawn as an estimate

#### Scenario: An estimate is not a recorded shape

- **WHEN** a line drawn as an estimate last week has no shape in this week's
  feed
- **THEN** it SHALL be estimated again, not drawn with `shape_seen_on`

#### Scenario: A registered feed yields nothing drawable

- **WHEN** a network's new feed yields no drawable route, even with the ledger's
  geometry and estimates
- **THEN** its build SHALL fail without overwriting `lines.pmtiles` or
  `stops.geojson`, and the other networks SHALL still be built
