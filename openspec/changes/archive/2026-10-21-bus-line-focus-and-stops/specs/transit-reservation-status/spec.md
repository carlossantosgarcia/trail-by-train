## MODIFIED Requirements

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
