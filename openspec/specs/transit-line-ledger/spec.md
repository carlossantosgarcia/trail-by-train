# transit-line-ledger Specification

## Purpose
Keeping lines on the map after their feed stops publishing them: what is remembered about each line, and how lines no longer published are shown and can be hidden.
## Requirements
### Requirement: Lines survive disappearing from their feed

Each build SHALL record every line it saw, geometry included, to
`public/transit/<id>/lines-ledger.geojson.gz`, and SHALL emit the union of the
current feed's lines with everything the ledger remembers. A line the current
feed no longer publishes SHALL be emitted with `archived: true` and SHALL retain
the geometry, service data and `last_seen_on` date captured when it was last
present.

#### Scenario: A line withdrawn from the feed stays on the map

- **WHEN** a provider is rebuilt from a feed that no longer contains a line the
  ledger remembers
- **THEN** that line SHALL still appear in `lines.pmtiles`, flagged
  `archived: true`, with the geometry captured while it was still published

#### Scenario: An archived line's last-seen date is not bumped by later builds

- **WHEN** a provider is rebuilt while one of its lines remains absent
- **THEN** that line's `last_seen_on` SHALL keep the date of the last build
  whose feed still carried it, so its apparent age keeps growing

#### Scenario: A line returning to the feed becomes current again

- **WHEN** a feed publishes a line the ledger had marked archived
- **THEN** the line SHALL be emitted with `archived: false`, refreshed geometry,
  and `last_seen_on` set to the current build date

#### Scenario: Archived lines keep their stops

- **WHEN** a line is archived
- **THEN** the stops it served SHALL remain in `stops.geojson` — flagged
  `archived: true` when no live line calls there — and stops still served by
  live lines SHALL list the archived line among their `serving_lines`

#### Scenario: Feeds that renumber their routes do not duplicate the ledger

- **WHEN** a feed reissues an existing line under a new `route_id`
- **THEN** it SHALL be matched to the ledger entry by `(route_short_name,
route_long_name)` and treated as the same line, rather than added as a new one
  while the old id is archived forever
- **AND WHEN** archived entries nevertheless exceed three times the live count —
  for lines above 30 archived, for stops above 200 — while fewer than half the
  live entries match an entry already in the ledger, the build SHALL fail and
  keep the previous artifacts rather than write a ledger that doubles on every
  build; `--reset-ledger` starts it afresh once the cause is understood

#### Scenario: A feed that drops lines but keeps its ids

- **WHEN** a feed that published 21 lines now publishes 2, with the same stop
  and route ids as before
- **THEN** the build SHALL succeed, the 19 others SHALL be archived lines on the
  map, and the outcome SHALL carry a warning that the feed shrank from 21 to 2
  lines

### Requirement: Confidence comes from observation, not classification

The system SHALL NOT classify lines as seasonal. It SHALL record
`observed_from` / `observed_to` — the active-date window as published — and
`last_seen_on` / `last_seen_day`, and SHALL derive any statement of uncertainty
from how long ago the line was last seen.

Rationale: a short active window cannot distinguish a winter-only line from a
feed with a short publication horizon, so any seasonal verdict drawn from it
would misfire on whole networks.

Every line SHALL carry a statement of when we last received a feed carrying it,
not only archived ones. "Present in the current feed" is not by itself a
statement of currency — a provider rebuilt in spring and one rebuilt yesterday
are otherwise indistinguishable to the reader.

That statement SHALL be a single pill labelled "Dernière mise à jour : <date>",
whose date is the provider's build date for a line still published and
`last_seen_on` for an archived one. Its colour SHALL indicate the age, so the
label itself can stay a bare date: quiet under 90 days, a warning tone up to a
year, an alert tone beyond. Where the relevant feed declares a validity end
date, the popup SHALL additionally show "Horaires publiés jusqu'au <date>" —
for an archived line that is `last_feed_valid_to`, the validity known when the
line was last seen, not the provider's current one.

For a line still in the feed, the age driving that colour SHALL be measured from
the provider's `last_checked_on` — the last time its feed was downloaded and
compared — rather than from its build date. A publisher who has not reissued a
feed for six months is not thereby publishing stale data, and a pill that
reddened on that basis alone would be reporting our own inactivity as the
operator's. Where the two dates differ, the popup SHALL additionally show
"Vérifié le <date>" carrying `last_checked_on`, so the reader can tell data that
is old from data that is merely unchanged.

Archived lines SHALL continue to take their age from `last_seen_on`: a line the
feed has stopped carrying genuinely does age, however recently we checked.

#### Scenario: Age is computed when the map is drawn

- **WHEN** an archived line's age is presented to the user
- **THEN** it SHALL be computed from `last_seen_day` against the current date at
  render time, so the wording stays correct as time passes without a rebuild

#### Scenario: The popup states what was observed

- **WHEN** the user opens the popup for an archived line
- **THEN** the update pill SHALL carry the date it was last seen, and a short
  caveat SHALL state that the line is no longer published, the window it ran
  over, and that the operator should be checked — repeating neither the date nor
  the age in prose, and making no claim about whether it will run again

#### Scenario: A line still in the feed states when it was last updated

- **WHEN** the user opens the popup for a line whose `archived` is false
- **THEN** a "Dernière mise à jour" pill SHALL show the provider's build date,
  computed at render time, and the feed's published validity end date SHALL be
  shown where the feed declares one

#### Scenario: The update pill's colour reflects the age

- **WHEN** two lines' data differ in age — one from a feed received this month,
  one from a feed over a year old
- **THEN** their pills SHALL differ in colour, so the age is legible without
  the reader having to compute it from the date

#### Scenario: An archived line reports the validity it had when last seen

- **WHEN** the user opens the popup for an archived line whose feed declared a
  validity end date when it was last seen
- **THEN** the published-until mention SHALL use that date rather than the
  provider's current feed validity

#### Scenario: A stable feed does not age into a warning

- **WHEN** a live line's provider was built eight months ago but its feed was
  confirmed unchanged last Sunday
- **THEN** the pill SHALL stay in its quiet state, SHALL show the build date as
  the last update, and SHALL additionally show "Vérifié le" with the check date

#### Scenario: A feed nobody has checked still ages

- **WHEN** a live line's provider has neither been rebuilt nor checked for over a
  year, because the schedule stopped running
- **THEN** the pill SHALL reach its alert state

#### Scenario: A freshly rebuilt provider states one date

- **WHEN** a live line's provider was rebuilt in the same run that checked it
- **THEN** the popup SHALL show the update pill alone, without a redundant
  "Vérifié le" line

#### Scenario: An archived line ages despite a recent check

- **WHEN** an archived line was last seen ten months ago and its provider's feed
  was confirmed unchanged last Sunday
- **THEN** the line's age SHALL be taken from `last_seen_on`, so the pill
  reflects ten months rather than a week

### Requirement: Archived lines are visually subordinate and can be hidden

Archived lines SHALL render dashed and faded, fading further as they age, and
SHALL be visible by default. The user SHALL be able to hide them.

#### Scenario: Age is legible without opening a popup

- **WHEN** archived lines of different ages are on screen
- **THEN** a line last seen within 90 days SHALL render more opaque than one
  last seen over a year ago

#### Scenario: Hiding archived lines

- **WHEN** the user turns off "Afficher les lignes hors horaire actuel"
- **THEN** archived lines, their chips and their archived-only stops SHALL stop
  rendering and SHALL stop responding to clicks, while lines still in the feed
  are unaffected

