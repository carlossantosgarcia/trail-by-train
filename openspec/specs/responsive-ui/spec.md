# responsive-ui Specification

## Purpose
How the app adapts to phones and narrow screens: one breakpoint, a map-first layout, the bottom sheet, touch targets and accessible labels.
## Requirements
### Requirement: Shared mobile breakpoint token

The application SHALL define a single mobile breakpoint that all responsive CSS modules consume so the boundary between mobile and desktop layouts is consistent across the app. It SHALL likewise define the geometry of its chrome — gutter, dock width and sheet snap heights — as custom properties in the same token layer, so that layout values are never duplicated between a component and the map's own padding calculations.

#### Scenario: Single breakpoint definition

- **WHEN** a developer needs to apply mobile-specific styles in any component CSS module
- **THEN** the breakpoint value MUST be sourced from a single shared definition (`--bp-mobile: 768px`) and component-local `@media (max-width: 768px)` queries MUST use that same value, with no other breakpoints introduced ad-hoc

#### Scenario: Snap heights are tokens

- **WHEN** the sheet's peek, half, and full heights are needed by the sheet itself, by the map's padding calculation, or by the mobile offsets of the scale bar and zoom readout
- **THEN** all of them MUST read the same custom properties, so a change to a snap height propagates without hand-editing offsets

### Requirement: Map-dominant mobile layout

On viewports at or below the mobile breakpoint, the map canvas SHALL remain the dominant surface and UI chrome SHALL NOT collectively cover more than ~15% of the visible area in its default (collapsed) state.

On viewports wider than the mobile breakpoint, the top-left chrome SHALL compose into the single Tracks dock defined by the `map-chrome` capability rather than into independently-positioned floating elements.

#### Scenario: Collapsed chrome on mobile

- **WHEN** the application loads on a viewport ≤ 768px wide with all overlays at their default state
- **THEN** the visible area covered by persistent UI chrome (the sheet at its peek snap point, base layer pill, zoom readout) MUST not exceed ~15% of the viewport, leaving the remainder of the screen for the map

#### Scenario: Desktop top-left chrome is one surface

- **WHEN** the viewport is wider than 768px
- **THEN** the GPX open action, the Explore entry and the track list MUST render inside the Tracks dock defined by `map-chrome`, with the controls panel on the right and the zoom readout and scale bar remaining as display-only marginalia in the bottom-left gutter

### Requirement: Bottom-sheet primitive for collapsible mobile surfaces

The application SHALL provide a reusable bottom-sheet UI primitive that hosts collapsible mobile content, and every mobile sheet in the application SHALL be built from it — no component may implement its own.

The sheet SHALL support three snap points: **peek** (handle only), **half** (≈46% of viewport height), and **full** (≈88% of viewport height). The user SHALL be able to move between snap points by dragging the sheet or tapping its handle.

#### Scenario: Drag between snap points

- **WHEN** the user drags the sheet upward from its peek state
- **THEN** the sheet MUST follow the pointer and, on release, settle at the nearest snap point — or, if the release velocity exceeds the flick threshold, at the next snap point in the direction of travel

#### Scenario: Tap handle to cycle

- **WHEN** the sheet is at peek and the user taps its handle
- **THEN** the sheet MUST move to half; tapping the handle again from half or full MUST return it to peek

#### Scenario: Drag inside the body does not fight the scroller

- **WHEN** the user drags downward with the pointer starting inside the sheet body
- **THEN** the gesture MUST move the sheet unless the sheet is at full **and** the body is scrolled away from its top, in which case the body MUST scroll instead

#### Scenario: Tap outside collapses

- **WHEN** the sheet is at half or full and the user taps the map area above it
- **THEN** the sheet MUST return to its peek state

#### Scenario: Sheet does not appear on desktop

- **WHEN** the viewport is wider than the mobile breakpoint
- **THEN** consumers of the bottom-sheet primitive MUST render their content in the desktop surfaces defined by `map-chrome`, not as a sheet

#### Scenario: Snap animation respects reduced motion

- **WHEN** the user has `prefers-reduced-motion: reduce` set and moves the sheet between snap points
- **THEN** the sheet MUST arrive at the new snap point without an animated transition, and MUST remain fully operable

### Requirement: Touch-target minimum on mobile

All interactive controls (toggle buttons, day picker chips, color swatches, sheet handles) SHALL meet a minimum 44 × 44 CSS-pixel touch target on viewports ≤ 768px wide.

#### Scenario: Day picker chip is large enough to tap

- **WHEN** the user views the day picker on a mobile viewport
- **THEN** each day chip's hit area MUST be at least 44×44 CSS pixels, even if its visual padding is tighter

#### Scenario: Color swatch is large enough to tap

- **WHEN** the user views a color picker on a mobile viewport
- **THEN** each color swatch's hit area MUST be at least 44×44 CSS pixels

### Requirement: Accessible labelling preserved when labels are hidden

Where a control hides its text label on mobile in favour of an icon-only compact form, the control SHALL retain an accessible name via `aria-label` or visually hidden text so screen readers continue to announce it.

#### Scenario: Base layer switcher icon-only on mobile

- **WHEN** the base layer switcher is rendered in its compact mobile variant with the text label hidden
- **THEN** the control MUST expose an `aria-label` or equivalent describing the current basemap (e.g. "Basemap: Plan IGN")

### Requirement: Bounded desktop controls panel width

On viewports wider than the mobile breakpoint, the controls panel SHALL render with a bounded width sourced from the `--dock-w` custom property (default 264px), which SHALL also bound the Tracks dock so the two surfaces are visually symmetric. The bound SHALL apply to the panel as a whole, so that the bus section's pill row wraps inside it rather than stretching it horizontally. On viewports at or below the mobile breakpoint, the layer controls SHALL fill the sheet width and SHALL NOT inherit this bound.

#### Scenario: Panel stays narrow with many bus pills

- **WHEN** the user has six bus providers selected on desktop
- **THEN** the controls panel SHALL stay within `--dock-w` and the pill row SHALL wrap onto additional lines instead of widening the panel

#### Scenario: Mobile sheet is unaffected

- **WHEN** the layer controls are rendered inside the mobile sheet's layers segment
- **THEN** they SHALL fill the sheet width and SHALL ignore `--dock-w`

#### Scenario: Custom property is the single source of truth

- **WHEN** a developer adjusts the desktop dock width
- **THEN** the change SHALL be made by updating the `--dock-w` custom property and SHALL take effect for both docks and for the map's fit padding, with no other ad-hoc width rules introduced

### Requirement: Scrollable controls panel when content exceeds viewport height

On viewports wider than the mobile breakpoint, the controls panel SHALL bound its own height to the viewport (allowing for a small margin) and SHALL scroll its body when the cumulative content height exceeds that bound. The panel chrome (background, border-radius, shadow) SHALL remain fully visible; only the inner body SHALL scroll.

#### Scenario: Tall panel scrolls instead of overflowing the viewport

- **WHEN** the user has every overlay section expanded with many bus providers selected on desktop and the cumulative body height exceeds the viewport height
- **THEN** the panel SHALL stay within the viewport bounds and the body SHALL be vertically scrollable, while the panel's outer chrome SHALL remain fully visible

#### Scenario: Short panel does not show a scrollbar

- **WHEN** the panel body fits within the viewport
- **THEN** no scrollbar SHALL be rendered on the body

### Requirement: Map attribution rendered as a compact info control

The MapLibre attribution control SHALL render in its compact ⓘ form on every viewport (desktop and mobile), so that copyright text does not occupy the bottom edge of the map. The full attribution SHALL remain accessible by activating the ⓘ button.

#### Scenario: Attribution renders as an ⓘ button at first paint

- **WHEN** the user opens the application on any viewport
- **THEN** the MapLibre attribution control SHALL render as a compact ⓘ pill, not as inline text along the bottom of the map

#### Scenario: Activating the ⓘ button reveals the full attribution

- **WHEN** the user clicks or hovers the ⓘ button
- **THEN** the full attribution text (basemap + every enabled overlay's credits) SHALL be displayed

### Requirement: Fournisseurs dropdown grows the controls panel in-flow

When the Public Buses "+ Fournisseurs ▾" provider picker menu is open, the menu SHALL render in normal document flow inside the controls panel body, so the panel's natural content height grows to include the menu. The panel SHALL continue to honor its existing viewport-bounded max-height: when the combined content (including the open menu) would exceed that bound, the panel SHALL reach its max-height and the body SHALL become vertically scrollable (per the existing "Scrollable controls panel" requirement); otherwise, no scrollbar SHALL appear and no programmatic scroll SHALL occur.

This behavior SHALL apply uniformly on desktop and on the mobile bottom sheet: both containers already scroll their body when content exceeds their bound, so the same in-flow rendering produces the desired growth on each.

#### Scenario: Opening the dropdown grows the panel height on desktop

- **WHEN** the user clicks "+ Fournisseurs ▾" in the Public Buses section on desktop and the resulting panel height (including the menu) stays within the viewport-bounded max-height
- **THEN** the panel SHALL grow to include the full menu and no scrollbar SHALL appear on the body

#### Scenario: Dropdown larger than remaining viewport falls back to panel scroll

- **WHEN** the user opens the Fournisseurs dropdown and the combined content height would exceed the panel's viewport-bounded max-height
- **THEN** the panel SHALL reach its max-height and the body SHALL become vertically scrollable so the user can reach the rest of the menu

#### Scenario: Closing the dropdown restores the prior panel height

- **WHEN** the user closes the Fournisseurs dropdown (by selecting an item, clicking outside, or pressing Escape)
- **THEN** the menu SHALL be removed from flow and the panel SHALL return to its prior height with no scroll movement triggered by the close

#### Scenario: Mobile bottom sheet grows up to its own bound

- **WHEN** the user opens the Fournisseurs dropdown on a viewport at or below the mobile breakpoint
- **THEN** the bottom sheet body SHALL grow in-flow to include the menu, bounded by the sheet's existing max-height, with the body becoming scrollable only if the combined content exceeds that bound

