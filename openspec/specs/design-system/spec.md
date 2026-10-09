# design-system Specification

## Purpose
The vocabulary every surface in the app is built from: design tokens, the shared chrome material, theming, and the accessibility floor that is verified rather than asserted.

## Requirements

### Requirement: Single source of design tokens

The application SHALL define all colour, typography, spacing, radius, elevation, motion, and stacking values as CSS custom properties in one file (`src/tokens.css`), imported once at application entry. Component stylesheets SHALL reference those properties and SHALL NOT contain literal colour, shadow, radius, or font-shorthand values.

#### Scenario: No literal colours remain in component styles

- **WHEN** the repository is searched for hex colour literals under `src/**/*.module.css`
- **THEN** the search MUST return no matches

#### Scenario: Radius is limited to three steps

- **WHEN** any component applies a corner radius
- **THEN** it MUST use one of exactly three tokens — `--r-sm`, `--r-md`, or `--r-pill` — and no other radius value SHALL appear in `src/**/*.module.css`, apart from `50%` for circular elements

#### Scenario: Elevation is limited to one scale

- **WHEN** any surface applies a drop shadow
- **THEN** it MUST use one of the three elevation tokens (`--e-1`, `--e-2`, `--e-3`) and MUST NOT declare a bespoke `box-shadow` recipe, except for `inset` hairlines

#### Scenario: Tokens reach non-React chrome

- **WHEN** chrome is built outside React — the GR popup constructed with vanilla DOM in `Map.tsx`, and MapLibre's injected attribution, scale bar and popup container
- **THEN** that chrome MUST be styled from the same tokens via global CSS, so no surface in the application is exempt from the token layer

#### Scenario: Canvas-drawn chrome reads the tokens

- **WHEN** a library draws chrome to a canvas and cannot inherit CSS, as uPlot does for the elevation chart
- **THEN** it MUST read its colours from the design tokens at construction time rather than hard-coding them, and MUST rebuild when the active theme changes

### Requirement: Named data colours are distinct from interface colours

Colours that identify something in the world rather than an interface state — a curated hike's source, a timetable caveat, the GR waymark, the per-metric effort palette — SHALL be named tokens of their own and SHALL NOT be collapsed into the interface accent or the neutral ramp.

#### Scenario: Curated-hike sources keep their identities

- **WHEN** a curated-hike popup renders its source badge
- **THEN** the badge colour MUST come from that source's own token (`--source-nsv`, `--source-les-others`, `--source-mollow`) rather than the interface accent

#### Scenario: Warnings are distinguishable from errors and from state

- **WHEN** a timetable-validity caveat renders
- **THEN** it MUST use the warning tokens, which are distinct from both the error tokens and the accent

### Requirement: No dead font references

Every font family named in a stylesheet SHALL either be one the application loads or an explicit system fallback in the same stack.

#### Scenario: A stylesheet never requests an unavailable face

- **WHEN** the stylesheets are searched for `font-family` declarations
- **THEN** none MUST request a face the application does not load

### Requirement: Shared surface material

The application SHALL define one surface material — background, blur, hairline, radius, and elevation — in a shared stylesheet, and every floating chrome element SHALL adopt it rather than declaring its own.

#### Scenario: All chrome shares one material

- **WHEN** the Tracks dock, the controls panel, popovers, map popups, and the mobile sheet are rendered together
- **THEN** they MUST present the same background treatment, hairline colour, radius vocabulary, and elevation scale

#### Scenario: Map popups match the app's panels

- **WHEN** MapLibre renders a popup container, which cannot reach a CSS module
- **THEN** it MUST carry the same material, applied globally, so a map popup and a panel read as the same surface

### Requirement: Light and dark themes

The application SHALL support a light and a dark theme. The active theme SHALL be resolved from a stored preference, falling back to `prefers-color-scheme`, and applied as a `data-theme` attribute on the document element before first paint.

#### Scenario: Dark theme follows the operating system

- **WHEN** the user's system is set to dark mode and no explicit override is stored
- **THEN** the application MUST render its dark palette on first paint, with no light-theme flash

#### Scenario: Map controls follow the theme

- **WHEN** the dark theme is active
- **THEN** MapLibre's attribution control, scale bar and zoom buttons MUST render in a treatment legible against the basemap under the dark theme, rather than inheriting light-theme styling

#### Scenario: Chrome stays legible over satellite imagery

- **WHEN** the satellite basemap is active in either theme
- **THEN** every chrome surface MUST remain legible over it

### Requirement: Verified contrast floor

The application SHALL meet a contrast floor of 4.5:1 for body text and 3:1 for large text and non-text boundaries, in both themes. Compliance SHALL be verified by an automated check that runs as part of `npm run lint`.

Because chrome surfaces are translucent over arbitrary basemaps, contrast SHALL be measured against the composited surface at its minimum opacity over the worst-case basemap luminance, not against the opaque surface colour.

Pairings that fall below their threshold SHALL be recorded as named exceptions carrying a written reason, and SHALL be reported on every run, rather than being accommodated by lowering a threshold.

#### Scenario: Lint fails on an inaccessible token pair

- **WHEN** a developer changes a colour token so that a text-on-surface pair falls below its threshold in either theme, and that pair is not a recorded exception
- **THEN** `npm run lint` MUST fail and MUST name the offending pair, the measured ratio, and the theme

#### Scenario: Contrast is measured on the composited surface

- **WHEN** the check evaluates text on a translucent chrome surface
- **THEN** it MUST composite that surface at its minimum opacity over the worst-case basemap luminance before measuring

#### Scenario: Tolerated shortfalls stay visible

- **WHEN** the check runs and a recorded exception is below its threshold
- **THEN** the run MUST print that exception, its measured ratio, and the reason it is tolerated, so the debt is not silently hidden

#### Scenario: Existing pill contrast helper is left intact

- **WHEN** the WCAG contrast helper is added to `src/lib/colorContrast.ts`
- **THEN** the existing `textColorFor` function and its Rec. 709 luminance threshold MUST be unchanged, so transit pill and Explore route-label rendering are unaffected

### Requirement: Errors are signalled by more than colour

The application SHALL NOT signal an error or a destructive action by colour alone. Error surfaces SHALL combine a distinct `--alert` colour with a leading bar, an icon, and explanatory text.

#### Scenario: An error toast carries three cues

- **WHEN** an error toast is shown — for example when the curated-hikes manifest fails to load
- **THEN** it MUST render with a leading `--alert` bar, a warning icon, and text stating what failed

#### Scenario: Error text says what happened

- **WHEN** an error surface is rendered
- **THEN** its text MUST name what failed and, where the user can act, what to do about it

### Requirement: Reduced motion is honoured globally

The application SHALL respect `prefers-reduced-motion: reduce` by zeroing its duration tokens in one place, so that every transition defined in terms of those tokens is disabled without per-component handling.

#### Scenario: Reduced motion disables all chrome animation

- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** panel expansion and the mobile sheet's snap transition MUST apply instantly, while remaining fully operable

#### Scenario: Motion is defined only in tokens

- **WHEN** a component declares a transition duration
- **THEN** it MUST reference a duration token, so the reduced-motion override reaches it
