## MODIFIED Requirements

### Requirement: Buses matched by stops inside the region

When a region is drawn, the application SHALL determine the buses that serve it
by testing which transit stops fall inside the polygon, across **all** transit
providers regardless of the current provider toggles, and regardless of the
weekend filter. A line SHALL be considered matched when at least one
of its stops is inside the region. The map SHALL then display **only** the
matched bus lines, and their stops from zoom 12 — no other stops, no base
overlays, and no hikes — plus the railway overlay while it is on (see
"Optional railway overlay in Explore mode"). A matched line that is focused
SHALL show its stops as on the normal map (see `public-transit`).

Each matched line SHALL be drawn in a **distinct colour** assigned from a fixed
categorical palette (Carto Bold), rather than in its provider's colour, so that
overlapping same-provider lines can be told apart. Each matched line SHALL also
be labelled with its **route number** (`route_short_name`) on a pill of its
colour, repeated along the line from zoom 8, so a single line can be traced
where several overlap. The route number's
text colour SHALL be chosen from the line's own pill colour so that the number
stays legible on every palette colour: a dark text colour on light pills and a
light text colour on dark pills. When a region matches more lines than the
palette has colours, colours MAY repeat; the repeated number and the isolate
interaction disambiguate them.

#### Scenario: Only matched bus lines on the map

- **WHEN** a region enclosing at least one bus stop is closed
- **THEN** every line served by an in-region stop MUST be shown on the map
- **AND** all other bus lines, the stops of other lines and all hike lines
  MUST be hidden

#### Scenario: Matched lines' stops at street zoom

- **WHEN** the user zooms to 12 or closer with results shown
- **THEN** the stops of the matched lines MUST be drawn, and no other stops

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

- **WHEN** a region is drawn while some providers are toggled off or the
  weekend filter is active
- **THEN** the match MUST still consider all providers and all services
- **AND** a line whose provider was toggled off MUST still appear if it has a
  stop inside the region

### Requirement: Result panel lists buses, rail stations, and curated hikes

While a region's results are shown, the application SHALL present a result panel
(a bottom sheet on mobile) with three groups. The **Bus** group SHALL list the
matched lines grouped by provider; each line chip SHALL be filled with that line's
colour on the map. A first tap on a line SHALL focus it on the map in its own
colour and frame it, and mark its chip as pressed; a second tap on the focused
line SHALL open its card. The **Trains** group SHALL list the rail stations whose point falls inside
the region, showing the station name only, and tapping a station SHALL move the
map to it; rail stations SHALL have no other on-map presence in this mode. The
**Randonnées** group SHALL list, by title, the curated hikes that start, end or
spend a night inside the region (see `curated-hikes`);
GR trails SHALL be excluded. Tapping a hike SHALL draw that hike's route on the
map (without opening the info box). Clicking the route on the map SHALL open the
hike's usual information box, and closing that box SHALL leave the route drawn.

#### Scenario: Three result groups

- **WHEN** a region contains bus stops, a rail station, and a curated hike's start
- **THEN** the panel MUST list the matched bus lines grouped by provider, the
  in-region rail station by name, and the curated hike by title

#### Scenario: Panel chip colour matches the map line

- **WHEN** results are shown
- **THEN** each Bus line chip MUST use the same colour as that line on the map

#### Scenario: Tapping a matched line focuses it

- **WHEN** the user taps a line in the Bus group
- **THEN** that line MUST be focused and framed on the map, and its chip
  marked as pressed

#### Scenario: A second tap opens the card

- **WHEN** the user taps the chip of the line already focused
- **THEN** that line's card MUST open

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
