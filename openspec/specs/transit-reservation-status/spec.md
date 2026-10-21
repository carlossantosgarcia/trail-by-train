# transit-reservation-status Specification

## Purpose
Whether a line must be booked ahead: a three-state status read from each feed, and how the popup presents it.
## Requirements
### Requirement: Reservation status is three-state

The build SHALL resolve, for every line, a reservation status of exactly one of `required`, `not_required` or `unknown`, and SHALL emit it on `TransitLineProperties` and on each `ServingLine` entry. A two-state flag SHALL NOT be used: it cannot distinguish a line nobody needs to book from a line the feed says nothing about.

`unknown` SHALL be the default. A status of `not_required` SHALL require positive evidence that the feed models booking at all.

#### Scenario: A feed that says nothing yields unknown

- **WHEN** a provider's feed carries no booking rules and no reservation signal on a line
- **THEN** that line's reservation status SHALL be `unknown`, and SHALL NOT be reported as not requiring reservation

#### Scenario: Status is carried to stops

- **WHEN** a stop is served by a line whose reservation status is `required`
- **THEN** the corresponding `ServingLine` entry SHALL carry the same status, so a stop popup can warn without a lookup into the lines source

### Requirement: Reservation is read from GTFS-Flex booking rules

Where a feed ships `booking_rules.txt`, the build SHALL join `stop_times` → `trips` → route to determine which routes reference a booking rule, and SHALL resolve those routes to `required`. A route SHALL count as `required` when any of its trips references a booking rule on pickup or drop-off.

A feed models booking when it ships `booking_rules.txt` and at least one of its trips references a rule. In such a feed, a route that references none SHALL resolve to `not_required` — the feed demonstrably records booking and has recorded none for this line.

When a route resolves to `required` from a booking rule, the build SHALL carry that rule's booking detail — deadline message, phone number and information URL where present — so the popup can tell the reader how to book.

#### Scenario: A route referencing a booking rule requires reservation

- **WHEN** any trip of a route references a `pickup_booking_rule_id` or `drop_off_booking_rule_id`
- **THEN** the line's reservation status SHALL be `required` and its booking detail SHALL carry the referenced rule's message, phone number and information URL where the feed provides them

#### Scenario: A booking-aware feed can answer "no"

- **WHEN** a feed's trips reference booking rules, but a given route's trips reference none
- **THEN** that line's reservation status SHALL be `not_required`

#### Scenario: An orphaned booking rule does not imply reservation

- **WHEN** a feed ships a booking rule that no `stop_times` row references — as `mreso-gresivaudan` does, with one rule and zero references across 10,101 rows
- **THEN** no line in that feed SHALL be resolved to `required` on the strength of that rule alone, and lines SHALL remain `unknown`

### Requirement: Per-provider reservation predicates

Each network SHALL name, in its catalog entry, a predicate that resolves reservation status from its route data and from what the feed-level scan found: `detectReservationDefault`, or `detectReservationFlexibleOr715WithReservation` for the networks that document booking in `route_desc`. Route-level signals SHALL yield `required`: a `route_id` containing `:FlexibleLine:`, and — for the second predicate — `route_type` 715 together with a `route_desc` mentioning reservation. `route_type` 715 alone SHALL NOT, since some operators use it for unrelated services such as school buses.

A predicate SHALL NOT return `not_required` from the absence of a route-level signal alone.

#### Scenario: Route-level signals resolve to required

- **WHEN** a route's `route_id` contains `:FlexibleLine:`, or a provider using the interurban predicate has a route with `route_type` 715 and a `route_desc` mentioning réservation
- **THEN** that line's reservation status SHALL be `required`

#### Scenario: Absence of a route-level signal is not a negative answer

- **WHEN** a route matches no route-level reservation signal and its feed ships no booking rules
- **THEN** the predicate SHALL return `unknown` rather than `not_required`

### Requirement: The popup states reservation status as a pill

The line card SHALL show a reservation pill when the line's status is known:
"Réservation obligatoire", with a phone, when it is `required`, and "Sans
réservation" when it is `not_required`. A line whose status is `unknown` SHALL
show no reservation pill and no explanation: "Réservation : inconnue" told the
reader nothing they could act on, on most lines of most networks, and cost
space in a card read at a bus stop. Since an unknown status is therefore
conveyed by the absence of the pill, a `not_required` status SHALL always be
stated by its own pill and never left implicit.

When the status is `required`, the card SHALL additionally show the booking
detail available for that line — deadline, phone and booking link — because
that is actionable rather than merely informative.

#### Scenario: A line requiring reservation says how to book

- **WHEN** the user opens the card of a line whose status is `required` and whose booking rule carries a deadline and a phone number
- **THEN** the card SHALL show a "Réservation obligatoire" pill, and SHALL show that deadline and phone number

#### Scenario: A line known not to need booking

- **WHEN** the user opens the card of a line whose status is `not_required`
- **THEN** a "Sans réservation" pill SHALL be shown

#### Scenario: An unknown status shows nothing

- **WHEN** the user opens the card of a line whose status is `unknown`
- **THEN** no reservation pill and no explanation SHALL be shown

