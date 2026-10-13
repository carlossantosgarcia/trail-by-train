## MODIFIED Requirements

### Requirement: The controls panel

On desktop the layer controls SHALL be a panel at the top right holding, in
order: the basemap switcher; **Randonnée**, with the curated-hikes and GR
toggles, and the duration filter beside them while hikes are shown; **Trains**,
with its section eye, the rail-network toggle and, while the network is on, a
"Masquer les gares" / "Afficher les gares" button; and **Bus**, with its section
eye beside its title, then the bus-line toggle and the network summary (see
`public-transit`). A section's filters SHALL appear only while one of its
overlays is on: the weekend filter, the archived-line toggle and the validity
banner once a bus network is selected. Where there is room, a section's toggles
and its main option SHALL share one wrapping row.

The panel SHALL fold into a small "Layers" button and back, and SHALL remember
that state across reloads.

#### Scenario: A first visit

- **WHEN** the application is opened with nothing saved
- **THEN** the panel MUST show the switcher, Randonnée, Trains and Bus, and no
  weekend filter, bus filters or validity banner

#### Scenario: Selecting a bus network reveals its filters

- **WHEN** the user selects a first bus network
- **THEN** the weekend filter, the archived-line toggle and the validity
  banner MUST appear in the Bus section

#### Scenario: Folding the panel

- **WHEN** the user folds the panel and reloads
- **THEN** only the "Layers" button MUST show, and it MUST reopen the panel
