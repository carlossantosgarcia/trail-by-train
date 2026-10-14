## MODIFIED Requirements

### Requirement: Bottom-sheet primitive for collapsible mobile surfaces

The application SHALL provide a reusable bottom-sheet UI primitive that hosts collapsible mobile content, and every mobile sheet in the application SHALL be built from it — no component may implement its own.

The sheet SHALL support three snap points: **peek** (head only), **half** and **full**. Half and full SHALL be caps rather than fixed heights: half is the smaller of ≈46% of the viewport height and the sheet's content height (head plus body content), full the smaller of ≈88% of the viewport height and the content height. A sheet SHALL therefore never be taller than its content, and when its content fits under the half cap, half and full SHALL be the same single open height. When its content exceeds the half cap by at most 30 % of that cap (and fits under full), half SHALL be raised to the content height, so the sheet opens whole and half and full are one height. The user SHALL be able to move between snap points by dragging the sheet or tapping its head.

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

#### Scenario: Content just taller than half opens whole

- **WHEN** a sheet's content needs 52% of the viewport and the sheet opens at half
- **THEN** it MUST open at 52%, with none of its content below the screen's edge, and a drag upward MUST NOT move it further

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

### Requirement: Map popups stay in the visible part of the map

On viewports wider than the mobile breakpoint, the bus line, stop and hike popups SHALL be placed against the part of the map not covered by the side docks and, when shown, the elevation dock: above the point when the popup fits there, otherwise below it when it fits there, otherwise on the side with more room, and shifted left or right when centring it would cross a side dock. The placement SHALL be re-evaluated on every map move and whenever the popup's content changes size.

#### Scenario: A point near the top with a track loaded

- **WHEN** the user clicks a line near the top of the map while the elevation dock is shown, and the popup does not fit above the point
- **THEN** the popup MUST open below the point only if it fits above the dock, and otherwise above the point

#### Scenario: Zooming flips the popup without a hidden phase

- **WHEN** the user zooms and the point moves until the popup fits above it
- **THEN** the popup MUST move above the point, and at no zoom step MUST part of it lie under the elevation dock while the other side had room
