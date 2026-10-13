## ADDED Requirements

### Requirement: The network list grows the controls panel in-flow

When the Bus section's network list is open, it SHALL render in normal document flow inside the controls panel body, so the panel's natural content height grows to include it. The panel SHALL continue to honor its existing viewport-bounded max-height: when the combined content (including the open list) would exceed that bound, the panel SHALL reach its max-height and the body SHALL become vertically scrollable (per "Scrollable controls panel when content exceeds viewport height"); otherwise, no scrollbar SHALL appear and no programmatic scroll SHALL occur.

This behavior SHALL apply uniformly on desktop and on the mobile bottom sheet.

#### Scenario: Opening the list grows the panel height on desktop

- **WHEN** the user opens the network summary on desktop and the resulting panel height stays within the viewport-bounded max-height
- **THEN** the panel SHALL grow to include the full list and no scrollbar SHALL appear on the body

#### Scenario: List larger than remaining viewport falls back to panel scroll

- **WHEN** the combined content height would exceed the panel's viewport-bounded max-height
- **THEN** the panel SHALL reach its max-height and the body SHALL become vertically scrollable

#### Scenario: Mobile bottom sheet grows up to its own bound

- **WHEN** the user opens the network list on a viewport at or below the mobile breakpoint
- **THEN** the bottom sheet body SHALL grow in-flow to include the list, bounded by the sheet's max-height

## REMOVED Requirements

### Requirement: Fournisseurs dropdown grows the controls panel in-flow

**Reason**: The "+ Fournisseurs ▾" picker is replaced by the network list.
**Migration**: See "The network list grows the controls panel in-flow".
