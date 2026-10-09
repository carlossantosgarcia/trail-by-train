# massif-central-bus-providers Specification

## Purpose
Register the seven Auvergne-Rhône-Alpes interurban "Cars Région" departmental networks as `public-transit` providers, giving the map bus coverage of the Massif Central — the Sancy and Chaîne des Puys, the Monts du Cantal, the Monts d'Ardèche, the Forez and the Pilat — via the Oura/Cityway whole-department GTFS feeds.
## Requirements
### Requirement: Massif Central "Cars Région" provider registration

The system SHALL register seven providers conforming to the `public-transit` `ProviderConfig` interface, one per Auvergne-Rhône-Alpes interurban department covering the Massif Central: `cars-ardeche` ("Cars Région Ardèche", `#fbbf24`), `cars-puy-de-dome` ("Cars Région Puy-de-Dôme", `#f97316`), `cars-cantal` ("Cars Région Cantal", `#ef4444`), `cars-haute-loire` ("Cars Région Haute-Loire", `#ec4899`), `cars-loire` ("Cars Région Loire", `#a3e635`), `cars-ain` ("Cars Région Ain", `#38bdf8`), and `cars-allier` ("Cars Région Allier", `#e879f9`). Each SHALL be `displayDefaultOn: false` and carry an attribution crediting "Région Auvergne-Rhône-Alpes — Cars Région <Department>" under ODbL, linking to its transport.data.gouv.fr dataset page. Each build-time entry in `scripts/transit/providers.config.mjs` SHALL source the whole-department GTFS feed from the Oura/Cityway open-data API using the department's verified provider token, and SHALL select `detectReservationFlexibleOr715WithReservation` as its reservation predicate (matching the existing Isère/Savoie feeds).

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles any of the seven Massif Central providers on
- **THEN** the lines and stops from `public/transit/<id>/{lines.pmtiles, stops.geojson}` SHALL appear on the map in that provider's color, and the MapLibre attribution control SHALL include its attribution string

#### Scenario: Default off on first load
- **WHEN** a user opens the app with no persisted selection for a Massif Central provider
- **THEN** that overlay SHALL NOT render until the user enables its pill

#### Scenario: Massif Central covered
- **WHEN** the user enables the relevant provider and pans to the Sancy / Chaîne des Puys (Puy-de-Dôme), the Monts du Cantal / Puy Mary (Cantal), or the Monts d'Ardèche (Ardèche)
- **THEN** the interurban lines serving those ranges SHALL be visible

#### Scenario: Correct Cityway provider token
- **WHEN** the build downloads each department's feed
- **THEN** it SHALL use the empirically verified token (e.g. `CAR_REGION_CANTAL`, `CARS_REGION_LOIRE`, `CARS_REGION_AIN`) that returns a non-empty GTFS zip rather than an HTTP 204 empty response

