# scheduled-data-refresh Specification

## Purpose
Keep the generated datasets (transit timetables, rail network, GR trails,
place index) current without committing them to git: a scheduled GitHub
Actions workflow rebuilds them from their open sources, publishes them as
assets of a rolling `data-latest` release, and redeploys the site. The same
release lets contributors run the app locally without rebuilding anything.
## Requirements
### Requirement: Datasets are rebuilt on a schedule, never committed

The `Data` workflow SHALL rebuild transit, the place index and the Explore index
(`transit/explore-index.json`, from every network's stops and the rail stations)
every week,
and additionally the rail network, stations and GR trails once a month or
on manual dispatch with `datasets: all`. Generated datasets SHALL NOT be
committed to the repository; they SHALL be published as `base.tar.gz` and
`transit.tar.gz` on the `data-latest` release.

#### Scenario: The weekly run
- **WHEN** the weekly schedule fires
- **THEN** the workflow MUST rebuild every transit provider and the place
  index, upload both archives to `data-latest` replacing the previous
  ones, and redeploy the site

#### Scenario: The first run on a fresh fork
- **WHEN** the workflow runs and no `data-latest` release exists
- **THEN** it MUST build every dataset, create the release, publish to it,
  and deploy the site

#### Scenario: Runs never overlap
- **WHEN** the schedule fires while a previous data run is still going
- **THEN** the second run MUST wait rather than run concurrently

### Requirement: An unchanged feed is not rebuilt

Each provider's `meta.json` SHALL record a content hash of the feed it was built
from and the `build_version` of the transit build that produced it. The
`build_version` SHALL change whenever the build's output rules change. When a
refresh downloads a feed whose hash matches and the recorded `build_version` is
the current one, the provider SHALL be reported as skipped and its line and stop
artifacts left untouched; otherwise it SHALL be rebuilt.

#### Scenario: A feed that has not been republished
- **WHEN** a provider's downloaded feed is byte-identical to the one used
  for its last build, by the current build version
- **THEN** no rebuild MUST occur and its artifacts MUST keep their bytes

#### Scenario: A provider with no recorded hash
- **WHEN** a provider has never recorded a feed hash
- **THEN** it MUST be rebuilt, so the skip path can never suppress a first
  build

#### Scenario: The build's rules changed
- **WHEN** a provider's feed is unchanged but its `meta.json` records an older
  `build_version`, or none
- **THEN** it MUST be rebuilt, so a rule change reaches every provider

### Requirement: A failing provider never degrades the app

The workflow SHALL restore the previous release's datasets before
building, so a provider whose refresh fails keeps the artifacts it had.
The run SHALL continue to the remaining providers and SHALL still publish
and deploy.

#### Scenario: Some providers fail
- **WHEN** 3 of 63 providers fail to refresh
- **THEN** the other 60 MUST still be rebuilt and published, and the 3
  MUST still serve their previous data on the map

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

All three groups SHALL appear in the job summary. Only broken providers SHALL
be filed: when there are any, the run SHALL open — or, when one is already
open, comment on — a single GitHub issue labelled `data-alert` listing them.
Warnings and out-of-season providers SHALL NOT open, comment on or keep open
that issue. When nothing is broken and such an issue is open, the run SHALL
comment that no feed is failing and close it. Users see the same ageing
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

#### Scenario: A feed shrinks

- **WHEN** a provider rebuilds with a warning that its feed shrank
- **THEN** the warning MUST be listed under "To check with the operator" in the
  job summary, and no `data-alert` issue MUST be opened or commented on for it

#### Scenario: Nothing is failing any more

- **WHEN** a run finds nothing broken while a `data-alert` issue is open
- **THEN** it MUST comment that no feed is failing and close the issue

### Requirement: No deploy without the datasets

A deploy SHALL fail, rather than publish the interface without its map layers,
when the `data-latest` release cannot be downloaded or when any essential
dataset is missing or empty: the rail network and stations, the GR trails, the
place index, the Explore index, and each provider's lines, stops and metadata
(`npm run check:data`). The `Data` workflow SHALL run the same check before it
publishes a release.

#### Scenario: The release is missing
- **WHEN** the deploy runs and `data-latest` does not exist
- **THEN** the deploy MUST fail and the site MUST keep its previous version

#### Scenario: A dataset is missing
- **WHEN** a downloaded release lacks the Explore index
- **THEN** the deploy MUST fail, naming the missing file

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

### Requirement: Contributors can fetch the published data

`npm run data:download` SHALL download and extract the `data-latest`
archives into `public/`, from this repository by default or from a fork
named in `DATA_REPO`.

#### Scenario: A fresh clone
- **WHEN** a contributor runs `npm ci`, `npm run data:download` and
  `npm run dev`
- **THEN** the app MUST run locally with every dataset present

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

