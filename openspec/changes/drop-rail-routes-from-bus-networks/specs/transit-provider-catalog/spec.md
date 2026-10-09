## MODIFIED Requirements

### Requirement: Whole feeds, whatever files they ship

A network SHALL be built from its whole feed, with no per-line inclusion or
exclusion, except that routes whose GTFS `route_type` is rail — `2`, or the
extended rail types `100` to `117` — SHALL be left out, with the trips that run
them and any stops and shapes only they use. Trains are drawn by the rail overlay,
not as bus lines. Every other route type SHALL be kept, including road coaches
that share a train's number, trams, metro, funiculars and cable cars. Excluded
routes SHALL NOT be archived in the network's line ledger, and the number left out
SHALL be reported per network in the build log and job summary.

`requiredFiles` SHALL list exactly the files that feed ships, and the build SHALL
accept feeds that:

- carry service days only as exceptions in `calendar_dates.txt`, with no
  `calendar.txt`;
- omit `feed_info.txt`, or ship one without dates — the published validity in
  `meta.json` is then null.

A required file missing from a download SHALL fail that network's build with a
message naming the file.

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

#### Scenario: A funicular network

- **WHEN** a network's routes are `route_type` 7
- **THEN** they SHALL be kept
