## ADDED Requirements

### Requirement: The workflow provides what shape estimation needs

The Data workflow SHALL install osmium-tool and SHALL build pfaedle from a
pinned commit. It SHALL cache the binary by that commit, so pfaedle is compiled
only when the pin changes. It SHALL cache the filtered OpenStreetMap extracts
across runs, and SHALL NOT cache the per-network crops made from them.

A failure to build pfaedle or to fetch OSM data SHALL NOT fail the run. The
transit build then draws what the feeds give, as it does without pfaedle.

#### Scenario: A weekly run with a warm cache

- **WHEN** the weekly run starts with pfaedle and the extracts already cached
- **THEN** it SHALL NOT compile pfaedle, and SHALL download only extracts older
  than 28 days or not yet cached

#### Scenario: The pinned pfaedle changes

- **WHEN** the workflow's pfaedle commit is changed
- **THEN** the next run SHALL build that commit and cache it under a new key
