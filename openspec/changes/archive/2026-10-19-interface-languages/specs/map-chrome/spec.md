## ADDED Requirements

### Requirement: The controls' footer carries feedback and language

The last row of the layer controls SHALL hold the general "Envoyer un retour"
link at its start and the language switch (see `interface-languages`) at its
end. Because the desktop panel and the mobile sheet's layers segment host the
same controls, the switch SHALL be reachable from both without a second
instance.

#### Scenario: On desktop

- **WHEN** the controls panel is open on a viewport wider than the mobile
  breakpoint
- **THEN** its last row SHALL show "Envoyer un retour" and the FR | EN switch

#### Scenario: On mobile

- **WHEN** the mobile sheet is opened on its layers segment
- **THEN** its last row SHALL show the same two controls
