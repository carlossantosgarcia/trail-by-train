# transit-shape-quality Specification

## Purpose
Rejecting broken line geometry from GTFS feeds, so a scrambled shape never reaches the map, and cleaning up what it leaves behind.
## Requirements
### Requirement: Shapes not in path order are rejected

The build SHALL assess every GTFS shape before use and SHALL reject any whose
points are not in path order, rather than tile a geometry that draws as a
scribble. The measure SHALL be the ratio of the shape's path length to its
bounding-box diagonal, which is independent of how finely the shape is sampled;
a shape SHALL be rejected when that ratio exceeds 25. Shapes with fewer than 10
points, or spanning less than 50 m, SHALL be exempt as too small to judge.

The threshold is derived from measurement over all 17,676 shapes in every
registered provider feed: median 1.54, p99 4.08, p99.9 6.87, highest legitimate
12.7, against 100.9 for the one corrupt shape observed.

A rejected shape SHALL be logged with its length, extent and ratio. The build
SHALL NOT attempt to reconstruct the correct order: a reordered path is a guess,
and a believable but wrong route is worse for trip planning than an absent one.

#### Scenario: A scrambled shape is dropped

- **WHEN** a feed publishes a shape whose points zig-zag far beyond its extent —
  as `navettes-vai-serre-poncon` shape 225 does, at 1199 km across a 12 km
  extent
- **THEN** the build SHALL drop that shape, SHALL log the reason with its
  numbers, and SHALL NOT include it in `lines.pmtiles`

#### Scenario: A coarsely sampled shape is kept

- **WHEN** a shape is legitimate but sampled with few, widely spaced vertices
- **THEN** it SHALL be kept, because the ratio measures doubling back rather
  than vertex spacing

#### Scenario: A route left with no usable shape is not drawn

- **WHEN** every shape of a route is rejected
- **THEN** that route SHALL be omitted from the build exactly as a route that
  ships no shape at all, and SHALL reappear automatically once the operator
  republishes usable geometry

### Requirement: Stored geometry is re-validated on load

The line ledger SHALL apply the same checks to the geometry it has stored as the
build applies to a freshly read shape, and SHALL apply the same remedy to each:
geometry that is not in path order SHALL be dropped, and geometry containing a
point outside the served area SHALL be split at that point. The ledger retains a
line's last captured geometry indefinitely, so a shape that was corrupt when
captured would otherwise be preserved permanently and merely redrawn as an
archived line.

#### Scenario: A corrupt ledger entry does not survive as an archived line

- **WHEN** a ledger holds a line whose stored geometry is not in path order, and
  the current feed no longer publishes that line
- **THEN** the entry SHALL be dropped from the ledger rather than emitted with
  `archived: true`

#### Scenario: Stored geometry with an out-of-area point is split, not dropped

- **WHEN** a ledger holds a line whose stored geometry contains a point outside
  the served area
- **THEN** that geometry SHALL be split at the point and retained, matching how
  the build treats the same corruption, rather than dropped in full

### Requirement: Stops left with no line are dropped

A stop absent from the current build SHALL be retained only when at least one
line still present on the map — live or archived — calls there. Otherwise it
SHALL be dropped.

#### Scenario: Rejecting a shape does not strand its stops

- **WHEN** a route is dropped because its only shape was rejected, and 11 stops
  were served by that route alone
- **THEN** those stops SHALL be dropped too, rather than kept as archived stops
  referencing a route that is no longer on the map

### Requirement: Shape points outside the served area are invalid

The build SHALL treat a shape point that falls outside the area any registered
provider serves as missing data rather than as a location. The served area SHALL
be metropolitan France and Corsica — longitude `[-5.5, 10.0]`, latitude
`[41.0, 51.5]` — the same bounding box the GR pipeline already uses, so the
repository carries one definition of the covered area.

This check is absolute, and is independent of the path-order ratio. It exists
because that ratio cannot express this corruption: a single outlier at distance
*d* makes the path length approximately `2d` and the bounding-box diagonal
approximately `d`, so the ratio converges on 2 however distant the outlier is,
and passes any usable threshold.

A shape containing an invalid point SHALL be **split** at that point, into the
run of valid points before it and the run after. The build SHALL NOT reject the
whole shape, which would discard valid geometry, and SHALL NOT join the invalid
point's neighbours, which would invent a segment the feed never published.

Consecutive invalid points SHALL produce a single split rather than one per
point, and invalid points at a shape's start or end SHALL trim rather than
split. A resulting fragment with fewer than 2 points SHALL be discarded. Each
surviving fragment SHALL then be assessed by the path-order requirement, so a
split cannot admit a fragment that check would otherwise reject.

A split SHALL be logged distinctly from a rejection, with the shape id, the
offending coordinate, and the number of fragments produced.

#### Scenario: A null-island point splits its shape

- **WHEN** a feed publishes a shape carrying a `[0, 0]` point mid-path — as
  `cars-region-drome` shapes `AUTO_2445839`, `AUTO_2445841`, `AUTO_2445842`,
  `AUTO_2445844` and `AUTO_2445881` do
- **THEN** the build SHALL split each shape at that point, SHALL keep every
  valid vertex either side, SHALL NOT emit a segment joining the neighbours, and
  SHALL log the split with the offending coordinate

#### Scenario: A route is drawn either side of the hole

- **WHEN** a split shape contributes to a route's dissolved geometry
- **THEN** the route SHALL render as separate parts with a gap where the feed's
  data was missing, rather than as a line crossing the invalid point or as a
  straight bridge over the gap

#### Scenario: A shape wholly inside the served area is untouched

- **WHEN** every point of a shape falls within the served-area bounds
- **THEN** the shape SHALL pass this check unchanged, and SHALL be assessed only
  by the path-order requirement

#### Scenario: A stub fragment is discarded

- **WHEN** splitting leaves a fragment of fewer than 2 points, because the
  invalid point sat adjacent to the shape's start or end
- **THEN** that fragment SHALL be discarded rather than emitted as a degenerate
  geometry

#### Scenario: A split fragment is still checked for path order

- **WHEN** splitting yields a fragment whose points are not in path order
- **THEN** that fragment SHALL be rejected by the path-order requirement exactly
  as an unsplit shape would be

