# mreso-grenoble-peri-bus-provider Specification

## Purpose
Coverage of the M Réso périurbain (SE2) feed from mobilites-m.fr — Proximo, Chrono and Flexo lines around Grenoble, including line 86 Allevard–Grenoble. Created by archiving change add-mreso-grenoble-peri-provider.

## Requirements
### Requirement: M Réso périurbain provider registration

The system SHALL register an `mreso-grenoble-peri` provider conforming to the
`public-transit` `ProviderConfig` interface, with label "M Réso périurbain",
region "Auvergne-Rhône-Alpes", line colour indigo (`#6366f1`, distinct from every
other provider in the catalog and from the Grenoble-area siblings — M Tag emerald,
Pays Voironnais green, Cars Région Isère yellow, M Réso Grésivaudan fuchsia),
`displayDefaultOn: false`, and an attribution crediting Mobilités M (réseau M
Réso) under ODbL, linking to `https://www.mobilites-m.fr/`. The build-time entry
in `scripts/transit/providers.config.mjs` SHALL source the whole `SE2` GTFS feed
(`https://data.mobilites-m.fr/api/gtfs/SE2`) and SHALL select
`detectReservationDefault` as its reservation predicate. Because the feed is not
published on transport.data.gouv.fr and states no licence, the entry SHALL carry a
comment recording that ODbL is assumed from the publisher's other feeds.

#### Scenario: Provider is registered and toggled

- **WHEN** the user toggles "M Réso périurbain" on
- **THEN** the lines and stops from
  `public/transit/mreso-grenoble-peri/{lines.pmtiles, stops.geojson}` SHALL appear
  on the map in indigo, and the MapLibre attribution control SHALL include the
  provider's attribution string

#### Scenario: Default off on first load

- **WHEN** a user opens the app with no persisted selection for
  `mreso-grenoble-peri`
- **THEN** the overlay SHALL NOT render until the user enables its pill

#### Scenario: No other provider shares the colour

- **WHEN** the provider catalog is read
- **THEN** no other entry SHALL have `lineColor` `#6366f1`

### Requirement: Line 86 Allevard–Grenoble is served

The provider SHALL render every route of the `SE2` feed whose trips carry a
`shape_id` present in `shapes.txt`, which includes Proximo 86 (Allevard Collège ↔
Grenoble Gare Routière), and SHALL NOT duplicate any route already served by
another provider.

#### Scenario: Line 86 is visible between Allevard and Grenoble

- **WHEN** the user enables the provider and pans between Allevard and Grenoble
- **THEN** line `86` SHALL be drawn along its route and its stops, including
  "Allevard Collège" and "Grenoble Gare Routière", SHALL appear in
  `stops.geojson` with `86` in their `serving_lines`

#### Scenario: Sibling périurbain lines are present

- **WHEN** the provider is enabled
- **THEN** lines `80`, `82`, `84`, `85`, `88`, `90`, `C11`, `C12`, `C13` and `69`
  SHALL be present alongside `86`

#### Scenario: Routes without geometry are omitted

- **WHEN** every trip of a `SE2` route carries an empty or unresolved `shape_id`
- **THEN** the build SHALL omit that route rather than fabricate geometry

#### Scenario: Undated feed_info tolerated

- **WHEN** the `SE2` `feed_info.txt` has no `feed_start_date`/`feed_end_date`
- **THEN** the build SHALL succeed and `feed_valid_from`/`feed_valid_to` in
  `meta.json` SHALL be null

### Requirement: Reservation status follows the feed's booking references

The provider SHALL select `detectReservationDefault` and SHALL derive reservation
status only from booking rules that trips actually reference. A rule the feed
publishes but no trip references SHALL leave reservation status "unknown" rather
than being applied to any line. As of 2026-09-29 the feed's single booking rule
is referenced by 0 trips, so Flexo line `69` has status "unknown" until the
publisher attaches the rule to its trips.

#### Scenario: Orphaned booking rule is not applied

- **WHEN** `booking_rules.txt` publishes a rule that no `stop_times.txt` row
  references
- **THEN** the build SHALL log the rule as orphaned and every line's reservation
  status SHALL remain "unknown"

#### Scenario: Rule becomes referenced

- **WHEN** a later feed revision references the rule from trips of line `69`
- **THEN** the shared reservation pipeline SHALL present line `69` per the
  `transit-reservation-status` rules, with no provider-specific change

### Requirement: Timetable links resolve to the operator's line page

The provider's `timetableSearchUrl` SHALL return
`https://www.reso-m.fr/8-horaires.htm?code=SE2:<route_short_name>` with the line
code URL-encoded, and SHALL fall back to
`https://www.reso-m.fr/61-lignes-et-horaires.htm` when `route_short_name` is empty.

#### Scenario: Line popup links to the official timetable

- **WHEN** the user opens the popup for line `86` and follows the timetable link
- **THEN** the browser SHALL open
  `https://www.reso-m.fr/8-horaires.htm?code=SE2%3A86`

#### Scenario: Line with no short name

- **WHEN** a line's `route_short_name` is empty
- **THEN** the link SHALL be the network's line index rather than a malformed code
