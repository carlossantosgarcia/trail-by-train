# sibra-annecy-bus-provider Specification

## Purpose
The Sibra bus network (Grand Annecy) as a transit provider.
## Requirements
### Requirement: Sibra provider registration

The system SHALL register a `sibra-annecy` provider conforming to the
`public-transit` `ProviderConfig` interface, with label "Sibra (Grand Annecy)",
line color orange (`#fdba74`, distinct from the providers it is co-visible with
around Annecy — `cars-haute-savoie` pink, `cars-savoie` cyan, `cars-ain` sky and
`synchro-chambery` blue), `displayDefaultOn: false`, and an attribution crediting
"CA du Grand Annecy — Réseau urbain Sibra" under ODbL, linking to its
transport.data.gouv.fr dataset page. The build-time entry in
`scripts/transit/providers.config.mjs` SHALL source the whole Sibra GTFS feed and
SHALL select `detectReservationDefault` as its reservation predicate.

#### Scenario: Provider is registered and toggled

- **WHEN** the user toggles "Sibra (Grand Annecy)" on
- **THEN** the lines and stops from
  `public/transit/sibra-annecy/{lines.pmtiles, stops.geojson}` SHALL appear on
  the map in orange, and the MapLibre attribution control SHALL include the
  provider's attribution string

#### Scenario: Default off on first load

- **WHEN** a user opens the app with no persisted selection for `sibra-annecy`
- **THEN** the Sibra overlay SHALL NOT render until the user enables its pill

#### Scenario: Annecy walking shuttles are covered

- **WHEN** the user enables the provider and pans around the Lac d'Annecy
- **THEN** line `20` (Talloires-Montmin) and the seasonal `F1`/`F2` (Montmin,
  Col de la Forclaz) SHALL be visible, along with `41` toward Le Châtelard in
  the Bauges

#### Scenario: Missing feed_info tolerated

- **WHEN** the Sibra feed omits `feed_info.txt`
- **THEN** the build SHALL still succeed with `feed_info.txt` absent from
  `requiredFiles`, and `feed_valid_from`/`feed_valid_to` in `meta.json` SHALL
  default to null

