## MODIFIED Requirements

### Requirement: Curated-hike click popup with metrics and source link

The application SHALL open an informational popup when the user clicks a
curated hike's pin or endpoint marker. The popup SHALL show an editor
badge for the hike's `source`, the title, the duration in days, the same
effort/summary metrics displayed for user-loaded GPX tracks (computed from
the manifest's `summary`), a per-day breakdown for multi-day hikes, and a
link that opens the author's page in a new tab.

Each effort metric on the popup (effort km, Naismith time) SHALL carry a "?"
button after its name, operable by mouse, touch and keyboard, that opens the
same explanation as the GPX profile's metric chips: definition, formula, the
values used for this hike, reference and limitations.

#### Scenario: Click opens popup with metrics and source link
- **WHEN** the user clicks a visible curated pin or endpoint marker
- **THEN** a popup MUST appear at the click point with the source badge,
  title, metric strip (distance, ascent, descent, estimated duration,
  effort) and a link labelled to identify the author's site

#### Scenario: Multi-day popup lists each day
- **WHEN** the clicked hike has `days.length > 1`
- **THEN** the popup MUST list one row per day with distance, ascent,
  descent, and the night's stop name when known (otherwise
  "Étape J<n> → J<n+1>")

#### Scenario: Clicking empty map or pressing Escape dismisses the popup
- **WHEN** a popup is open and the user clicks elsewhere on the map or
  presses Escape
- **THEN** the popup MUST close and no curated hike MUST remain selected

#### Scenario: Mobile renders a bottom sheet
- **WHEN** the viewport is ≤ 768px wide and the user taps a curated marker
- **THEN** the popup content MUST render as a transient bottom sheet
  instead of a map-anchored card, opening at half height so the hike stays
  visible above it, able to be raised to full height, and dismissible by
  swiping it down, the close affordance, or Escape

#### Scenario: A metric's "?" explains it
- **WHEN** the user clicks or taps the "?" after a metric's name on the popup,
  on desktop or in the mobile sheet
- **THEN** the metric's explanation MUST open with this hike's distance,
  ascent and result as its values: beside the desktop card when the window
  has room for it, otherwise over the card or sheet, within the viewport and
  scrolling inside when taller; and closing it (its close button, a click or
  tap elsewhere, or Escape) MUST leave the popup open

#### Scenario: Scrolling the explanation leaves the sheet in place
- **WHEN** the explanation is open over the mobile sheet and the user drags
  inside it
- **THEN** the explanation MUST scroll, if it has more to show, and the sheet
  MUST NOT move

