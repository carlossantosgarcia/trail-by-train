# gresivaudan-bus-provider Specification

## Purpose
The M Réso Grésivaudan bus network as a transit provider, and how its timetable links reach the operator's line pages.
## Requirements
### Requirement: M Réso Grésivaudan provider registration

The system SHALL register an `mreso-gresivaudan` provider conforming to the
`public-transit` `ProviderConfig` interface, with label "M Réso Grésivaudan",
line color fuchsia (`#f0abfc`, distinct from the Grenoble-area providers already
on the map — M Tag emerald, Pays Voironnais green, Cars Région Isère yellow — and
from the rail overlay's purple), `displayDefaultOn: false`, and an attribution
crediting "CC Le Grésivaudan — Réseau Tougo / M Réso Grésivaudan" under ODbL,
linking to its transport.data.gouv.fr dataset page. The build-time entry in
`scripts/transit/providers.config.mjs` SHALL source the whole `GSV` GTFS feed
(`https://data.mobilites-m.fr/api/gtfs/GSV`) and SHALL select
`detectReservationDefault` as its reservation predicate.

#### Scenario: Provider is registered and toggled

- **WHEN** the user toggles "M Réso Grésivaudan" on
- **THEN** the lines and stops from
  `public/transit/mreso-gresivaudan/{lines.pmtiles, stops.geojson}` SHALL appear
  on the map in fuchsia, and the MapLibre attribution control SHALL include the
  provider's attribution string

#### Scenario: Default off on first load

- **WHEN** a user opens the app with no persisted selection for
  `mreso-gresivaudan`
- **THEN** the Grésivaudan overlay SHALL NOT render until the user enables its
  pill

#### Scenario: Destinations Nature lines are visible

- **WHEN** the user enables the provider and pans to the Grésivaudan valley
- **THEN** the `NATURE` lines `N93`, `N94`, `N97`, `N98` and `N99` SHALL be
  visible, reaching Chamrousse, Les 7 Laux (Prapoutel), Le Super Collet, Le
  Pleynet and the Plateau des Petites Roches

#### Scenario: Routes the feed ships without geometry are omitted

- **WHEN** every trip of a route carries an empty `shape_id` — true upstream for
  `N95`, `N96` (Les 7 Laux feeder shuttles) and the three `38x` school services
- **THEN** the build SHALL omit that route rather than fabricate geometry, and
  its stops SHALL NOT appear in `stops.geojson`

#### Scenario: Nature lines report their observed service window

- **WHEN** the user opens the popup for a `NATURE` line
- **THEN** it SHALL show the service window the feed published
  (`observed_from` / `observed_to`) and the "Dernière mise à jour" pill, with
  no provider-specific branching — the pipeline no longer classifies lines as
  seasonal

#### Scenario: Undated feed_info tolerated

- **WHEN** the `GSV` feed ships a `feed_info.txt` without
  `feed_start_date`/`feed_end_date` (as the sibling `SEM` feed from the same
  endpoint does)
- **THEN** the build SHALL still succeed and `feed_valid_from`/`feed_valid_to` in
  `meta.json` SHALL default to null

### Requirement: Timetable links resolve to the operator's line page

The provider's `timetableSearchUrl` SHALL return the operator's own timetable URL
for the line, `https://www.reso-m.fr/8-horaires.htm?code=GSV:<route_short_name>`
with the line code URL-encoded, rather than the generic web-search fallback used
by providers with no known per-line URL scheme.

#### Scenario: Line popup links to the official timetable

- **WHEN** the user opens the popup for line `N98` and follows the timetable link
- **THEN** the browser SHALL open
  `https://www.reso-m.fr/8-horaires.htm?code=GSV%3AN98`

#### Scenario: Line with no short name

- **WHEN** a line's `route_short_name` is empty
- **THEN** the link SHALL fall back to the network's line index
  (`https://www.reso-m.fr/61-lignes-et-horaires.htm`) rather than emitting a
  malformed code

