# curated-hikes Specification

## Purpose
Surface hikes worth taking — shared by the people who walked them or by
hiking authors who agreed to it — on the map: where each starts, ends and
spends its nights, the facts a planner needs, the route itself when its
author licensed it, and a credit and link to its author.

## Requirements
### Requirement: Hikes credit their author; routes ship only when licensed

Every hike SHALL credit its author through its `source` badge and, when the
author has a page for it, a `sourceUrl` link. A hike's route SHALL ship
(`track`: a GPX under `public/curated/tracks/` with its licence) only when
its author agreed to publish it; community hikes are published under
CC-BY 4.0.

#### Scenario: A licensed route is drawn and downloadable
- **WHEN** the overlay is on and a hike carries `track`
- **THEN** its route MUST be drawn in the hike's colour beneath the curated
  markers, be clickable like the hike's pin, and the popup MUST offer the
  GPX for download with its licence

#### Scenario: A hike without a licensed route
- **WHEN** a hike carries no `track`
- **THEN** it MUST still show as markers with its popup, linking to the
  author's page for the route

### Requirement: Curated hikes overlay toggle

The application SHALL expose a toggle in the overlay-toggle group that
controls visibility of the curated-hikes layer. The toggle's on/off state
SHALL persist across reloads in `localStorage`, mirroring the rail-network
toggle's behaviour.

#### Scenario: Toggle on shows the curated layer
- **WHEN** the user turns the curated-hikes toggle on
- **THEN** the application MUST load the manifest (if not already
  cached), render every hike whose `durationDays` falls within the active
  filter range as markers on the map, mount the duration filter slider,
  and update the toggle's pressed state

#### Scenario: Toggle off hides the layer and slider
- **WHEN** the user turns the toggle off
- **THEN** the application MUST hide every curated marker, unmount the
  duration filter slider, clear any selected-hike popup, and update the
  toggle's pressed state

#### Scenario: Toggle state persists across reloads
- **WHEN** the user toggles the overlay on and reloads the page
- **THEN** the overlay MUST appear in the same state as before, with no
  visible on→off or off→on flash during initial mount

#### Scenario: An empty manifest is valid
- **WHEN** the manifest contains no hikes
- **THEN** the toggle MUST still work and the overlay MUST render nothing,
  without errors

### Requirement: Curated hikes render as markers

Each curated hike SHALL render as a coloured start pin below
`ENDPOINTS_MIN_ZOOM`, and from that zoom as "A"/"B" endpoint markers (a
single "A/B" when start and end are within the loop threshold) sharing
the visual style of uploaded-GPX endpoint markers, coloured with the
hike's `colour`. All curated markers SHALL be drawn below user-loaded GPX
tracks. Pins and endpoint markers SHALL be clickable.

#### Scenario: Low zoom shows one pin per hike
- **WHEN** the overlay is on and the map zoom is below `ENDPOINTS_MIN_ZOOM`
- **THEN** each visible hike MUST show exactly one pin at its `start`

#### Scenario: Zoomed in shows A and B
- **WHEN** the map zoom reaches `ENDPOINTS_MIN_ZOOM`
- **THEN** each visible hike MUST show an "A" at `start` and a "B" at
  `end`, or one "A/B" for a loop, and no pin

#### Scenario: User GPX stays on top
- **WHEN** the overlay is on and a user GPX track is loaded
- **THEN** the user's track MUST render above every curated marker

### Requirement: Curated-hike click popup with metrics and source link

The application SHALL open an informational popup when the user clicks a
curated hike's pin or endpoint marker. The popup SHALL show an editor
badge for the hike's `source`, the title, the duration in days, the same
effort/summary metrics displayed for user-loaded GPX tracks (computed from
the manifest's `summary`), a per-day breakdown for multi-day hikes, and a
link that opens the author's page in a new tab.

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
  instead of a map-anchored card, dismissible by tapping outside, the
  close affordance, or Escape

### Requirement: Sleep markers for multi-day hikes

The application SHALL render a sleep marker at each night's `sleep.coord`
for hikes whose days carry one, visible from zoom 9 while the overlay is
on, and hidden by the same duration filter as the hike's other markers.

#### Scenario: Hovering a sleep marker names the night
- **WHEN** the user hovers a sleep marker
- **THEN** a tooltip MUST show the stop's `name`, falling back to
  "Étape J<n> → J<n+1>" when the name is unknown

#### Scenario: Filtered-out hike leaves no orphan marker
- **WHEN** the duration filter hides a multi-day hike
- **THEN** its sleep markers MUST disappear in the same render as its
  pin and endpoints

### Requirement: Duration filter slider, visible only with the overlay

The application SHALL render a dual-handle range slider that filters
curated hikes by `durationDays`, mounted only while the overlay is on,
with range `[1, max(durationDays)]` and integer-day steps.

#### Scenario: Slider gates visible hikes
- **WHEN** the user drags either handle to a new `[min, max]`
- **THEN** every hike whose `durationDays` is within `[min, max]`
  (inclusive) MUST show its markers and every other hike MUST be hidden

#### Scenario: Slider state is transient
- **WHEN** the user adjusts the slider and then toggles the overlay off
  and on, or reloads the page
- **THEN** the slider MUST re-mount at its full default range

#### Scenario: Slider keyboard accessibility
- **WHEN** the user focuses a handle and presses Arrow Left or Arrow Right
- **THEN** the handle MUST move by one day without crossing the other

### Requirement: Explore matches curated hikes by their places

Explore's region search SHALL include a curated hike when its start, its
end, or any of its nights falls inside the drawn region.

#### Scenario: Hike starting inside the region is listed
- **WHEN** the user draws a region containing a hike's `start` but not
  its `end`
- **THEN** that hike MUST appear in Explore's hike results
