## ADDED Requirements

### Requirement: The results sheet can be lowered and raised on mobile

On viewports at or below the mobile breakpoint, the result panel SHALL be a
transient sheet that opens at half height and that the user can drag or tap
between its snap points like any other sheet (see `responsive-ui`). Lowered to
peek, it SHALL keep showing its summary line (line, station and hike counts)
and the "Changer le rayon" / "Redessiner" action, so the region stays visible
on the map with the results one tap away. Lowering it SHALL NOT leave Explore
mode; only the mode's own exit control does.

#### Scenario: Lowering the results to see the region

- **WHEN** results are shown on a phone and the user drags the sheet down
- **THEN** the sheet MUST settle at peek showing the summary line and the
  redraw action, and Explore mode MUST stay active

#### Scenario: Raising the results to read them all

- **WHEN** the results are longer than half the screen and the user drags the
  sheet up
- **THEN** the sheet MUST rise until its content ends, at most to the full cap

#### Scenario: Panning the map lowers the results

- **WHEN** results are shown at half or full and the user pans the map
- **THEN** the results sheet MUST lower to peek
