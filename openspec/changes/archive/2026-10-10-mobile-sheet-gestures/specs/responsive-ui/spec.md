## MODIFIED Requirements

### Requirement: Map-dominant mobile layout

On viewports at or below the mobile breakpoint, the map canvas SHALL remain the dominant surface and UI chrome SHALL NOT collectively cover more than ~15% of the visible area in its default (collapsed) state.

On viewports wider than the mobile breakpoint, the top-left chrome SHALL compose into the single Tracks dock defined by the `map-chrome` capability rather than into independently-positioned floating elements.

#### Scenario: Collapsed chrome on mobile

- **WHEN** the application loads on a viewport ≤ 768px wide with all overlays at their default state
- **THEN** the visible area covered by persistent UI chrome (the Tracks dock, the sheet at its peek snap point and the scale bar) MUST not exceed ~15% of the viewport, leaving the remainder of the screen for the map

#### Scenario: Desktop top-left chrome is one surface

- **WHEN** the viewport is wider than 768px
- **THEN** the GPX open action, the Explore entry and the track list MUST render inside the Tracks dock defined by `map-chrome`, with the controls panel on the right and the zoom readout and scale bar remaining as display-only marginalia in the bottom-left gutter

### Requirement: Bottom-sheet primitive for collapsible mobile surfaces

The application SHALL provide a reusable bottom-sheet UI primitive that hosts collapsible mobile content, and every mobile sheet in the application SHALL be built from it — no component may implement its own.

The sheet SHALL support three snap points: **peek** (head only), **half** and **full**. Half and full SHALL be caps rather than fixed heights: half is the smaller of ≈46% of the viewport height and the sheet's content height (head plus body content), full the smaller of ≈88% of the viewport height and the content height. A sheet SHALL therefore never be taller than its content, and when its content fits under the half cap, half and full SHALL be the same single open height. The user SHALL be able to move between snap points by dragging the sheet or tapping its head.

While a sheet is above peek, or a transient sheet is shown, the browser's back action SHALL close it — lower the persistent sheet to peek, dismiss a transient sheet — rather than leave the page. Closing a sheet by any other means SHALL consume the history entry its opening added, so open-and-close does not grow the back history.

#### Scenario: Drag between snap points

- **WHEN** the user drags the sheet upward from its peek state
- **THEN** the sheet MUST follow the pointer and, on release, settle at the nearest distinct snap point — or, if the release velocity exceeds the flick threshold, at the next distinct snap point in the direction of travel

#### Scenario: Tap head to cycle

- **WHEN** the sheet is at peek and the user taps its head outside any control
- **THEN** the sheet MUST open to its opening snap point (half unless the consumer chooses full); tapping the head again from half or full MUST return it to peek

#### Scenario: A sheet is no taller than its content

- **WHEN** a sheet whose content needs 60% of the viewport is raised to full
- **THEN** it MUST stop at 60% of the viewport, with no empty band below its content

#### Scenario: Short content has one open height

- **WHEN** a sheet's content fits under the half cap
- **THEN** half and full MUST be the same height, and a drag or flick upward from that height MUST NOT move it further

#### Scenario: Drag inside the body does not fight the scroller

- **WHEN** the user drags downward with the pointer starting inside the sheet body
- **THEN** the gesture MUST move the sheet unless the sheet is at full **and** the body is scrolled away from its top, in which case the body MUST scroll instead

#### Scenario: Back closes the open sheet

- **WHEN** the persistent sheet is above peek, or a transient sheet is shown, and the user presses the phone's back button
- **THEN** the topmost such sheet MUST close and the application MUST remain on the page

#### Scenario: Closing by other means leaves history clean

- **WHEN** the user opens a sheet and closes it with its head, a drag or a map tap
- **THEN** the history entry added when it opened MUST be consumed, so the next back action leaves the page as it would have without the sheet

#### Scenario: Sheet does not appear on desktop

- **WHEN** the viewport is wider than the mobile breakpoint
- **THEN** consumers of the bottom-sheet primitive MUST render their content in the desktop surfaces defined by `map-chrome`, not as a sheet

#### Scenario: Snap animation respects reduced motion

- **WHEN** the user has `prefers-reduced-motion: reduce` set and moves the sheet between snap points
- **THEN** the sheet MUST arrive at the new snap point without an animated transition, and MUST remain fully operable

## ADDED Requirements

### Requirement: The map gets sheets out of the way

On viewports at or below the mobile breakpoint, turning to the map SHALL clear the sheets above it. A pan or zoom gesture by the user (not a programmatic camera move), or a tap on the map, SHALL lower the persistent sheet to peek without changing its segment. A pan or zoom, or a tap that opens no feature, SHALL lower the Explore results sheet to peek and SHALL close an open line or stop sheet.

#### Scenario: Panning lowers the layers sheet

- **WHEN** the persistent sheet is at half or full and the user drags the visible part of the map
- **THEN** the sheet MUST lower to peek and keep its current segment

#### Scenario: Tapping empty map closes line details

- **WHEN** a line's sheet is open and the user taps the map where no feature is
- **THEN** the line's sheet MUST close

#### Scenario: Tapping another line replaces the details

- **WHEN** a line's sheet is open and the user taps another line
- **THEN** the sheet MUST show the tapped line rather than close

#### Scenario: A programmatic move does not lower a sheet

- **WHEN** the application frames a feature (a search result, a highlighted route) while a sheet is open
- **THEN** that camera move alone MUST NOT lower or close the sheet
