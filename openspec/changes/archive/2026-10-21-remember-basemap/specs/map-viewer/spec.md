## MODIFIED Requirements

### Requirement: Basemap switcher control

The map SHALL expose a visually rich UI control that lets the user pick
which basemap is active. The control SHALL show, for each basemap, a
preview thumbnail alongside its label so the user can recognize the
basemap's style without activating it. Only one basemap is shown at a
time.

The basemap the user picks, from this switcher or Explore's, SHALL be stored
in `localStorage` under `hp.basemap`, and SHALL NOT be sent anywhere. The map
SHALL open on the stored basemap; with none stored, or one no longer in the
catalogue, or no usable storage, it SHALL open on Satellite. Only a pick SHALL
be stored, never the default.

#### Scenario: Switcher is visible on the map

- **WHEN** the map is rendered
- **THEN** a basemap switcher control MUST be visible in the top-right of
  the map and MUST list every entry from the basemap catalogue, with each
  entry rendering a preview thumbnail image and the entry's label

#### Scenario: Selecting a basemap activates it

- **WHEN** the user selects a basemap entry from the switcher (by click,
  tap, or keyboard activation)
- **THEN** the map MUST show that basemap and hide all other basemaps
  within one render frame, without re-centering or resetting the user's
  pan/zoom

#### Scenario: Exactly one basemap visible at a time

- **WHEN** the application has finished loading
- **THEN** exactly one basemap MUST be visible: the one the user last
  picked, or "Satellite" when they never picked one

#### Scenario: The choice survives a reload

- **WHEN** the user picks "Topo" and reloads the page
- **THEN** the map MUST open on Topo, with no Satellite tiles requested

#### Scenario: A stored basemap that no longer exists

- **WHEN** the stored basemap is not in the catalogue
- **THEN** the map MUST open on Satellite

#### Scenario: Active basemap is visually distinguished

- **WHEN** a basemap is the currently active one
- **THEN** its entry in the switcher MUST be visually distinguished from
  the inactive entries (e.g. a coloured border or ring around its
  thumbnail and emphasized label) so the active selection is unambiguous
  at a glance

#### Scenario: Thumbnails are static and bundled

- **WHEN** the production bundle is served
- **THEN** each basemap preview thumbnail MUST be served as a static
  asset from the bundle (no runtime fetch to the WMTS tile server is
  required to render the switcher) so the switcher renders fully on the
  first paint and works offline once the bundle is loaded
