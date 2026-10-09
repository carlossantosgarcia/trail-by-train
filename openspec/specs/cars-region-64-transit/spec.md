# cars-region-64-transit Specification

## Purpose
Register the Cars Régionaux 64 / réseau interurbain des Pyrénées-Atlantiques (Nouvelle-Aquitaine Mobilités) bus network as a `public-transit` provider, giving the map coverage of the western French Pyrenees (Pau, Oloron, vallées d'Aspe and d'Ossau — Béarn / Pays basque mountains).
## Requirements
### Requirement: Cars Régionaux 64 provider registration

The system SHALL register a `cars-region-64` provider conforming to the `public-transit` `ProviderConfig` interface, with: id `cars-region-64`, label "Cars Régionaux 64 (Pyrénées-Atl.)", line color red-400 (`#f87171`, distinct from the ten existing providers' colors), `displayDefaultOn: false`, and an attribution string crediting "Nouvelle-Aquitaine Mobilités — Cars Régionaux 64" under its open license, linking to the transport.data.gouv.fr dataset page. The provider's build-time entry in `scripts/transit/providers.config.mjs` SHALL source the whole Pyrénées-Atlantiques interurban GTFS feed (no per-line filtering) and SHALL select `detectReservationDefault` as its reservation predicate.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles "Cars Régionaux 64 (Pyrénées-Atl.)" on
- **THEN** the lines and stops from `public/transit/cars-region-64/{lines.pmtiles, stops.geojson}` SHALL appear on the map in red, and the MapLibre attribution control SHALL include the provider's attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for `cars-region-64`
- **THEN** the Cars Régionaux 64 overlay SHALL NOT render until the user enables its pill

#### Scenario: Western Pyrenees covered
- **WHEN** the user enables the provider and pans to Pau, Oloron, or the vallées d'Aspe and d'Ossau
- **THEN** the interurban lines serving the Béarn / Pays basque mountains SHALL be visible

#### Scenario: Missing feed_info tolerated
- **WHEN** the provider's GTFS feed omits `feed_info.txt`
- **THEN** the build SHALL still succeed with `feed_info.txt` removed from that provider's `requiredFiles`, and `feed_valid_from`/`feed_valid_to` in `meta.json` SHALL default to null

