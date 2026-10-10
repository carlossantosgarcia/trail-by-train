## MODIFIED Requirements

### Requirement: One persistent mobile sheet with segmented sections

On viewports at or below the mobile breakpoint, the application SHALL render exactly one persistent bottom sheet, hosting the map layers, the track list and the elevation profile as segments selected from its head. The application SHALL NOT render more than one persistent sheet at a time.

A segment SHALL be offered only when it has content. Where several segments are available, the head SHALL show them as a segmented control. Where the layers segment is the only one, the head SHALL show, while the sheet is at peek, a row of quick toggles — curated hikes, GR trails, the Trains section and the Bus section — followed by a "Calques" action that opens the sheet; above peek it SHALL show a plain "Calques" title rather than a single-item tab row. A quick toggle SHALL change its layer without moving the sheet. The hikes and GR toggles SHALL mirror the full panel's toggles. The Trains and Bus toggles SHALL show as on only while their section draws something, and SHALL act through the section's visibility, so the networks chosen in the full panel survive turning them off and on; turning Trains on also turns the rail network on, and turning Bus on while no bus network is chosen opens the sheet so one can be picked.

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
