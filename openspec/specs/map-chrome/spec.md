# map-chrome Specification

## Purpose
How floating chrome composes over the map — which surfaces exist on each viewport, how they are stacked, and how their geometry is shared with the map itself.
## Requirements
### Requirement: One dock owns the top-left corner

On viewports wider than the mobile breakpoint, the search field, the GPX open action, the Explore entry and the loaded-track list SHALL render as the contents of a single positioned surface — the **Tracks dock** — rather than as independently-positioned elements. Only the dock SHALL carry positioning; its contents SHALL flow inside it, the search results included: the result list SHALL be a flowed child of the dock rather than an absolutely-positioned popover, so that it cannot be clipped by the dock's own overflow and cannot claim the corner independently.

The bottom-left gutter SHALL continue to carry only the zoom readout and the
MapLibre scale bar, which are display-only marginalia and not surfaces.

#### Scenario: No free-floating chrome remains in that corner

- **WHEN** the application is loaded on a viewport wider than 768px with tracks
  present
- **THEN** the search field, the GPX open action, the Explore entry and the track
  list MUST all render inside the dock, and none of them MUST declare its own
  `position`, `top`, `left` or `z-index`

#### Scenario: Contents cannot collide

- **WHEN** any of the dock's contents changes size — a longer label, more tracks,
  a wider action
- **THEN** the others MUST reflow within the dock rather than overlap, since none
  of them is positioned independently

#### Scenario: The result list cannot push the actions out of the dock

- **WHEN** a search returns a full set of results, at any viewport height
  including a short landscape phone
- **THEN** the list MUST scroll within the dock rather than grow past the dock's
  own maximum height
- **AND** the dock's actions MUST remain visible rather than being clipped

#### Scenario: The track list folds in place

- **WHEN** the user collapses the track list
- **THEN** it MUST fold inside the dock, leaving the dock's actions visible, and
  MUST NOT be replaced by a separately-positioned collapsed pill

#### Scenario: The dock hides when it has nothing to show

- **WHEN** Explore mode is active — which hides the search field and the file
  action, and the Explore entry hides itself — and no GPX track is loaded
- **THEN** the dock MUST NOT render, rather than showing an empty bordered
  surface

### Requirement: Chrome geometry is derived from tokens

The geometry of the chrome — gutter, dock width, the expanded elevation panel's height (`--metrics-dock-h`), and the mobile sheet's snap heights — SHALL be defined as CSS custom properties, the surfaces SHALL take their size from them, and the map's own padding calculations SHALL derive from the same properties rather than from duplicated literals.

#### Scenario: Fitting a track clears the chrome

- **WHEN** the user opens a GPX file, or invokes "Zoom to track", while the docks and the elevation panel are visible
- **THEN** the resulting viewport MUST place the whole track in the area not covered by chrome, with the padding computed from the geometry tokens rather than hard-coded values

#### Scenario: Changing a dock width needs one edit

- **WHEN** a developer changes the dock width token
- **THEN** the dock, its internal wrapping behaviour, and the map's fit padding MUST all follow from that single change, with no other width rule requiring adjustment

### Requirement: Named stacking ladder

The application SHALL define its stacking order as named z-index tokens covering, in ascending order: map overlays, map marginalia, docks, the persistent sheet, popovers and transient sheets, Explore-mode chrome, and toasts. Components SHALL reference those tokens and SHALL NOT declare numeric `z-index` literals, except `z-index: 1` within a component's own scrolling content (a sticky heading over its list), which stacks nothing against the rest of the page.

#### Scenario: No numeric z-index literals remain

- **WHEN** the repository is searched for `z-index:` under `src/**/*.module.css`
- **THEN** every match MUST reference a stacking token, or be that local exception

#### Scenario: A popover always clears the surface that opened it

- **WHEN** a popover is opened from a control inside a dock or sheet
- **THEN** it MUST render above that surface, because popovers sit above docks and sheets on the ladder by construction rather than by a hand-tuned number

### Requirement: One persistent mobile sheet with segmented sections

On viewports at or below the mobile breakpoint, the application SHALL render exactly one persistent bottom sheet, hosting the map layers, the track list and the elevation profile as segments selected from its head. The application SHALL NOT render more than one persistent sheet at a time.

A segment SHALL be offered only when it has content. Where several segments are available, the head SHALL show them as a segmented control. Where the layers segment is the only one, the head SHALL show, while the sheet is at peek, a row of quick toggles — curated hikes, GR trails, the Trains section and the Bus section — followed by an expand button — an upward chevron with no text, named "Ouvrir les calques" for assistive technology — that opens the sheet; above peek it SHALL show a plain "Calques" title rather than a single-item tab row. A quick toggle SHALL change its layer without moving the sheet. The hikes and GR toggles SHALL mirror the full panel's toggles. The Trains and Bus toggles SHALL show as on only while their section draws something, and SHALL act through the section's visibility, so the networks chosen in the full panel survive turning them off and on; turning Trains on also turns the rail network on, and turning Bus on while no bus network is chosen opens the sheet so one can be picked.

#### Scenario: Layers, tracks and profile share one sheet

- **WHEN** the application is loaded on a viewport ≤ 768px wide with at least one GPX track loaded
- **THEN** exactly one persistent sheet MUST be present, and its segmented control MUST offer the layers, tracks and profile sections

#### Scenario: Empty segments are not offered

- **WHEN** no GPX track is loaded
- **THEN** the tracks and profile segments MUST NOT be offered, and the sheet head MUST show the quick toggles at peek and a plain "Calques" title above it instead of a one-item tab row

#### Scenario: A layer toggled from the collapsed sheet

- **WHEN** the sheet is at peek with no GPX track loaded and the user taps the GR quick toggle
- **THEN** GR trails MUST appear on the map, the sheet MUST stay at peek, and the GR toggle in the full panel MUST show as on

#### Scenario: Bus with no network chosen

- **WHEN** no bus network is selected and the user taps the Bus quick toggle
- **THEN** the sheet MUST open on the layers segment so a network can be chosen

#### Scenario: Section toggles keep the panel's choices

- **WHEN** the user turns the Bus quick toggle off and on again
- **THEN** the bus networks selected in the full panel MUST be shown again as they were, as with the Bus section's own visibility toggle

#### Scenario: Losing a segment falls back rather than stranding the user

- **WHEN** the user is on the tracks or profile segment and removes the last remaining track
- **THEN** the sheet MUST fall back to the layers segment rather than render an empty pane

#### Scenario: Switching segment preserves sheet height

- **WHEN** the user switches segment while the sheet is at its half or full snap point
- **THEN** the sheet MUST stay at that snap point and swap only its content

#### Scenario: Every mobile sheet is the shared primitive

- **WHEN** the mobile chrome is rendered
- **THEN** it MUST be produced by the shared sheet primitive, including in `MapControlsPanel`, `ExplorePanel`, `HikePopup` and `TransitPopup`, none of which implements a sheet of its own

#### Scenario: Segment labels name what they contain

- **WHEN** the segmented control is rendered
- **THEN** the segment holding the user's loaded GPX files MUST NOT be labelled in a way that reads as the curated-hikes overlay, which lives in the layers segment

### Requirement: Transient sheets layer above the persistent sheet

Sheets opened by a map tap or a search — the curated-hike box, a transit line or stop, and the Explore results — SHALL render as transient surfaces above the persistent sheet, at the popover level of the stacking ladder. Opening or dismissing a transient sheet SHALL NOT change the persistent sheet's segment, and SHALL NOT require hiding the persistent sheet. The tap that opens one is a tap on the map, so it lowers the persistent sheet to peek (see `responsive-ui`).

#### Scenario: Tapping a hike does not disturb the sheet's segment

- **WHEN** the user has the persistent sheet open on the layers segment and taps a curated hike on the map
- **THEN** the hike box MUST appear above the persistent sheet, and on dismissal the persistent sheet MUST still be on the layers segment

#### Scenario: Explore results and hike box coexist

- **WHEN** the user is in Explore mode with results shown and taps a hike in those results on mobile
- **THEN** both surfaces MUST remain usable, and the application MUST NOT hide the results sheet to make room

#### Scenario: Dismissal is reachable

- **WHEN** a transient sheet that can be dismissed — the hike box or a transit sheet — is open
- **THEN** it MUST offer a dismiss control with a touch target of at least 44×44 CSS pixels, and MUST also dismiss on `Escape`, the back action, or a decisive downward drag

