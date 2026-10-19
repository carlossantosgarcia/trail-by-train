## ADDED Requirements

### Requirement: The open profile keeps its track in view

On viewports at or below the mobile breakpoint, when the bottom sheet shows the elevation profile at an open snap point, the map SHALL frame the selected track in the part of the map above the sheet, once the sheet has reached its height, so that the marker following the profile stays in sight. A track already whole in that part of the map SHALL be left where it is.

#### Scenario: The profile opens over the track

- **WHEN** a user on a phone opens the Profil segment and the sheet, risen, covers part of the selected track
- **THEN** the map MUST move so that the whole track lies above the sheet's top edge

#### Scenario: The track already shows above the sheet

- **WHEN** the Profil segment opens and the selected track already lies whole above the sheet
- **THEN** the map MUST NOT move
