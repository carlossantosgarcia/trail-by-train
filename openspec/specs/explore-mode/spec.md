# explore-mode Specification

## Purpose

Explore mode answers the arrival question — "I'm going *to this area*, what
serves it?" — by letting the user draw a freehand region on the map and seeing
exactly the public transport and curated hikes that serve it, rather than
stacking every overlay at once.

## Requirements

### Requirement: Enter and exit Explore mode

The application SHALL expose a floating map button labelled **"Explorer une
zone"** that enters a modal Explore mode. Entering the mode SHALL hide the normal
overlay controls and clear the map's overlays to a neutral base, and SHALL
present a prompt to draw an area with a way to cancel. The mode SHALL be
ephemeral: no drawn region or mode state is persisted, and reloading the app
returns to the normal map. On exit, the application SHALL restore the section
and overlay visibility exactly as it was before the mode was entered.

#### Scenario: Entering the mode

- **WHEN** the user taps the "Explorer une zone" button
- **THEN** Explore mode MUST become active
- **AND** the normal Layers controls MUST be hidden and the map's overlays cleared
- **AND** a prompt to draw an area MUST be shown together with a cancel/close
  control

#### Scenario: Exiting restores the previous view

- **WHEN** the user exits Explore mode
- **THEN** the map and controls MUST return to exactly the section/overlay
  visibility that was active before entering the mode
- **AND** no Explore state MUST be persisted across a page reload

### Requirement: Draw a region with a freehand lasso

The application SHALL let the user draw a search region as a single freehand
lasso. Drawing SHALL be armed explicitly (a "Dessiner" action); while a stroke
is in progress the map's pan and zoom SHALL be suspended so the drag traces the
boundary rather than panning. Releasing the stroke SHALL close the loop into a
polygon and simplify the captured points. The region SHALL be replaceable via a
"Redessiner" action, and there SHALL be no per-vertex editing. A too-small or
otherwise degenerate stroke SHALL be rejected with a prompt to draw a larger
area rather than producing a result.

#### Scenario: Tracing and closing a lasso

- **WHEN** the user arms drawing and drags one continuous stroke on the map
- **THEN** the map MUST NOT pan or zoom during the stroke
- **AND** on release the stroke MUST be closed into a simplified polygon and used
  as the search region

#### Scenario: Degenerate stroke rejected

- **WHEN** the user releases a stroke that is too small or self-intersecting to
  form a usable area
- **THEN** no results MUST be produced
- **AND** the user MUST be prompted to draw a larger area

#### Scenario: Extra fingers do not corrupt the stroke

- **WHEN** a second finger touches the screen while a stroke is in progress
- **THEN** only the first pointer's path MUST contribute to the boundary
- **AND** the second finger MUST NOT inject a jagged / sawtooth artefact into
  the traced outline

#### Scenario: Redraw replaces the region

- **WHEN** a region exists and the user chooses "Redessiner"
- **THEN** the existing region and its results MUST be discarded
- **AND** drawing MUST be re-armed for a new stroke

### Requirement: Buses matched by stops inside the region

When a region is drawn, the application SHALL determine the buses that serve it
by testing which transit stops fall inside the polygon, across **all** transit
providers regardless of the current provider toggles, and regardless of the day
and low-frequency filters. A line SHALL be considered matched when at least one
of its stops is inside the region. The map SHALL then display **only** the
matched bus lines — no stops, no rail lines, no base overlays, and no hikes.

Each matched line SHALL be drawn in a **distinct colour** assigned from a fixed
categorical palette (Carto Bold), rather than in its provider's colour, so that
overlapping same-provider lines can be told apart. Each matched line SHALL also
be labelled with its **route number** (`route_short_name`) repeated along the
line so a single line can be traced where several overlap. The route number's
text colour SHALL be chosen from the line's own pill colour so that the number
stays legible on every palette colour: a dark text colour on light pills and a
light text colour on dark pills. When a region matches more lines than the
palette has colours, colours MAY repeat; the repeated number and the isolate
interaction disambiguate them.

#### Scenario: Only matched bus lines on the map

- **WHEN** a region enclosing at least one bus stop is closed
- **THEN** every line served by an in-region stop MUST be shown on the map
- **AND** all other bus lines, all stops, rail lines, and hike lines MUST be
  hidden

#### Scenario: Distinct colours and numbers over a dimmed basemap

- **WHEN** the matched bus lines are shown
- **THEN** the basemap MUST be dimmed and each matched line MUST be drawn in a
  distinct palette colour with its route number repeated along it
- **AND** exiting the mode MUST restore the basemap and the normal per-provider
  line styling

#### Scenario: Route number stays legible on a dark line colour

- **WHEN** a matched line is assigned a dark palette colour
- **THEN** its repeated route number MUST be rendered in a light text colour so
  it remains readable against the dark pill
- **AND** a matched line assigned a light palette colour MUST render its route
  number in a dark text colour

#### Scenario: Search ignores current toggles and filters

- **WHEN** a region is drawn while some providers are toggled off or a day /
  low-frequency filter is active
- **THEN** the match MUST still consider all providers and all services
- **AND** a line whose provider was toggled off MUST still appear if it has a
  stop inside the region

### Requirement: Result panel lists buses, rail stations, and curated hikes

While a region's results are shown, the application SHALL present a result panel
(a bottom sheet on mobile) with three groups. The **Bus** group SHALL list the
matched lines grouped by provider; each line chip SHALL be coloured to match that
line's colour on the map, and tapping a line SHALL highlight it on the map in its
own colour. The **Trains** group SHALL list the rail stations whose point falls inside
the region, showing the station name only, and tapping a station SHALL move the
map to it; rail stations SHALL have no other on-map presence in this mode. The
**Randonnées** group SHALL list curated hikes that cross the region — a curated
hike matches when any of its track vertices is inside the polygon — by title;
GR trails SHALL be excluded. Tapping a hike SHALL draw that hike's route on the
map (without opening the info box). Clicking the route on the map SHALL open the
hike's usual information box, and closing that box SHALL leave the route drawn.

#### Scenario: Three result groups

- **WHEN** a region contains bus stops, a rail station, and a curated hike
- **THEN** the panel MUST list the matched bus lines grouped by provider, the
  in-region rail station by name, and the crossing curated hike by title

#### Scenario: Panel chip colour matches the map line

- **WHEN** results are shown
- **THEN** each Bus line chip MUST use the same colour as that line on the map

#### Scenario: Tapping a matched line highlights it

- **WHEN** the user taps a line in the Bus group
- **THEN** that line MUST be highlighted on the map

#### Scenario: Rail stations are list-only

- **WHEN** results are shown
- **THEN** rail stations MUST appear only in the Trains group and MUST NOT be
  rendered on the map
- **AND** tapping a station MUST move the map to that station

#### Scenario: GR trails excluded from hikes

- **WHEN** a GR trail crosses the region but no curated hike does
- **THEN** the Randonnées group MUST be empty

#### Scenario: Selecting a hike draws its track

- **WHEN** the user taps a hike in the Randonnées group
- **THEN** that hike's route MUST be drawn on the map and framed
- **AND** the info box MUST NOT open until the user clicks the route

#### Scenario: Info box does not remove the track

- **WHEN** the user clicks the drawn route to open its info box and then closes
  the box
- **THEN** the info box MUST close
- **AND** the hike's route MUST remain drawn on the map

### Requirement: Empty result state

The application SHALL show an empty-result state when a drawn region contains no
matching buses, rail stations, or curated hikes. The empty state SHALL keep the
drawn region visible and offer to redraw, rather than showing an all-hidden map
with no explanation.

#### Scenario: Nothing serves the region

- **WHEN** a valid region is closed but nothing matches inside it
- **THEN** an empty-state message MUST be shown
- **AND** the drawn region MUST remain visible with a "Redessiner" action offered

### Requirement: Basemap switcher in Explore mode

The application SHALL provide a compact basemap switcher while Explore mode is
active, so the user can change the underlying map without leaving the mode. The
switcher SHALL be visually smaller than the app's main basemap switcher
(icon-only, no labels).

#### Scenario: Switching the basemap while exploring

- **WHEN** the user taps a basemap option in the Explore switcher
- **THEN** the map's base layer MUST change to the chosen basemap
- **AND** the current region and results MUST remain unchanged

### Requirement: Optional railway overlay in Explore mode

The application SHALL provide a toggle in the Explore chrome to overlay the
railway network — its lines **and** its stations (gares) — on top of the matched
bus lines, so the user can check rail connectivity for the region. The overlay
SHALL default **on**: entering Explore mode SHALL arm the toggle so that the
railway network and the gares are already drawn when a region's results first
appear, with no extra tap. The user SHALL be able to turn the overlay off for a
bus-only view; that choice SHALL hold for the rest of the session and SHALL NOT
carry over — re-entering Explore mode SHALL return the toggle to its default on
state. The overlay SHALL be removed when Explore mode is exited.

#### Scenario: Railway overlay is on when results first appear

- **WHEN** the user enters Explore mode and closes a region without touching the
  railway toggle
- **THEN** the railway-network lines and the gares MUST be drawn over the matched
  bus lines as soon as the results are shown
- **AND** the toggle MUST render in its active state

#### Scenario: Toggling the railway overlay off and back on

- **WHEN** the user disables the railway toggle while results are shown
- **THEN** the railway-network lines and the gares MUST be removed from the map
- **AND** re-enabling the toggle MUST draw them again over the matched bus lines

#### Scenario: The default is restored on re-entry

- **WHEN** the user turns the railway overlay off, exits Explore mode, and enters
  it again
- **THEN** the railway overlay MUST be back on for the new session

#### Scenario: Exiting removes the overlay

- **WHEN** the user exits Explore mode with the railway overlay shown
- **THEN** the railway lines and gares MUST return to the visibility the app's
  normal Layers controls had before the mode was entered

### Requirement: Define a region as a point plus a radius

Explore mode SHALL accept a second way to define its search region: a centre
point with a chosen radius, producing a circular ring. This region SHALL be
matched by the same engine as a drawn one — a circle is a polygon ring, and the
bus, gare and hike matching rules are unchanged.

While the radius is being chosen, the mode SHALL be in a distinct phase in which
the map pans and zooms normally: the freehand lasso capture SHALL NOT be armed,
because the user is framing a distance rather than drawing.

The radius SHALL be adjustable with a slider, SHALL be labelled in kilometres,
and SHALL default to a value usable for a day's outing from the centre. The
circle SHALL be drawn on the map as the slider moves, so the chosen distance is
seen before it is committed.

Computing the results SHALL be an explicit action, not a consequence of moving
the slider, so a drag across the range does not fire a matching pass per step.

#### Scenario: Choosing a radius previews a circle

- **WHEN** the radius panel is open and the user moves the slider
- **THEN** a circle of the new radius MUST be drawn on the map around the centre
- **AND** the panel MUST show the radius in kilometres
- **AND** no matching pass MUST be run

#### Scenario: The map stays interactive while choosing

- **WHEN** the radius panel is open
- **THEN** dragging the map MUST pan it rather than trace a lasso stroke

#### Scenario: Confirming runs the normal match

- **WHEN** the user confirms the chosen radius
- **THEN** Explore MUST match that circular region and present the same result
  panel — buses, gares and curated hikes — that a drawn region produces

#### Scenario: Returning from results goes back to the radius

- **WHEN** the user asks to change the region after results computed from a
  point-seeded circle
- **THEN** the radius panel MUST reopen with the same centre, rather than the
  freehand draw prompt

#### Scenario: A drawn region is unaffected

- **WHEN** the user enters Explore mode from the Explore action rather than from
  a search result
- **THEN** the mode MUST begin in the freehand drawing phase exactly as before,
  and asking to change the region MUST return to the draw prompt

#### Scenario: Exiting clears the centre

- **WHEN** the user exits Explore mode from a point-seeded session
- **THEN** the centre, radius and circle MUST be discarded, and the next entry
  into Explore MUST NOT be pre-seeded with them
