## MODIFIED Requirements

### Requirement: One dock owns the top-left corner

On viewports wider than the mobile breakpoint, the search field, the tutorial's help action, the GPX open action, the Explore entry and the loaded-track list SHALL render as the contents of a single positioned surface — the **Tracks dock** — rather than as independently-positioned elements. Only the dock SHALL carry positioning; its contents SHALL flow inside it, the search results included: the result list SHALL be a flowed child of the dock rather than an absolutely-positioned popover, so that it cannot be clipped by the dock's own overflow and cannot claim the corner independently. In the action row, the help action SHALL sit immediately after the GPX open action, which follows the Explore entry, on every viewport.

The bottom-left gutter SHALL continue to carry only the zoom readout and the
MapLibre scale bar, which are display-only marginalia and not surfaces.

#### Scenario: No free-floating chrome remains in that corner

- **WHEN** the application is loaded on a viewport wider than 768px with tracks
  present
- **THEN** the search field, the help action, the GPX open action, the Explore
  entry and the track list MUST all render inside the dock, and none of them MUST declare its own
  `position`, `top`, `left` or `z-index`

#### Scenario: The help action follows Explore and the GPX action

- **WHEN** the dock's action row is rendered outside Explore mode, on desktop
  or mobile
- **THEN** the help action MUST be the last element of the row, directly
  after the GPX open action, itself after the Explore entry

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

- **WHEN** Explore mode is active — which hides the search field, the help
  action and the file action, and the Explore entry hides itself — and no GPX
  track is loaded
- **THEN** the dock MUST NOT render, rather than showing an empty bordered
  surface
