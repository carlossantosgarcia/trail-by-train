# synchro-chambery-transit Specification

## Purpose
The Synchro bus network (Grand Chambéry) as a transit provider.
## Requirements
### Requirement: Synchro (Grand Chambéry) provider registration

The system SHALL register a `synchro-chambery` provider conforming to the `public-transit` `ProviderConfig` interface, with: id `synchro-chambery`, label "Synchro (Grand Chambéry)", line color blue-400 (`#60a5fa`, distinct from the nine existing providers' colors), `displayDefaultOn: false`, and an attribution string crediting "CA du Grand Chambéry — Réseau Synchro Bus" under ODbL, linking to the transport.data.gouv.fr dataset page. The provider's build-time entry in `scripts/transit/providers.config.mjs` SHALL source the whole Synchro network GTFS feed (no per-line filtering) and SHALL select `detectReservationDefault` as its reservation predicate, matching the existing urban whole-network providers.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles "Synchro (Grand Chambéry)" on
- **THEN** the lines and stops from `public/transit/synchro-chambery/{lines.pmtiles, stops.geojson}` SHALL appear on the map in blue, and the MapLibre attribution control SHALL include the provider's ODbL attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for `synchro-chambery`
- **THEN** the Synchro overlay SHALL NOT render until the user enables its pill

#### Scenario: Whole network included
- **WHEN** the provider's build runs against the Synchro GTFS feed
- **THEN** every commercial Synchro route present in the feed (including intra-city trunk lines) SHALL be emitted, with no per-line inclusion/exclusion filter applied

