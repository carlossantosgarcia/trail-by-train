# brianconnais-bus-provider Specification

## Purpose
Register the CC du Briançonnais "Altigo" network as a `public-transit` provider, giving the map bus coverage of the Briançonnais — the gateway to the Écrins and the Queyras — via the whole Altigo GTFS feed.
## Requirements
### Requirement: Briançonnais "Altigo" provider registration

The system SHALL register an `altigo-brianconnais` provider conforming to the `public-transit` `ProviderConfig` interface, with label "Altigo (Briançonnais)", line color red (`#ef4444`, distinct from every Alpine provider already on the map, none of which use red), `displayDefaultOn: false`, and an attribution crediting "CC du Briançonnais — Réseau Altigo" under Licence Ouverte 2.0, linking to its transport.data.gouv.fr dataset page. The build-time entry in `scripts/transit/providers.config.mjs` SHALL source the whole Altigo GTFS feed (the CC du Briançonnais static data.gouv.fr resource) and SHALL select `detectReservationDefault` as its reservation predicate.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles "Altigo (Briançonnais)" on
- **THEN** the lines and stops from `public/transit/altigo-brianconnais/{lines.pmtiles, stops.geojson}` SHALL appear on the map in red, and the MapLibre attribution control SHALL include the provider's attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for `altigo-brianconnais`
- **THEN** the Altigo overlay SHALL NOT render until the user enables its pill

#### Scenario: Écrins/Queyras gateway covered
- **WHEN** the user enables the provider and pans to Briançon
- **THEN** the urban and interurban lines serving the Briançonnais — the gateway to the Écrins and Queyras — SHALL be visible

#### Scenario: Missing feed_info tolerated
- **WHEN** the Altigo feed omits `feed_info.txt`
- **THEN** the build SHALL still succeed with `feed_info.txt` absent from `requiredFiles`, and `feed_valid_from`/`feed_valid_to` in `meta.json` SHALL default to null

