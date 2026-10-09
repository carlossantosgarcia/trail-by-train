# jura-morvan-bus-providers Specification

## Purpose
Register the Bourgogne-Franche-Comté interurban "Mobigo" network as a single `public-transit` provider, giving the map bus coverage of the Massif du Jura and the Morvan — the Haut-Jura, the Haut-Doubs, the Plateau des 1000 étangs and the Morvan — from the region-wide Mobigo GTFS feed covering every département at once.
## Requirements
### Requirement: Massif du Jura & Morvan "Mobigo" provider registration

The system SHALL register a single provider `mobigo` ("Mobigo Bourgogne-Franche-Comté", `#14b8a6`) conforming to the `public-transit` `ProviderConfig` interface, covering every Bourgogne-Franche-Comté interurban département in one overlay rather than one provider per département. It SHALL be `displayDefaultOn: false` and carry an attribution crediting "Région Bourgogne-Franche-Comté — Réseau Mobigo" under Licence Ouverte 2.0, linking to the transport.data.gouv.fr Mobigo dataset page. Its build-time entry in `scripts/transit/providers.config.mjs` SHALL source the region-wide GTFS feed published at `viamobigo.fr`, and SHALL select `detectReservationDefault` as its reservation predicate.

Rationale: the per-département split reproduced the publisher's file layout, not anything a reader wants — someone looking for a bus to a trailhead does not care which département's feed carried it, and the split left three neighbouring départements off the map while presenting four pills to toggle. The region-wide feed also restores geometry the Jura department feed stopped shipping, and covers the Morvan properly, which spans Nièvre, Saône-et-Loire and Côte d'Or.

The provider SHALL source service exclusively from `calendar_dates`, without requiring `calendar.txt`, because the region-wide feed expresses every service day as an explicit exception.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles the Mobigo provider on
- **THEN** the lines and stops from `public/transit/mobigo/{lines.pmtiles, stops.geojson}` SHALL appear on the map in that provider's color, and the MapLibre attribution control SHALL include its attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for the Mobigo provider
- **THEN** that overlay SHALL NOT render until the user enables its pill

#### Scenario: Jura and Morvan covered
- **WHEN** the user enables the provider and pans to the Haut-Jura (39), the Haut-Doubs (25), the Plateau des 1000 étangs / Ballons (70), or the Morvan (58, 71, 21)
- **THEN** the interurban lines serving those areas SHALL be visible from the one overlay

#### Scenario: Côte-d'Or, Yonne and Saône-et-Loire are covered
- **WHEN** the user pans to Côte d'Or (21), Yonne (89) or Saône-et-Loire (71)
- **THEN** the Mobigo interurban lines serving them SHALL be visible

#### Scenario: Service is derived without calendar.txt
- **WHEN** the provider is built from a feed carrying `calendar_dates.txt` but no `calendar.txt`
- **THEN** the build SHALL succeed, and lines SHALL still carry day-type service windows and frequency flags derived from the exception dates

#### Scenario: Retired department providers leave no dangling references
- **WHEN** the app loads after the four department providers are removed
- **THEN** no layer, pill, asset path or registry entry SHALL reference `mobigo-jura`, `mobigo-doubs`, `mobigo-haute-saone` or `mobigo-nievre`, and a stored visibility preference naming one of them SHALL be ignored without error

#### Scenario: Feed validity is published
- **WHEN** the provider is built
- **THEN** `feed_valid_from` and `feed_valid_to` in `meta.json` SHALL carry the dates the region-wide feed declares in `feed_info.txt`, rather than the nulls the per-département feeds left behind by omitting that file

