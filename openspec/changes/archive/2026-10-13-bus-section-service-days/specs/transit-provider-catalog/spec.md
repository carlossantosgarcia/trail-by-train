## MODIFIED Requirements

### Requirement: Each network is declared once

Every transit network SHALL be one entry in `scripts/transit/providers.config.mjs`.
The build pipeline SHALL read that entry to produce `public/transit/<id>/`, and
the app SHALL derive its provider list from the same entries
(`src/transit/providers.ts`), so a label, colour or attribution can never differ
between the two. The order of the entries SHALL be the map's layer order.

Each entry SHALL declare: `id`, `label`, `region`, `gtfsUrl` (one URL, or several
when a network is published as several archives), `sourceUrl` (the dataset page),
`license`, `attribution`, `lineColor`, `timetable`, `requiredFiles`,
`reservationPredicate` and `displayDefaultOn`.

Asset URLs SHALL NOT be declared: the app derives them from the id as
`transit/<id>/lines.pmtiles`, `transit/<id>/stops.geojson` and
`transit/<id>/meta.json` under the site's base path.

#### Scenario: Adding a network

- **WHEN** a contributor appends an entry and runs `npm run build:transit -- <id>`
- **THEN** the network SHALL appear in the provider picker, draw from its built
  artifacts, and credit its publisher, with no other file edited
