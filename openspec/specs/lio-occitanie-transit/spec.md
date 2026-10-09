# lio-occitanie-transit Specification

## Purpose
Register the Réseau interurbain liO Occitanie bus network as a `public-transit` provider, giving the map coverage of the central and eastern French Pyrenees (Ariège, Hautes-Pyrénées, Pyrénées-Orientales, and the Comminges/Luchon lines in Haute-Garonne) via the whole-region liO GTFS feed.
## Requirements
### Requirement: liO Occitanie provider registration

The system SHALL register a `lio-occitanie` provider conforming to the `public-transit` `ProviderConfig` interface, with: id `lio-occitanie`, label "liO Occitanie", line color teal-400 (`#2dd4bf`, distinct from the ten existing providers' colors), `displayDefaultOn: false`, and an attribution string crediting "Région Occitanie — Réseau interurbain liO" under ODbL, linking to the transport.data.gouv.fr dataset page. The provider's build-time entry in `scripts/transit/providers.config.mjs` SHALL source the whole liO Occitanie interurban GTFS feed (no per-line or per-department filtering) and SHALL select `detectReservationDefault` as its reservation predicate.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles "liO Occitanie" on
- **THEN** the lines and stops from `public/transit/lio-occitanie/{lines.pmtiles, stops.geojson}` SHALL appear on the map in teal, and the MapLibre attribution control SHALL include the provider's ODbL attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for `lio-occitanie`
- **THEN** the liO Occitanie overlay SHALL NOT render until the user enables its pill

#### Scenario: Central and eastern Pyrenees covered
- **WHEN** the user enables the provider and pans to Ariège (09), the Hautes-Pyrénées (65), the Pyrénées-Orientales (66), or the Comminges/Luchon area (31)
- **THEN** the liO interurban lines serving those areas SHALL be visible

#### Scenario: Whole network included
- **WHEN** the provider's build runs against the liO Occitanie GTFS feed
- **THEN** every commercial route present in the feed SHALL be emitted, with no per-line or per-department inclusion/exclusion filter applied

