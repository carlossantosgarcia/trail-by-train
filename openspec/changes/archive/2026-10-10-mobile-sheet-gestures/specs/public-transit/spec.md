## ADDED Requirements

### Requirement: Line and stop details as a sheet on phones

The line popup and the stop popup SHALL, on viewports at or below the mobile
breakpoint, render as a transient bottom sheet instead of a map-anchored popup:
full width, scrollable, opening at half height capped to its content, with the
line's chip and long name — or the stop's name — and a close button in the
head. Its content and actions SHALL be those of the popup. Tapping a line chip
in a stop's sheet SHALL show that line in the same sheet. The sheet SHALL close
on its close button, `Escape`, the back action, a decisive downward drag, or a
tap on the map that opens no feature (see `responsive-ui`). On wider viewports
the popups SHALL stay anchored on the map as described in "Line popup" and
"Stop popup".

#### Scenario: A tapped line on a phone

- **WHEN** the user taps a bus line on a 390 px wide viewport
- **THEN** the line's details MUST open in a sheet spanning the screen's width,
  entirely on screen, with "Voir le tracé sur la carte" and "Voir les horaires
  →" reachable by scrolling the sheet

#### Scenario: From a stop to one of its lines

- **WHEN** the user taps a stop on a phone and then one of its line chips
- **THEN** the same sheet MUST show that line's details

#### Scenario: Highlighting from the sheet

- **WHEN** the user taps "Voir le tracé sur la carte" in a line's sheet
- **THEN** the line MUST be highlighted and framed as from the popup, and the
  sheet MUST stay open
