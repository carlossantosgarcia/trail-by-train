# vosges-bus-providers Specification

## Purpose
Register the three Grand Est interurban "Fluo Grand Est" departmental networks as `public-transit` providers, giving the map bus coverage of the Massif des Vosges — the Hautes-Vosges crêtes, the Ballon d'Alsace and the Vosges du Nord — via the Grand Est Cityway whole-department GTFS feeds.
## Requirements
### Requirement: Massif des Vosges "Fluo Grand Est" provider registration

The system SHALL register three providers conforming to the `public-transit` `ProviderConfig` interface, one per Grand Est interurban department covering the Massif des Vosges: `fluo-vosges` ("Fluo Vosges (88)", `#22c55e`), `fluo-haut-rhin` ("Fluo Haut-Rhin (68)", `#3b82f6`), and `fluo-bas-rhin` ("Fluo Bas-Rhin (67)", `#a855f7`). Each SHALL be `displayDefaultOn: false` and carry an attribution crediting "Région Grand Est — Réseau Fluo Grand Est <Department>" under Licence Ouverte 2.0, linking to its transport.data.gouv.fr dataset page. Each build-time entry in `scripts/transit/providers.config.mjs` SHALL source the whole-department GTFS feed from the Grand Est Cityway open-data endpoint using the department's `OperatorCode` (`LIVO`, `CG68`, `CG67`), and SHALL select `detectReservationDefault` as its reservation predicate.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles any of the three Vosges providers on
- **THEN** the lines and stops from `public/transit/<id>/{lines.pmtiles, stops.geojson}` SHALL appear on the map in that provider's color, and the MapLibre attribution control SHALL include its attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for a Vosges provider
- **THEN** that overlay SHALL NOT render until the user enables its pill

#### Scenario: Massif des Vosges covered
- **WHEN** the user enables the relevant provider and pans to the Hautes-Vosges crêtes (Vosges 88), the Ballon d'Alsace / Vosges alsaciennes (Haut-Rhin 68), or the Vosges du Nord (Bas-Rhin 67)
- **THEN** the interurban lines serving those areas SHALL be visible

