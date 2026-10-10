## MODIFIED Requirements

### Requirement: Feeds that keep failing are raised with the maintainers

Every full transit build SHALL record, per provider, its last attempt, last
success, consecutive failures, last error, when it went out of season, and its
latest warning with that warning's date in `transit/refresh-status.json`,
published with the transit data so the next run continues the record.

The run SHALL report providers in three groups:

- **Broken**: failed three runs in a row; failed with no success for more than
  21 days; or out of season for more than 395 days.
- **To check with the operator**: a warning recorded in the last 21 days, such
  as a feed that shrank.
- **Out of season**: every other out-of-season provider.

All three groups SHALL appear in the job summary. When there is anything
broken or to check, the run SHALL open — or, when one is already open, comment
on — a single GitHub issue labelled `data-alert` with those two groups. When
there is nothing broken or to check and such an issue is open, the run SHALL
comment that every feed is healthy and close it. Users see the same ageing
through each line's "Dernière mise à jour" pill, which takes its age from the
last successful check.

#### Scenario: A feed fails three weeks running

- **WHEN** a provider fails its third consecutive weekly refresh
- **THEN** the run MUST open a `data-alert` issue naming it, its last success
  and its last error, while the map keeps serving its last good data

#### Scenario: One bad week

- **WHEN** a provider fails once after succeeding the week before
- **THEN** no issue MUST be opened

#### Scenario: The feed recovers

- **WHEN** a failing provider refreshes successfully
- **THEN** its consecutive-failure count MUST return to zero

#### Scenario: A seasonal network between seasons

- **WHEN** a ski shuttle's feed has been out of season for five months
- **THEN** it MUST be listed under "Out of season" in the job summary and MUST
  NOT open or keep open a `data-alert` issue

#### Scenario: A network out of season for over a year

- **WHEN** a provider has been out of season for more than 395 days
- **THEN** it MUST be listed as broken

#### Scenario: Everything is healthy again

- **WHEN** a run finds nothing broken and nothing to check while a
  `data-alert` issue is open
- **THEN** it MUST comment that every feed is healthy and close the issue

### Requirement: Every run reports what it did

The transit build SHALL write a per-provider outcome table (rebuilt, skipped,
out of season, failed with its error, and any warning) to the GitHub Actions
job summary, and a run with failed providers SHALL be flagged with a warning
annotation.

#### Scenario: A provider fails

- **WHEN** a provider fails during a scheduled run
- **THEN** the run's summary page MUST list it with its error message,
  without anyone having to read the log

#### Scenario: A provider shrinks

- **WHEN** a provider rebuilds with fewer than half the lines it had
- **THEN** its row MUST carry the warning, naming the line counts before and
  after

## ADDED Requirements

### Requirement: An out-of-season feed is not a failure

A feed that publishes no trips once rail routes are left out SHALL be treated
as out of season, not as broken. The build SHALL keep the provider's previous
artifacts, SHALL record in its `meta.json` the date it was first seen out of
season (`dormant_since`), SHALL NOT bump `last_checked_on`, and SHALL report
the outcome as out of season without counting a failure. The first rebuild
from a feed with trips SHALL clear `dormant_since`. While it is set, the line
popup SHALL show a "Hors saison" pill and the date since which the network has
published no timetable.

A feed whose trips have all run in the past SHALL NOT be treated as out of
season: it is built as usual and ages through the existing freshness rules.

#### Scenario: A ski shuttle in autumn

- **WHEN** a network's feed ships every file with headers and no rows
- **THEN** the build MUST keep its lines and stops from the last season, record
  `dormant_since`, and report it out of season with no failure

#### Scenario: The winter timetable is published

- **WHEN** the same network's feed carries trips again
- **THEN** it MUST be rebuilt, and `dormant_since` and the "Hors saison" pill
  MUST disappear

#### Scenario: The popup of an out-of-season network

- **WHEN** the user opens a line of a network whose `meta.json` carries
  `dormant_since`
- **THEN** the popup MUST show a "Hors saison" pill and say the network has
  published no timetable since that date
