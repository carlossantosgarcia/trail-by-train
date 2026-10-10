## MODIFIED Requirements

### Requirement: Zoom-level readout

On viewports wider than the mobile breakpoint, the application SHALL
display the current map zoom level as a large, semi-transparent number
anchored to the bottom-left of the map viewport. On a phone it SHALL NOT
be shown: the corner is too small to share with the sheet and the scale
bar, and the scale bar already tells a hiker what the zoom means. The readout SHALL update live whenever the zoom changes,
SHALL be display-only (no click target, no label), and SHALL NOT
block pointer events on the map beneath it.

#### Scenario: Readout reflects the current zoom

- **WHEN** the user zooms in or out via wheel, pinch, double-click,
  or any other gesture
- **THEN** the bottom-left readout MUST update to show the current
  zoom level rounded to one decimal place (e.g. `13.4`), within the
  same frame the map renders the new zoom

#### Scenario: Readout never blocks map interaction

- **WHEN** the user clicks or drag-pans the map at a screen position
  occupied by the readout
- **THEN** the click / drag MUST pass through to the map (the readout
  MUST have `pointer-events: none`) so the user can interact with
  features rendered underneath it

#### Scenario: Readout stays legible on every basemap

- **WHEN** the user switches between the topographic, satellite, and
  street basemaps
- **THEN** the readout MUST remain readable on each basemap — it MUST
  combine a translucent white fill with a dark contrast halo
  (text-shadow) so neither bright nor dark tiles swallow the digit
- **AND** it MUST stay legible over the topographic basemap's busiest
  areas, where dense brown contour lines, elevation labels and green
  forest fill sit directly under the digits

#### Scenario: No readout on phones

- **WHEN** the viewport is ≤ 768px wide
- **THEN** no zoom-level readout MUST be rendered, and the scale bar MUST
  remain

### Requirement: Map controls panel collapses into a bottom sheet on mobile

On viewports at or below the mobile breakpoint (768px), the map layer controls SHALL render as the **layers segment of the application's single persistent bottom sheet**, anchored to the bottom of the viewport instead of as a fixed side panel. At the sheet's peek snap point only the sheet head SHALL be visible — the drag handle, and either the segmented control or, when the layers segment is the only one, the quick toggles and the "Calques" action (see `map-chrome`); raising the sheet SHALL reveal the same controls available on desktop.

The controls SHALL NOT implement their own sheet. They SHALL be hosted by the shared bottom-sheet primitive defined in `responsive-ui`, alongside the track list and elevation profile segments.

#### Scenario: Controls reachable from the sheet head on mobile

- **WHEN** the application is loaded on a viewport ≤ 768px wide
- **THEN** the layer controls MUST be reachable as a segment of the single persistent sheet at its peek snap point, and MUST NOT occupy the right or left side of the screen

#### Scenario: Raising the sheet reveals all controls

- **WHEN** the user raises the sheet to its half or full snap point with the layers segment current
- **THEN** the sheet MUST host the same Bus and Trains sections, overlay toggles, day picker, frequency toggle, and colour pickers that are visible on desktop

#### Scenario: Sheet does not block map interaction at peek

- **WHEN** the persistent sheet is at its peek snap point on mobile
- **THEN** the map MUST remain interactive (pan, zoom, tap features) everywhere except the sheet head's hit area

#### Scenario: Turning to the map lowers the sheet

- **WHEN** the sheet is at half or full and the user pans or taps the map above it
- **THEN** the sheet MUST lower to peek (see `responsive-ui`)

#### Scenario: Desktop renders the side panel

- **WHEN** the viewport is wider than 768px
- **THEN** the layer controls MUST render as the right-hand controls panel, carrying the basemap switcher and the overlay sections, with no sheet behaviour and no mobile rules of its own

#### Scenario: Only one persistent sheet exists

- **WHEN** the layer controls are hosted in the sheet on mobile
- **THEN** no second persistent sheet MUST be rendered by any other component, and the sheet MUST be the shared primitive rather than a per-component implementation

### Requirement: Compact base layer switcher and zoom readout on mobile

On viewports ≤ 768px, the base layer switcher SHALL render as a wrapping row of small labelled thumbnails at the top of the layers segment, and the zoom-level readout SHALL NOT render, so the map chrome takes little of the viewport while the basemap stays one tap away.

#### Scenario: Base layer switcher compact on mobile

- **WHEN** the viewport is ≤ 768px wide and the layers segment is shown
- **THEN** the basemap switcher MUST render inline as a row of thumbnails of at least 44×44 CSS pixels each, the active one marked, with no floating pill. The 768px breakpoint is the shared mobile token

#### Scenario: Zoom readout absent on mobile

- **WHEN** the viewport is ≤ 768px wide
- **THEN** the zoom-level readout MUST NOT render (see "Zoom-level readout")

### Requirement: Scale bar

The map SHALL display a metric scale bar that shows how much real-world
distance an on-screen segment represents. The scale bar SHALL update live as
the map is panned or zoomed, express distance in metres or kilometres as
appropriate, and be anchored in the bottom-left corner of the viewport — on
desktop tucked just under the zoom-level readout (which is lifted to leave
room) — where it does not overlap the GPX button, the controls panel, or the
attribution control. The
scale bar SHALL be display-only and MUST NOT intercept map interactions.

#### Scenario: Scale bar visible on load

- **WHEN** the map finishes loading
- **THEN** a scale bar MUST be visible in the bottom-left of the map viewport,
  directly beneath the zoom-level readout on desktop
- **AND** it MUST show a labelled distance in metric units (e.g. `500 m` or
  `2 km`) corresponding to the length of the bar

#### Scenario: Scale updates live with zoom and pan

- **WHEN** the user zooms in or out, or pans to a different latitude
- **THEN** the scale bar's length and its distance label MUST update to reflect
  the current map resolution, rounded to a sensible round distance

#### Scenario: Scale bar never blocks map interaction

- **WHEN** the user clicks, drags, or performs a touch gesture on the area
  occupied by the scale bar
- **THEN** the interaction MUST pass through to the map (the scale bar has
  `pointer-events: none`)

#### Scenario: Scale bar stays legible on every basemap

- **WHEN** the user switches between the topographic, aerial, and street
  basemaps
- **THEN** the scale bar MUST remain readable on each basemap — it MUST use a
  contrasting colour and/or background or text shadow rather than relying on the
  underlying tiles

#### Scenario: Scale bar compact and clear of chrome on mobile

- **WHEN** the viewport is ≤ 768px wide
- **THEN** the scale bar MUST render in a mobile-friendly compact form that
  remains legible, is lifted just above the collapsed sheet, and continues to
  update live with `pointer-events: none`
