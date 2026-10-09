# scheduled-data-refresh Specification

## Purpose
Keep the generated datasets (transit timetables, rail network, GR trails,
place index) current without committing them to git: a scheduled GitHub
Actions workflow rebuilds them from their open sources, publishes them as
assets of a rolling `data-latest` release, and redeploys the site. The same
release lets contributors run the app locally without rebuilding anything.

## Requirements
### Requirement: Datasets are rebuilt on a schedule, never committed

The `Data` workflow SHALL rebuild transit and the place index every week,
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
- **THEN** it MUST build every dataset, create the release, and publish
  to it

#### Scenario: Runs never overlap
- **WHEN** the schedule fires while a previous data run is still going
- **THEN** the second run MUST wait rather than run concurrently

### Requirement: An unchanged feed is not rebuilt

Each provider's `meta.json` SHALL record a content hash of the feed it was
built from. When a refresh downloads a feed whose hash matches, the
provider SHALL be reported as skipped and its line and stop artifacts left
untouched.

#### Scenario: A feed that has not been republished
- **WHEN** a provider's downloaded feed is byte-identical to the one used
  for its last build
- **THEN** no rebuild MUST occur and its artifacts MUST keep their bytes

#### Scenario: A provider with no recorded hash
- **WHEN** a provider has never recorded a feed hash
- **THEN** it MUST be rebuilt, so the skip path can never suppress a first
  build

### Requirement: A failing provider never degrades the app

The workflow SHALL restore the previous release's datasets before
building, so a provider whose refresh fails keeps the artifacts it had.
The run SHALL continue to the remaining providers and SHALL still publish
and deploy.

#### Scenario: Some providers fail
- **WHEN** 3 of 63 providers fail to refresh
- **THEN** the other 60 MUST still be rebuilt and published, and the 3
  MUST still serve their previous data on the map

### Requirement: Every run reports what it did

The transit build SHALL write a per-provider outcome table (rebuilt,
skipped, failed with its error) to the GitHub Actions job summary, and a
run with failed providers SHALL be flagged with a warning annotation.

#### Scenario: A provider fails
- **WHEN** a provider fails during a scheduled run
- **THEN** the run's summary page MUST list it with its error message,
  without anyone having to read the log

### Requirement: Contributors can fetch the published data

`npm run data:download` SHALL download and extract the `data-latest`
archives into `public/`, from this repository by default or from a fork
named in `DATA_REPO`.

#### Scenario: A fresh clone
- **WHEN** a contributor runs `npm ci`, `npm run data:download` and
  `npm run dev`
- **THEN** the app MUST run locally with every dataset present
