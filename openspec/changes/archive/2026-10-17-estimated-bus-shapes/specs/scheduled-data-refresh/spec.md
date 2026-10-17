## ADDED Requirements

### Requirement: The workflow provides what shape estimation needs

The Data workflow SHALL install osmium-tool and SHALL build pfaedle from a
pinned commit. It SHALL cache the binary by that commit, so pfaedle is compiled
only when the pin changes. It SHALL cache the filtered OpenStreetMap extracts
across runs under one key per month, and SHALL NOT cache the per-network crops
made from them.

A failure to build pfaedle or to fetch OSM data SHALL NOT fail the run. The
transit build then draws what the feeds give, as it does without pfaedle.

#### Scenario: A weekly run with a warm cache

- **WHEN** the weekly run starts with pfaedle and the extracts already cached
- **THEN** it SHALL NOT compile pfaedle, and SHALL download only extracts older
  than 28 days or not yet cached

#### Scenario: The pinned pfaedle changes

- **WHEN** the workflow's pfaedle commit is changed
- **THEN** the next run SHALL build that commit and cache it under a new key

### Requirement: A dry run publishes nothing

A run started by hand with `dry_run` SHALL build every dataset it would
otherwise build, and SHALL NOT upload to the `data-latest` release, open or
comment on the alert issue, or deploy the site.

#### Scenario: Timing a branch

- **WHEN** the workflow is run by hand on a pull request's branch with
  `dry_run`
- **THEN** the job summary SHALL show the build, and the published data and
  site SHALL be unchanged
