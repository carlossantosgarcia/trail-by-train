## MODIFIED Requirements

### Requirement: Search field in the Tracks dock

The application SHALL provide a text field in the Tracks dock that queries the
place index as the user types. Matching SHALL be accent- and case-insensitive,
so `saint-martin` matches `Saint-Martin` and `mont aiguille` matches
`Mont Aiguille`.

Results SHALL be grouped by kind under a heading naming that kind, and SHALL be
ordered so that a prefix match outranks a word-boundary match, which outranks a
match elsewhere in the name; among equal matches, more prominent kinds and
larger communes SHALL rank higher. Each kind SHALL show at most four results,
so one crowded kind cannot push the others out of view; a station's detail
line SHALL NOT repeat its own name.

On mobile the field SHALL meet the touch-target minimum. Its collapsed form SHALL be a single action within the dock's existing action row rather than a row of its own, so that search costs no additional band of chrome while unused — the map-dominance budget in `responsive-ui` leaves no room for one. Opening it SHALL move focus into the field so the keyboard appears, and SHALL be reversible without a keyboard. Picking a result SHALL collapse the field back to its action, so the dock returns to its resting size while the map shows the result.

#### Scenario: Accent-insensitive matching

- **WHEN** the user types `elancon` in the search field
- **THEN** a place named `Élançon` MUST appear in the results

#### Scenario: Results are grouped by kind

- **WHEN** a query matches entities of more than one kind
- **THEN** each kind MUST appear under its own heading, rather than the matches
  being interleaved in one flat list

#### Scenario: The most likely match is first

- **WHEN** the user types `grenob`
- **THEN** the commune Grenoble MUST rank above entities whose names merely
  contain the query

#### Scenario: Very short queries do not match mid-word

- **WHEN** the user has typed only two or three characters
- **THEN** results MUST be limited to records where the query begins the name or
  begins a word within it, since a two-letter fragment occurring inside a longer
  word carries no signal about what was meant

#### Scenario: Dismissing the results

- **WHEN** the user presses Escape, or clears the field, or selects a result
- **THEN** the result list MUST close

#### Scenario: Collapsed search costs no extra row on mobile

- **WHEN** the application loads on a viewport ≤ 768px and search has not been
  opened
- **THEN** search MUST be represented by one action inside the dock's existing
  action row
- **AND** the dock MUST be no taller than it is without the search feature

#### Scenario: Opening search on a phone gives it the keyboard

- **WHEN** the user taps the collapsed search action on a touch viewport
- **THEN** the field MUST appear and MUST receive focus, so the on-screen
  keyboard opens without a second tap

#### Scenario: Search can be dismissed without a keyboard

- **WHEN** the field is open on a touch viewport with nothing typed, and the
  user taps the map outside it
- **THEN** the field MUST collapse back to its action, since a touch device has
  no Escape key

#### Scenario: Picking a result on a phone collapses the field

- **WHEN** the user picks a result on a viewport ≤ 768px wide
- **THEN** the result list MUST close and the field MUST collapse back to its
  action in the dock's action row
