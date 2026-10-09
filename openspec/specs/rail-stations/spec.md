# rail-stations Specification

## Purpose
Passenger train stations on the map: their icons and labels, when they appear, how they are built, and the control that hides them.
## Requirements
### Requirement: Passenger stations rendered as icons

The application SHALL render every French passenger rail station as a Material-Icons "train" pictogram on a small translucent white backplate, sourced from the SNCF "Liste des gares" open dataset filtered to `voyageurs=O` (passenger stations). The icon SHALL be generated at runtime by `map.addImage` from a small canvas; no committed PNG/SVG asset files are required. Every station SHALL render the same icon glyph at the same pixel size.

#### Scenario: Icons visible on every basemap

- **WHEN** the user opens the application or switches between any of the
  basemaps in the `map-viewer` switcher
- **THEN** the station icons MUST remain visible (above the rail
  overlay) without requiring any user action

#### Scenario: Icon size is constant across zoom

- **WHEN** the user zooms in or out
- **THEN** each station icon's rendered pixel size MUST stay constant (it does
  not grow with zoom and does not shrink with zoom), so stations read
  the same at every magnification

#### Scenario: Icon is visually distinct on every basemap

- **WHEN** the icons are rendered on Plan IGN, Satellite, or Topographic
  basemaps
- **THEN** each icon MUST stay legible — the dark Material-train glyph on the translucent white backplate has sufficient contrast against vector basemaps, satellite imagery, and topographic shading

#### Scenario: Icons never disappear due to symbol collision

- **WHEN** two or more stations sit within MapLibre's default symbol-collision radius of each other (dense urban areas such as central Paris or Lyon)
- **THEN** both icons MUST render (the layer SHALL use `icon-allow-overlap: true` and `icon-ignore-placement: true`)

### Requirement: Zoom-gated icon visibility

The station icons SHALL NOT be drawn below zoom 8, so the country- and regional-overview maps stay readable. Station labels remain gated at zoom 10 (a 2-zoom gap between icon and label appearance).

#### Scenario: Icons hidden at regional-overview zoom

- **WHEN** the map is at zoom ≤ 7 (country to regional overview)
- **THEN** no station icons MUST be visible

#### Scenario: Icons appear at zoom 8

- **WHEN** the user zooms in to zoom ≥ 8
- **THEN** every passenger station within the viewport MUST appear as an icon

#### Scenario: Labels appear at zoom 10

- **WHEN** the user zooms in to zoom ≥ 10
- **THEN** every visible station icon MUST be accompanied by its station-name label, anchored below the icon

### Requirement: Station icon is configurable via a single constant

The runtime icon used by the rail-stations overlay SHALL be selected by a single named constant `STATION_ICON_KEY` exported from `src/components/railStationsOverlay.ts`. The canvas-drawing function that produces the icon SHALL live alongside this constant in the same module. A future redesign — including reverting to a circle or swapping to a different pictogram — SHALL be possible by editing only this constant and its associated drawing function, with no changes elsewhere in the codebase.

#### Scenario: Swapping the production icon

- **WHEN** a developer changes the drawing function and the value of `STATION_ICON_KEY` to a new icon
- **THEN** rebuilding the app SHALL be sufficient to swap every station's rendered glyph, with no changes outside the overlay module

### Requirement: Idempotent icon image registration

The icon image registered via `map.addImage` SHALL be guarded by an `if (map.hasImage(STATION_ICON_KEY)) return;` check, so repeated calls to the station overlay setup (e.g. after a basemap swap via `map.setStyle`) do not error or duplicate work.

#### Scenario: Basemap swap

- **WHEN** the user changes the active basemap and the overlay setup function runs again
- **THEN** the icon image SHALL NOT be re-registered (the function returns early) and no console error SHALL be emitted

### Requirement: Station name labels at high zoom

The application SHALL render a text label with the station name next to
each icon when the user is zoomed in enough to make labels useful.

#### Scenario: Labels hidden at regional zoom

- **WHEN** the user is at zoom < 10
- **THEN** no station-name labels MUST be visible

#### Scenario: Labels appear at city-detail zoom

- **WHEN** the user is at zoom ≥ 10 with at least one station in the
  viewport
- **THEN** the application MUST render the station name (`libelle` from
  the source dataset) next to each visible icon, with a contrasting halo
  for legibility on every basemap

#### Scenario: Overlapping labels are dropped, not stacked

- **WHEN** two or more station labels would overlap in the rendered
  viewport
- **THEN** MapLibre's symbol-collision logic MUST drop the lower-priority
  label(s); labels MUST NOT be rendered overlapping or stacked

### Requirement: Static, build-time data pipeline

The stations data SHALL be generated by a reproducible build-time script
checked into the repository, and shipped as a single static asset.

#### Scenario: Reproducible build script

- **WHEN** a developer with `curl` and `jq` installed runs the
  documented build script
- **THEN** the script MUST fetch the SNCF "Liste des gares" records
  filtered to `voyageurs=O`, transform them to a GeoJSON
  `FeatureCollection` of Point features, drop any record whose
  coordinates are null (printing a count of dropped records to stderr),
  and write `public/rail-stations.geojson` deterministically

#### Scenario: Static-only runtime

- **WHEN** the application is served from a static host (no server-side
  process) and the user opens the map
- **THEN** the station icons and labels MUST render correctly using only
  static assets fetched from the same origin (the committed
  `rail-stations.geojson` plus the font glyphs needed for labels); no
  external API or tile-server fetch MUST be required

### Requirement: SNCF Open Data attribution

The application SHALL credit SNCF Open Data whenever the station layer
is included in the rendered map, in compliance with the ODbL licence.

#### Scenario: Attribution control includes SNCF Open Data credit

- **WHEN** the stations source is registered on the map
- **THEN** MapLibre's attribution control MUST include the string "©
  SNCF Open Data" with a link to the `liste-des-gares` dataset page,
  in addition to the existing IGN and SNCF Réseau attributions

### Requirement: User can toggle rail-stations visibility

The application SHALL expose the rail-stations visibility control **only while
the rail-network overlay is visible**; when the rail-network overlay is hidden,
no rail-stations control SHALL be rendered in the Trains section. The control
SHALL be an action-label button whose label states the action a click performs:
"Masquer les gares" while the stations are shown and "Afficher les gares" while
they are hidden.

Rail-stations visibility SHALL be coupled to the rail-network overlay:

- **WHEN** the rail-network overlay becomes visible, the rail-stations layer
  SHALL be shown by default (icons and labels together, subject to their
  zoom-gating rules).
- **WHEN** the rail-network overlay is hidden, the rail-stations layer SHALL also
  be hidden.

The rail-stations "shown/hidden" state SHALL be stateless across a rail
off→on cycle: turning the rail-network overlay off and on again SHALL always
re-show the stations, regardless of whether the user had manually hidden them
beforehand. The state SHALL NOT be persisted independently in `localStorage`;
on page load, if the rail-network overlay is visible, the stations SHALL be shown.

#### Scenario: No control when rail network is hidden

- **WHEN** the rail-network overlay is in the "off" state
- **THEN** no rail-stations control SHALL be rendered in the Trains section
- **AND** no station icons or labels SHALL render on the map

#### Scenario: Enabling rail shows gares by default

- **WHEN** the rail-network overlay transitions to the "on" state
- **THEN** the rail-stations layer SHALL be shown (icons and labels, subject to
  zoom gating) without any further user action
- **AND** the gares control SHALL be rendered reading "Masquer les gares"

#### Scenario: Hiding the gares while rail is on

- **WHEN** the gares control reads "Masquer les gares" and the user clicks it
- **THEN** the station icon and label layers SHALL be hidden from the map
- **AND** the gares control SHALL now read "Afficher les gares"
- **AND** the underlying GeoJSON source SHALL remain loaded (no refetch on
  re-enable)

#### Scenario: Re-showing the gares while rail is on

- **WHEN** the gares control reads "Afficher les gares" and the user clicks it
- **THEN** the station icon and label layers SHALL become visible again (subject
  to zoom gating)
- **AND** the gares control SHALL now read "Masquer les gares"

#### Scenario: Disabling rail hides gares

- **WHEN** the user manually hides the gares and then turns the rail-network
  overlay off
- **THEN** the station icon and label layers SHALL be hidden
- **AND** the gares control SHALL no longer be rendered

#### Scenario: Rail off→on always re-shows gares (stateless)

- **WHEN** the user hides the gares, turns the rail-network overlay off, then
  turns it back on
- **THEN** the rail-stations layer SHALL be shown again by default
- **AND** the gares control SHALL read "Masquer les gares"

#### Scenario: Gares shown on load when rail is on

- **WHEN** a user opens the application and the rail-network overlay initialises
  in the "on" state
- **THEN** the rail-stations layer SHALL be shown (subject to zoom gating) with no
  dependence on any persisted per-station preference

