# cars-isere-transit Specification

## Purpose
The Cars Région Isère coach network as a transit provider: how its feed is built into lines and stops, and how they are drawn and described.
## Requirements
### Requirement: Cars Région Isère provider registration

The system SHALL register a `cars-isere` provider conforming to the `public-transit` `ProviderConfig` interface, with: id `cars-isere`, label "Cars régionaux" (or "Cars Région Isère" if disambiguation is needed), the provider's chosen line color (teal, distinct from the rail overlay's color), an attribution string `© Région Auvergne-Rhône-Alpes — cars Région Isère (ODbL), via transport.data.gouv.fr` linking to the dataset page, and a `timetableSearchUrl(line)` function that returns a URL pre-filled with the line's short and long name.

#### Scenario: Provider is registered and toggled
- **WHEN** the user toggles "Cars régionaux" on
- **THEN** the lines and stops served by `public/transit/cars-isere/{lines.geojson, stops.geojson}` SHALL appear on the map and the MapLibre attribution control SHALL include the ODbL attribution string above

### Requirement: GTFS-driven build pipeline

A reproducible build script (`scripts/transit/cars-isere/build.mjs`) SHALL download the Cars Région Isère GTFS feed from `transport.data.gouv.fr`, parse it, dedupe shapes to one geometry per `route_id` (merging both directions per design D2), compute per-day-type service statistics, detect TAD and seasonal flags per design D5, and emit `public/transit/cars-isere/{lines.geojson, stops.geojson, meta.json}`. The script SHALL be idempotent and SHALL fail loudly when required GTFS files or assumed signals are missing.

#### Scenario: Build with a complete feed
- **WHEN** the build script runs against a feed containing `agency.txt`, `routes.txt`, `trips.txt`, `stops.txt`, `stop_times.txt`, `calendar.txt`, `calendar_dates.txt`, and `shapes.txt`
- **THEN** the script SHALL exit successfully and write `lines.geojson` (one Feature per `route_id`), `stops.geojson` (one Feature per used stop), and `meta.json`

#### Scenario: Build with a missing required file
- **WHEN** the build script runs against a feed missing one of the required GTFS files
- **THEN** the script SHALL exit non-zero with a message identifying the missing file and SHALL not overwrite the existing shipped artifacts

### Requirement: Per-day-type service statistics

For each route, the build script SHALL compute one `ServiceWindow` per day type (`weekday` = a representative Lun–Ven, `saturday`, `sunday-or-holiday`), with both directions merged: `firstDep` (earliest trip departure across both directions, `HH:MM`), `lastDep` (latest trip departure, `HH:MM`), `trips` (count of trips across both directions on that day-type), and `avgGapMin` (rounded mean gap in minutes between consecutive departures across both directions). A day-type with zero trips SHALL have its `ServiceWindow` set to `null`.

#### Scenario: Weekday-only line
- **WHEN** a route runs 24 trips per weekday and 0 trips on Saturday and Sunday
- **THEN** the emitted Feature SHALL have a populated `service.weekday` and `service.saturday === null` and `service.sunday === null`

#### Scenario: Seven-day line with consistent frequency
- **WHEN** a route runs 24 trips per day every day of the week, first 06:40, last 19:20
- **THEN** the emitted Feature SHALL have all three `ServiceWindow`s populated with matching `firstDep`/`lastDep` and a sensible `avgGapMin`

### Requirement: Stop dataset with serving-lines list

The build script SHALL emit `stops.geojson` containing only stops referenced by at least one rendered route. Each Point Feature SHALL have `stop_id`, `stop_name`, and `serving_lines: [{ route_id, short_name, color }, …]` matching the lines that include the stop in any trip.

#### Scenario: Stop served by one line
- **WHEN** a stop is referenced only by one route
- **THEN** the emitted stop Feature SHALL have a `serving_lines` array of length 1 with that route's id, short name, and color

#### Scenario: Interchange stop
- **WHEN** a stop is referenced by N distinct routes
- **THEN** the emitted stop Feature SHALL have a `serving_lines` array of length N

### Requirement: Per-provider visual rules

The Cars Région Isère overlay SHALL render all of its lines with a single per-provider line color. Reservation status SHALL NOT change how a line is painted — it is surfaced in the popup instead. Lines the feed no longer publishes SHALL render dashed and faded per the `transit-line-ledger` capability. Single-line stops SHALL be filled with the corresponding `route_color`; multi-line stops SHALL be filled neutral white with a dark stroke.

#### Scenario: Reservation status does not change the paint

- **WHEN** the overlay is on and lines with differing reservation status are in view
- **THEN** they SHALL render identically, and the difference SHALL be visible only in the popup's reservation pill

#### Scenario: A line no longer in the feed is rendered

- **WHEN** the overlay is on and an archived line is in view
- **THEN** it SHALL render dashed and faded relative to lines still in the feed

#### Scenario: An interchange stop is rendered

- **WHEN** the overlay is on and a stop served by more than one line is in view
- **THEN** it SHALL be filled neutral white with a dark stroke

### Requirement: Timetable search URL behavior

The provider's `timetableSearchUrl(line)` SHALL return a URL that performs a web search pre-filled with at least the operator name, the line's `route_short_name`, the line's `route_long_name`, and the keyword `horaires`. When `public/transit/cars-isere/line-urls.json` is present and contains an entry for the line's `route_short_name`, the value in that file SHALL take precedence as the popup's link target.

#### Scenario: No override file
- **WHEN** no `line-urls.json` exists for the `cars-isere` provider
- **THEN** the popup link for every line SHALL point to the result of `timetableSearchUrl(line)`

#### Scenario: Override present
- **WHEN** `line-urls.json` contains `{"T10": "https://example.com/T10"}` and the user clicks line T10
- **THEN** the popup link SHALL be `https://example.com/T10`

