## MODIFIED Requirements

### Requirement: Lines survive disappearing from their feed

Each build SHALL record every line it saw, geometry included, to
`public/transit/<id>/lines-ledger.geojson.gz`, and SHALL emit the union of the
current feed's lines with everything the ledger remembers. A line the current
feed no longer publishes SHALL be emitted with `archived: true` and SHALL retain
the geometry, service data and `last_seen_on` date captured when it was last
present.

#### Scenario: A line withdrawn from the feed stays on the map

- **WHEN** a provider is rebuilt from a feed that no longer contains a line the
  ledger remembers
- **THEN** that line SHALL still appear in `lines.pmtiles`, flagged
  `archived: true`, with the geometry captured while it was still published

#### Scenario: An archived line's last-seen date is not bumped by later builds

- **WHEN** a provider is rebuilt while one of its lines remains absent
- **THEN** that line's `last_seen_on` SHALL keep the date of the last build
  whose feed still carried it, so its apparent age keeps growing

#### Scenario: A line returning to the feed becomes current again

- **WHEN** a feed publishes a line the ledger had marked archived
- **THEN** the line SHALL be emitted with `archived: false`, refreshed geometry,
  and `last_seen_on` set to the current build date

#### Scenario: Archived lines keep their stops

- **WHEN** a line is archived
- **THEN** the stops it served SHALL remain in `stops.geojson` — flagged
  `archived: true` when no live line calls there — and stops still served by
  live lines SHALL list the archived line among their `serving_lines`

#### Scenario: Feeds that renumber their routes do not duplicate the ledger

- **WHEN** a feed reissues an existing line under a new `route_id`
- **THEN** it SHALL be matched to the ledger entry by `(route_short_name,
route_long_name)` and treated as the same line, rather than added as a new one
  while the old id is archived forever
- **AND WHEN** archived entries nevertheless exceed three times the live count —
  for lines above 30 archived, for stops above 200 — while fewer than half the
  live entries match an entry already in the ledger, the build SHALL fail and
  keep the previous artifacts rather than write a ledger that doubles on every
  build; `--reset-ledger` starts it afresh once the cause is understood

#### Scenario: A feed that drops lines but keeps its ids

- **WHEN** a feed that published 21 lines now publishes 2, with the same stop
  and route ids as before
- **THEN** the build SHALL succeed, the 19 others SHALL be archived lines on the
  map, and the outcome SHALL carry a warning that the feed shrank from 21 to 2
  lines
