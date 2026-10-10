# Map Viewer

## Purpose

The core interactive map surface for the application. Renders a
full-viewport MapLibre GL map of mainland France, exposes a set of
switchable basemap layers sourced from IGN's Géoplateforme, and provides
the attribution and layer-control UI needed to comply with IGN's terms of
use. Every overlay (GPX tracks, hikes, GR trails, trains and buses)
attaches to this map.
## Requirements
### Requirement: Full-viewport interactive map

The application SHALL render a single interactive map that occupies the full
browser viewport on initial load.

#### Scenario: Map fills the viewport on load

- **WHEN** the user opens the application in a desktop or mobile browser
- **THEN** a MapLibre GL map MUST be rendered that fills 100% of the viewport
  width and height with no surrounding header, footer, or chrome

#### Scenario: Map remains responsive on resize

- **WHEN** the browser window is resized
- **THEN** the map canvas MUST resize to continue filling the viewport
  without leaving blank space or showing scrollbars

### Requirement: Initial view of mainland France

The map SHALL open at a viewport that frames mainland France so the user
sees the area of interest without panning.

#### Scenario: Default centre and zoom

- **WHEN** the application is opened with no prior state
- **THEN** the map MUST be centred near the geographic centre of mainland
  France (approximately longitude 2.5°, latitude 46.5°) at a zoom level that
  shows the entire mainland plus Corsica within the viewport on a standard
  desktop display (zoom ≈ 5–6)

### Requirement: Pan and zoom interactions

The map SHALL support standard pan and zoom interactions using mouse,
keyboard, and touch.

#### Scenario: Mouse drag pans the map

- **WHEN** the user presses the mouse button on the map and drags
- **THEN** the map MUST pan in the direction of the drag

#### Scenario: Scroll wheel and pinch zoom

- **WHEN** the user scrolls the mouse wheel over the map or performs a pinch
  gesture on a touch device
- **THEN** the map MUST zoom in or out around the cursor / pinch centre

### Requirement: Basemap switcher control

The map SHALL expose a visually rich UI control that lets the user pick
which basemap is active. The control SHALL show, for each basemap, a
preview thumbnail alongside its label so the user can recognize the
basemap's style without activating it. Only one basemap is shown at a
time.

#### Scenario: Switcher is visible on the map

- **WHEN** the map is rendered
- **THEN** a basemap switcher control MUST be visible in the top-right of
  the map and MUST list every entry from the basemap catalogue, with each
  entry rendering a preview thumbnail image and the entry's label

#### Scenario: Selecting a basemap activates it

- **WHEN** the user selects a basemap entry from the switcher (by click,
  tap, or keyboard activation)
- **THEN** the map MUST show that basemap and hide all other basemaps
  within one render frame, without re-centering or resetting the user's
  pan/zoom

#### Scenario: Exactly one basemap visible at a time

- **WHEN** the application has finished loading
- **THEN** exactly one basemap MUST be visible: "Satellite" on every load,
  since the choice is not saved

#### Scenario: Active basemap is visually distinguished

- **WHEN** a basemap is the currently active one
- **THEN** its entry in the switcher MUST be visually distinguished from
  the inactive entries (e.g. a coloured border or ring around its
  thumbnail and emphasized label) so the active selection is unambiguous
  at a glance

#### Scenario: Thumbnails are static and bundled

- **WHEN** the production bundle is served
- **THEN** each basemap preview thumbnail MUST be served as a static
  asset from the bundle (no runtime fetch to the WMTS tile server is
  required to render the switcher) so the switcher renders fully on the
  first paint and works offline once the bundle is loaded

### Requirement: Attribution and credits

The map SHALL display attribution that credits IGN and Géoplateforme in
compliance with IGN's terms of use.

The attribution control SHALL be rendered in MapLibre's compact form, and SHALL
be **collapsed to its ⓘ button by default** — the expanded strip obscures the
bottom edge of the map. Collapsed is the default state on every fresh load, and
SHALL be restored whenever the map style is reloaded, including when the user
switches basemap.

A user who opens the control SHALL keep it open: the application SHALL NOT
collapse it again while the user has deliberately opened it. When the user closes
it, the default behaviour resumes.

Collapsing is a disclosure state only. Every credit SHALL remain present,
unaltered and reachable behind the ⓘ button, since these are licence obligations
rather than presentation choices.

#### Scenario: Attribution control visible

- **WHEN** the map is rendered
- **THEN** MapLibre's attribution control MUST be visible in the bottom-right
  of the map and MUST include the text "© IGN — Géoplateforme" (or the
  equivalent attribution string published by IGN for the active layer)

#### Scenario: Attribution updates with the active basemap

- **WHEN** the user switches to a basemap whose IGN attribution string
  differs from the current one
- **THEN** the attribution control MUST reflect the active basemap's
  attribution

#### Scenario: The control is collapsed on load

- **WHEN** the map finishes loading, with any combination of overlays enabled
- **THEN** the attribution control MUST show only its ⓘ button, and MUST NOT
  render the expanded credits strip across the bottom of the map

#### Scenario: Enabling an overlay does not expand the control

- **WHEN** the user enables overlays that contribute their own credits, such as
  selecting every bus provider
- **THEN** the control MUST remain collapsed, and the newly contributed credits
  MUST be present behind the ⓘ button

#### Scenario: A basemap switch restores the collapsed state

- **WHEN** the user switches basemap, reloading the map style
- **THEN** the control MUST return to its collapsed ⓘ state rather than
  re-expanding

#### Scenario: A user who opens the control keeps it open

- **WHEN** the user clicks the ⓘ button to read the credits, and a style reload
  follows — for example because they then switch basemap
- **THEN** the control MUST remain open, and MUST NOT be collapsed by the
  application while the user has it open

#### Scenario: Credits stay reachable

- **WHEN** the control is collapsed
- **THEN** clicking the ⓘ button MUST reveal the full attribution for every
  active source, including the IGN, ODbL and OpenTopoMap CC-BY-SA credits, with
  no string omitted or shortened relative to the expanded form

### Requirement: Static, backend-free deployment

The application SHALL build to a fully static asset bundle that runs on any
static web host with no server-side component and no runtime secrets.

#### Scenario: Production build is static

- **WHEN** the project's production build command is run
- **THEN** the output MUST be a directory of static files (HTML, JS, CSS,
  assets) that can be served by any static host (GitHub Pages, Netlify,
  Cloudflare Pages) without environment variables or a backend process

#### Scenario: No API keys in the bundle

- **WHEN** the production bundle is inspected
- **THEN** it MUST NOT contain any API key, secret, or credential for IGN,
  Géoplateforme, or any other service

### Requirement: Keyboard accessibility of the switcher

The basemap switcher SHALL be fully operable from the keyboard and
expose ARIA semantics so assistive technology can announce it as a radio
group.

#### Scenario: Radio group semantics

- **WHEN** assistive technology inspects the switcher
- **THEN** the container MUST have `role="radiogroup"` with an
  accessible name (e.g. via `aria-label="Basemap"`) and each basemap
  entry MUST expose `role="radio"` with `aria-checked` reflecting whether
  it is the active basemap

#### Scenario: Focus and arrow-key navigation

- **WHEN** the switcher receives keyboard focus
- **THEN** focus MUST land on the currently active entry, arrow keys
  (Left/Right on desktop's horizontal layout, Up/Down in the mobile
  expanded list) MUST move focus between entries, and pressing Enter or
  Space on a focused entry MUST activate that basemap

#### Scenario: Visible focus indicator

- **WHEN** a basemap entry is focused via the keyboard
- **THEN** the focused entry MUST display a visible focus indicator
  (e.g. a contrasting outline or ring) that meets WCAG 2.1 non-text
  contrast requirements against the switcher background

### Requirement: Zoom-level readout

On viewports wider than the mobile breakpoint, the application SHALL
display the current map zoom level as a large, semi-transparent number
anchored to the bottom-left of the map viewport. On a phone it SHALL NOT
be shown: the corner is too small to share with the sheet and the scale
bar, and the scale bar already tells a hiker what the zoom means. The readout SHALL update live whenever the zoom changes,
SHALL be display-only (no click target, no label), and SHALL NOT
block pointer events on the map beneath it.

#### Scenario: Readout reflects the current zoom

- **WHEN** the user zooms in or out via wheel, pinch, double-click,
  or any other gesture
- **THEN** the bottom-left readout MUST update to show the current
  zoom level rounded to one decimal place (e.g. `13.4`), within the
  same frame the map renders the new zoom

#### Scenario: Readout never blocks map interaction

- **WHEN** the user clicks or drag-pans the map at a screen position
  occupied by the readout
- **THEN** the click / drag MUST pass through to the map (the readout
  MUST have `pointer-events: none`) so the user can interact with
  features rendered underneath it

#### Scenario: Readout stays legible on every basemap

- **WHEN** the user switches between the topographic, satellite, and
  street basemaps
- **THEN** the readout MUST remain readable on each basemap — it MUST
  combine a translucent white fill with a dark contrast halo
  (text-shadow) so neither bright nor dark tiles swallow the digit
- **AND** it MUST stay legible over the topographic basemap's busiest
  areas, where dense brown contour lines, elevation labels and green
  forest fill sit directly under the digits

#### Scenario: No readout on phones

- **WHEN** the viewport is ≤ 768px wide
- **THEN** no zoom-level readout MUST be rendered, and the scale bar MUST
  remain

### Requirement: The controls panel

On desktop the layer controls SHALL be a panel at the top right holding, in
order: the basemap switcher; **Randonnée**, with the curated-hikes and GR
toggles, and the duration filter beside them while hikes are shown; **Trains**,
with its section eye, the rail-network toggle and, while the network is on, a
"Masquer les gares" / "Afficher les gares" button; and **Bus**, with its section
eye and the network count in its header (see `public-transit`). A section's
filters SHALL appear only while one of its overlays is on: the day filter,
low-frequency and archived-line toggles and the validity banner once a bus
network is selected. Where there is room, a section's toggles and its main
option SHALL share one wrapping row.

The panel SHALL fold into a small "Layers" button and back, and SHALL remember
that state across reloads.

#### Scenario: A first visit

- **WHEN** the application is opened with nothing saved
- **THEN** the panel MUST show the switcher, Randonnée, Trains and Bus, and no
  day filter, bus filters or validity banner

#### Scenario: Selecting a bus network reveals its filters

- **WHEN** the user selects a first bus network
- **THEN** the day filter, the low-frequency and archived-line toggles and the
  validity banner MUST appear in the Bus section

#### Scenario: Folding the panel

- **WHEN** the user folds the panel and reloads
- **THEN** only the "Layers" button MUST show, and it MUST reopen the panel

### Requirement: Map controls panel collapses into a bottom sheet on mobile

On viewports at or below the mobile breakpoint (768px), the map layer controls SHALL render as the **layers segment of the application's single persistent bottom sheet**, anchored to the bottom of the viewport instead of as a fixed side panel. At the sheet's peek snap point only the sheet head SHALL be visible — the drag handle, and either the segmented control or, when the layers segment is the only one, the quick toggles and the expand button (see `map-chrome`); raising the sheet SHALL reveal the same controls available on desktop.

The controls SHALL NOT implement their own sheet. They SHALL be hosted by the shared bottom-sheet primitive defined in `responsive-ui`, alongside the track list and elevation profile segments.

#### Scenario: Controls reachable from the sheet head on mobile

- **WHEN** the application is loaded on a viewport ≤ 768px wide
- **THEN** the layer controls MUST be reachable as a segment of the single persistent sheet at its peek snap point, and MUST NOT occupy the right or left side of the screen

#### Scenario: Raising the sheet reveals all controls

- **WHEN** the user raises the sheet to its half or full snap point with the layers segment current
- **THEN** the sheet MUST host the same Bus and Trains sections, overlay toggles, day picker, frequency toggle, and colour pickers that are visible on desktop

#### Scenario: Sheet does not block map interaction at peek

- **WHEN** the persistent sheet is at its peek snap point on mobile
- **THEN** the map MUST remain interactive (pan, zoom, tap features) everywhere except the sheet head's hit area

#### Scenario: Turning to the map lowers the sheet

- **WHEN** the sheet is at half or full and the user pans or taps the map above it
- **THEN** the sheet MUST lower to peek (see `responsive-ui`)

#### Scenario: Desktop renders the side panel

- **WHEN** the viewport is wider than 768px
- **THEN** the layer controls MUST render as the right-hand controls panel, carrying the basemap switcher and the overlay sections, with no sheet behaviour and no mobile rules of its own

#### Scenario: Only one persistent sheet exists

- **WHEN** the layer controls are hosted in the sheet on mobile
- **THEN** no second persistent sheet MUST be rendered by any other component, and the sheet MUST be the shared primitive rather than a per-component implementation

### Requirement: Compact base layer switcher and zoom readout on mobile

On viewports ≤ 768px, the base layer switcher SHALL render as a wrapping row of small labelled thumbnails at the top of the layers segment, and the zoom-level readout SHALL NOT render, so the map chrome takes little of the viewport while the basemap stays one tap away.

#### Scenario: Base layer switcher compact on mobile

- **WHEN** the viewport is ≤ 768px wide and the layers segment is shown
- **THEN** the basemap switcher MUST render inline as a row of thumbnails of at least 44×44 CSS pixels each, the active one marked, with no floating pill. The 768px breakpoint is the shared mobile token

#### Scenario: Zoom readout absent on mobile

- **WHEN** the viewport is ≤ 768px wide
- **THEN** the zoom-level readout MUST NOT render (see "Zoom-level readout")

### Requirement: Map padding accounts for the mobile controls handle

The map SHALL avoid placing important UI (attribution, native MapLibre controls) under the mobile controls handle, and SHALL apply bottom padding equal to the collapsed handle height when computing fit-bounds / centering operations on mobile.

#### Scenario: Attribution not hidden behind handle

- **WHEN** the controls panel is in its collapsed-handle state on mobile
- **THEN** the MapLibre attribution control MUST remain visible (e.g. by being moved or by giving the map a bottom padding equal to the handle height)

#### Scenario: Fit-bounds respects mobile padding

- **WHEN** the application calls `map.fitBounds` on mobile (e.g. to frame a selected GPX or curated track)
- **THEN** the call MUST pass a bottom padding ≥ the collapsed handle height so the framed feature is not occluded by the handle

### Requirement: Basemap catalogue

The application SHALL ship with at least three switchable basemaps. Each
entry MUST be served key‑free by a public tile server — either IGN's
Géoplateforme WMTS at `https://data.geopf.fr/wmts` or another public
tile server that requires no API key or runtime secret.

#### Scenario: OpenTopoMap topographic basemap

- **WHEN** the application loads its basemap catalogue
- **THEN** the catalogue MUST include a topographic entry that serves
  tiles from OpenTopoMap using the XYZ template
  `https://tile.opentopomap.org/{z}/{x}/{y}.png`, with no API key
- **AND** the entry MUST carry an attribution string crediting
  OpenStreetMap contributors and SRTM for the data and OpenTopoMap
  (CC-BY-SA) for the map rendering, with a link to
  `https://www.openstreetmap.org/copyright` and to
  `https://opentopomap.org/`
- **AND** the rendered basemap MUST show contour lines with elevation
  labels, hillshading, and the footpath / GR network, so a user can read
  terrain and route from it

#### Scenario: Topographic basemap is capped at its maximum rendered zoom

- **WHEN** the user zooms the topographic basemap beyond zoom 17, the
  deepest zoom OpenTopoMap renders
- **THEN** the entry's declared `maxZoom` MUST cause MapLibre to overzoom
  the zoom-17 tile
- **AND** the map MUST NOT display OpenTopoMap's out-of-range placeholder
  tile, which is served with HTTP 200 and reads "max zoom layer = 17"
  rather than failing as a missing tile

#### Scenario: Aerial imagery basemap

- **WHEN** the application loads its basemap catalogue
- **THEN** the catalogue MUST include an entry labelled "Satellite" (or
  "Aerial") that serves tiles from the Géoplateforme WMTS layer
  `ORTHOIMAGERY.ORTHOPHOTOS` using its declared tile-matrix set
  (currently `PM_0_19`)

#### Scenario: Street basemap

- **WHEN** the application loads its basemap catalogue
- **THEN** the catalogue MUST include an entry labelled "Street" that
  serves tiles from the OpenStreetMap standard tile server using the XYZ
  template `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, with no API
  key, and the entry MUST carry an attribution string that credits
  "© OpenStreetMap contributors" with a link to
  `https://www.openstreetmap.org/copyright`

### Requirement: Scale bar

The map SHALL display a metric scale bar that shows how much real-world
distance an on-screen segment represents. The scale bar SHALL update live as
the map is panned or zoomed, express distance in metres or kilometres as
appropriate, and be anchored in the bottom-left corner of the viewport — on
desktop tucked just under the zoom-level readout (which is lifted to leave
room) — where it does not overlap the GPX button, the controls panel, or the
attribution control. The
scale bar SHALL be display-only and MUST NOT intercept map interactions.

#### Scenario: Scale bar visible on load

- **WHEN** the map finishes loading
- **THEN** a scale bar MUST be visible in the bottom-left of the map viewport,
  directly beneath the zoom-level readout on desktop
- **AND** it MUST show a labelled distance in metric units (e.g. `500 m` or
  `2 km`) corresponding to the length of the bar

#### Scenario: Scale updates live with zoom and pan

- **WHEN** the user zooms in or out, or pans to a different latitude
- **THEN** the scale bar's length and its distance label MUST update to reflect
  the current map resolution, rounded to a sensible round distance

#### Scenario: Scale bar never blocks map interaction

- **WHEN** the user clicks, drags, or performs a touch gesture on the area
  occupied by the scale bar
- **THEN** the interaction MUST pass through to the map (the scale bar has
  `pointer-events: none`)

#### Scenario: Scale bar stays legible on every basemap

- **WHEN** the user switches between the topographic, aerial, and street
  basemaps
- **THEN** the scale bar MUST remain readable on each basemap — it MUST use a
  contrasting colour and/or background or text shadow rather than relying on the
  underlying tiles

#### Scenario: Scale bar compact and clear of chrome on mobile

- **WHEN** the viewport is ≤ 768px wide
- **THEN** the scale bar MUST render in a mobile-friendly compact form that
  remains legible, is lifted just above the collapsed sheet, and continues to
  update live with `pointer-events: none`

### Requirement: Third-party tile attribution is a licence obligation
The topographic basemap's attribution SHALL be treated as a licence
obligation rather than a presentational detail. OpenTopoMap's rendering
is licensed CC-BY-SA and its underlying OpenStreetMap data under ODbL,
both of which require credit wherever the map is shown. The credit MUST
therefore be present in the attribution control whenever the topographic
basemap is active, at every viewport size — folded behind the ⓘ button like
every credit (see "Attribution and credits"), never removed, truncated or
hidden behind other chrome.
#### Scenario: Credit present whenever the topographic basemap is active
- **WHEN** the topographic basemap is the active basemap, at any
  viewport width including the mobile breakpoint
- **THEN** opening the attribution control MUST show the OpenStreetMap /
  SRTM data credit and the OpenTopoMap (CC-BY-SA) style credit, with
  working links
#### Scenario: The ⓘ button stays reachable on phones
- **WHEN** the viewport is ≤ 768px wide and the controls sheet is at its peek
  height
- **THEN** the attribution's ⓘ button MUST remain visible and tappable, not
  covered by the sheet

### Requirement: Third-party tile usage is respectful of the provider

The application SHALL fetch topographic tiles only in response to normal
interactive map use. OpenTopoMap is served by a volunteer-run project
that permits embedding provided its servers are not stressed by mass
downloads, and that offers no uptime guarantee, so the application MUST
neither harvest its tiles nor depend on its availability.

#### Scenario: No bulk or speculative tile fetching

- **WHEN** the application runs, in the browser or in any build-time
  script
- **THEN** it MUST NOT prefetch, crawl, bulk-download, or systematically
  harvest OpenTopoMap tiles
- **AND** any build-time script that touches the tile server MUST fetch
  no more than the single preview tile it needs

#### Scenario: Topographic basemap outage degrades gracefully

- **WHEN** the OpenTopoMap tile server is slow or unavailable
- **THEN** the application MUST continue to function with the other
  basemaps selectable and all overlays intact, rather than blocking the
  map on the failed source

