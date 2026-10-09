# lignes-azur-bus-provider Specification

## Purpose
The Lignes d'Azur bus network (Nice Côte d'Azur) as a transit provider.
## Requirements
### Requirement: Lignes d'Azur provider registration

The system SHALL register a `lignes-azur` provider conforming to the
`public-transit` `ProviderConfig` interface, with label "Lignes d'Azur (Nice)",
line color sky (`#7dd3fc`, distinct from the Région Sud providers it is
co-visible with — `zou` orange and `zou-proximite` rose), `displayDefaultOn:
false`, and an attribution crediting "Métropole Nice Côte d'Azur — Réseau Lignes
d'Azur" under Licence Ouverte 2.0, linking to its transport.data.gouv.fr dataset
page. The build-time entry in `scripts/transit/providers.config.mjs` SHALL source
the whole Lignes d'Azur GTFS feed and SHALL select `detectReservationDefault` as its
reservation predicate.

#### Scenario: Provider is registered and toggled

- **WHEN** the user toggles "Lignes d'Azur (Nice)" on
- **THEN** the lines and stops from
  `public/transit/lignes-azur/{lines.pmtiles, stops.geojson}` SHALL appear on the
  map in sky blue, and the MapLibre attribution control SHALL include the
  provider's attribution string

#### Scenario: Default off on first load

- **WHEN** a user opens the app with no persisted selection for `lignes-azur`
- **THEN** the Lignes d'Azur overlay SHALL NOT render until the user enables its
  pill

#### Scenario: Mercantour valley access is covered

- **WHEN** the user enables the provider and pans north from Nice
- **THEN** the Tinée lines `90` (La Bolline), `91` (Auron) and `92` (Isola 2000)
  and the Vésubie lines `93` (Lantosque) and `94` (Roquebillière) SHALL be
  visible, giving bus access to the Mercantour

