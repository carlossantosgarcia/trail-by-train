# gr-trails Specification

## Purpose
The GR long-distance trails overlay, built from OpenStreetMap: how the data is gathered and tiled, drawn and labelled, and linked to the official pages.
## Requirements
### Requirement: GR data acquisition from OpenStreetMap

The system SHALL provide a build-time script that fetches all GR (Grande Randonnée) hiking relations covering metropolitan France and Corsica from OpenStreetMap via the Overpass API, and writes a normalized intermediate GeoJSON file under a gitignored cache directory.

The Overpass query MUST filter to `route=hiking` relations whose `ref` tag matches the pattern for GR routes (e.g. `^GR ?[0-9]`), and MUST exclude `GR de Pays` (GRP) and `PR` routes.

The script MUST handle GR routes modelled in OSM as `type=superroute` (relations whose direct members are other relations, not ways). To do so:

- The Overpass query MUST union the `area.fr`-filtered relation query with a second, global query for `relation["type"="superroute"]["route"="hiking"]["network"="nwn"]["ref"~"^GR ?[0-9]"]`, then transitively recurse down (`>>`) so descendant relations, ways, and nodes are present in a single response.
- The walker MUST flatten each top-level GR relation into its full set of ways by recursing through child-relation members, with a cycle guard.
- When a `ref` is produced by both a direct (`area.fr`) match and a super-relation match, the super-relation match MUST be skipped — Spain's "Gran Recorrido" network reuses `GR<n>` refs with `network=nwn` and would otherwise inflate French route lengths after merge-by-ref.
- A coarse FR/Corsica bounding box check (lon `[-5.5, 10.0]`, lat `[41.0, 51.5]`) MUST be applied to super-relation matches as a safety net: a relation MUST be dropped if fewer than 50% of its sampled coordinates fall inside the box.

The script MUST drop short variant / branch / access routes that share a parent GR, so the shipped overlay only carries trails users can plan with:

- A `ref` is treated as a **variant** when it matches the pattern `^GR ?\d+[A-Z]$` (digits followed by a single trailing uppercase letter), e.g. `GR 4B`, `GR 211A`, `GR 5C`. Refs with only digits (`GR 5`, `GR 34`) or with dotted/hyphenated subnumbering (`GR 10.1`) MUST be treated as standalone and never dropped by this filter.
- The filter MUST run after merge-by-ref so that the decision uses the route's total merged length, not a per-way segment length.
- A variant `ref` MUST be dropped iff its merged `total_km` is strictly less than 100. Standalone refs MUST be kept regardless of length.
- The build summary MUST report the count of variant routes dropped under the threshold, distinct from the existing "no/invalid ref" drop counter.

#### Scenario: Successful nationwide fetch
- **WHEN** a developer runs `npm run build:gr` with network access
- **THEN** the script queries Overpass for all matching GR relations in France + Corsica, normalizes each route's `ref` (e.g. `GR5` and `GR 5` both become `GR 5`), and writes the resulting GeoJSON FeatureCollection to a cache file
- **AND** prints a summary including the number of routes, total kilometers, and a list of any relations dropped for missing/invalid `ref`

#### Scenario: Overpass timeout or rate limit
- **WHEN** the Overpass query fails with a timeout or 429 status
- **THEN** the script retries at least once with exponential backoff before exiting with a non-zero status and a clear error message

#### Scenario: GR modelled as a pure super-relation
- **WHEN** a GR route (e.g. GR 34 "Sentier des Douaniers", GR 65 "Chemin de Saint-Jacques via Le Puy", GR 367 "Sentier Cathare") exists in OSM as `type=superroute` whose direct members are stage child relations rather than ways
- **THEN** the script SHALL still produce a normalized feature for that route with geometry flattened from every way reachable through its child-relation members

#### Scenario: Foreign GR with a colliding ref
- **WHEN** a Spanish or Portuguese `type=superroute` relation with `network=nwn` shares a `ref` (e.g. `GR 10`, `GR 11`) with a French GR that the `area.fr` query already covered
- **THEN** the script SHALL skip the foreign super-relation so the merged French route's `total_km` reflects only the French geometry

#### Scenario: Short variant route dropped
- **WHEN** the merged feature for `ref = "GR 4B"` (or any ref matching `^GR ?\d+[A-Z]$`) has `total_km < 100`
- **THEN** the script SHALL omit that feature from the output FeatureCollection
- **AND** SHALL increment the "dropped (variant under threshold)" counter in the build summary

#### Scenario: Long variant route kept
- **WHEN** the merged feature for a variant ref (e.g. `GR 65A` hypothetically) has `total_km ≥ 100`
- **THEN** the script SHALL keep the feature in the output, on the assumption that a 100+ km branch is significant enough to be navigable in its own right

#### Scenario: Short standalone GR kept
- **WHEN** the merged feature for a standalone ref (`GR 80` "Tour de l'île d'Yeu", 27.5 km, or `GR 72`, 26.1 km) has `total_km < 100` but the ref does NOT match the variant pattern
- **THEN** the script SHALL keep the feature in the output

### Requirement: Official-link resolution per route
The system SHALL resolve, at build time, the most authoritative external URL available for each GR route and bake it into the tile properties so the runtime needs no external lookups.

Resolution MUST try sources in this order, using the first one that yields a usable URL:
1. The relation's `wikipedia` tag (e.g. `fr:GR 5` → `https://fr.wikipedia.org/wiki/GR_5`).
2. The relation's `wikidata` tag, resolved via the Wikidata API to the French Wikipedia article URL when one exists.
3. The relation's `website` tag, used as-is when it is a valid HTTP(S) URL.
4. Fallback: `https://www.openstreetmap.org/relation/{id}`.

Wikidata resolutions MUST be cached on disk so repeated builds do not re-hit the API.

#### Scenario: Route has a Wikipedia tag
- **WHEN** the OSM relation has `wikipedia=fr:GR 20`
- **THEN** the baked `link` property for that route resolves to `https://fr.wikipedia.org/wiki/GR_20`

#### Scenario: Route has only a Wikidata tag
- **WHEN** the relation has `wikidata=Q...` but no `wikipedia` tag
- **THEN** the script queries Wikidata, caches the result, and bakes the resolved French Wikipedia URL into the `link` property
- **AND** subsequent builds do not re-query Wikidata for the same entity

#### Scenario: Route has no usable external tags
- **WHEN** the relation has no `wikipedia`, `wikidata`, or `website` tags
- **THEN** the baked `link` property is `https://www.openstreetmap.org/relation/{id}` for that relation

### Requirement: PMTiles artifact production
The system SHALL convert the normalized GR GeoJSON to a single PMTiles file at `public/data/gr-routes.pmtiles` using Tippecanoe with zoom-dependent simplification. The artifact SHALL NOT be committed; it is published with the other generated datasets (see `scheduled-data-refresh`).

Each feature in the PMTiles output MUST carry at least the properties: `ref` (normalized GR name), `name` (full route name when available), `length_km` (computed length in kilometers), and `link` (resolved external URL).

#### Scenario: Successful tile build
- **WHEN** `npm run build:gr` runs to completion
- **THEN** `public/data/gr-routes.pmtiles` exists and is non-empty
- **AND** each feature carries the required `ref`, `name`, `length_km`, and `link` properties

#### Scenario: Missing Tippecanoe binary
- **WHEN** the build script runs but the `tippecanoe` binary is not on `PATH`
- **THEN** the script exits with a non-zero status and prints clear installation instructions

### Requirement: Side-menu toggle for GR overlay
The system SHALL expose a single on/off toggle labeled for GR trails in the map controls side menu, defaulting to off, with state persisted across browser sessions.

The toggle MUST sit in the Randonnée section, beside the curated-hikes toggle, and MUST be the overlay's only control (no colour picker, no day filter, no variant picker).

#### Scenario: First-time visitor
- **WHEN** a user loads the app for the first time
- **THEN** the GR toggle is visible in the controls panel and is set to off
- **AND** no GR features are rendered on the map

#### Scenario: Toggling on
- **WHEN** the user clicks the GR toggle to enable it
- **THEN** GR features render on the map
- **AND** the on state is persisted to localStorage so the next page load also shows the overlay

#### Scenario: Toggling off
- **WHEN** the user clicks the GR toggle to disable it after it was on
- **THEN** all GR features (lines, labels, hover highlight, any open popup) are removed from the map
- **AND** the off state is persisted to localStorage

### Requirement: GR line rendering
The system SHALL render the GR network as a single translucent red line, drawn from the vector source so the basemap remains partially visible underneath.

The line width and opacity MUST stay constant across zoom levels so the network reads identically from country-wide to street-detail zoom.

#### Scenario: GR lines drawn as a translucent red line
- **WHEN** the GR overlay is enabled and the map is at a zoom where the layer is visible
- **THEN** every GR feature is rendered as a solid translucent red line, with the basemap visible through it

#### Scenario: Stable rendering across zoom levels
- **WHEN** the user zooms from a low zoom level to a high zoom level
- **THEN** the line keeps the same constant pixel width and opacity, remaining legible at both extremes

### Requirement: Route labels along the line
The system SHALL render `GR XX` labels along each route using line-following label placement, with red text and a white halo, visible only at zoom levels at and above z8.

#### Scenario: Labels appear at sufficient zoom
- **WHEN** the GR overlay is enabled and the map is at z ≥ 8
- **THEN** labels showing the normalized `ref` (e.g. `GR 5`) are rendered along the line, repeating so that at least one label is visible on any reasonably long visible segment

#### Scenario: Labels hidden at low zoom
- **WHEN** the GR overlay is enabled but the map is at z < 8
- **THEN** no GR text labels are rendered, only the red GR lines

### Requirement: Click highlight by route ref
The system SHALL highlight all segments belonging to the same GR route when the user clicks any segment of that route, so users can disambiguate overlapping or branching routes. The highlight is paired with the click popup (see below); dismissing the popup clears the highlight.

The highlight MUST NOT be driven by hover: calling `setFilter` on every `mousemove` lags for seconds at low zoom.

#### Scenario: Clicking a GR segment
- **WHEN** the user clicks a GR feature on the map
- **THEN** every feature on the map sharing the same normalized `ref` is rendered in a yellow highlight style overlaid on the red line

#### Scenario: Dismissing the popup clears the highlight
- **WHEN** the user closes the GR popup (close button, Esc, or clicking elsewhere on the map)
- **THEN** the yellow highlight is removed and the lines return to their default red styling

### Requirement: Click popup with route metadata and external link
The system SHALL open a popup on click of any GR feature, showing the route reference, full name, total length in kilometers, a link to the most authoritative external page baked into the feature at build time, and a credit and link to the official FFRandonnée routes.

The popup MUST follow the same visual pattern as existing transit popups. The length displayed MUST be the sum of all segments sharing the same normalized `ref`, not just the clicked feature.

#### Scenario: Clicking a GR feature
- **WHEN** the user clicks a GR feature on the map
- **THEN** a popup opens at the click point showing the normalized `ref`, the full `name` (when available), the total length in kilometers for the entire route, a link to the baked `link` URL, a link to the official routes on MonGR.fr (FFRandonnée), and a note that the route comes from OpenStreetMap, may differ from the official waymarking, and that GR® is a registered trademark of the FFRandonnée

#### Scenario: Closing the popup
- **WHEN** the user clicks elsewhere on the map or closes the popup explicitly
- **THEN** the popup is dismissed

### Requirement: Layer stacking relative to other overlays
The system SHALL position GR lines below curated hikes and user GPX tracks, and above transit lines (rail network, regional buses) and the basemap. GR labels SHALL be placed in the top symbol layer alongside station and stop labels.

#### Scenario: Curated hike crosses a GR
- **WHEN** the curated-hikes overlay and the GR overlay are both enabled and a curated hike geometry overlaps a GR route
- **THEN** the curated hike is rendered visibly on top of the GR red line

#### Scenario: Transit line crosses a GR
- **WHEN** a transit overlay and the GR overlay are both enabled and a transit line overlaps a GR route
- **THEN** the GR red line is rendered visibly on top of the transit line

#### Scenario: GR label vs station marker
- **WHEN** a GR label and a station symbol could collide
- **THEN** both are placed by the map's symbol-layer collision logic, with neither hidden by a line layer

### Requirement: OpenStreetMap attribution
The system SHALL display attribution to OpenStreetMap contributors whenever the GR overlay contributes rendered content to the map.

#### Scenario: GR overlay enabled
- **WHEN** the user enables the GR overlay
- **THEN** the map's attribution control includes "© OpenStreetMap contributors"

