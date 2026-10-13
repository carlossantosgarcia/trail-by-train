## ADDED Requirements

### Requirement: Operator timetable PDFs

The operator timetable PDFs known for a network's lines SHALL be committed as
`data/timetable-pdfs/<provider id>.csv`, with the header
`route_id,line,url,label,valid_from,valid_to,scope`:

- `route_id`: the line, as in the network's data; `line`: its short name, for
  readers only;
- `url`: a document the line's operator publishes on its official site;
- `label`: short French text without dates, such as "Fiche horaire", "Guide du
  réseau" or "Fiche horaire (été)";
- `valid_from`, `valid_to`: `YYYY-MM-DD` as the operator states them, next to
  the link or in the PDF, or empty. They SHALL NOT be inferred from an edition
  name such as "2026-2027" or from a September start;
- `scope`: `line`, or `network` for a document covering every line.

A line's rows SHALL be in order of preference, its own sheets before
`network` documents. A URL SHALL appear once per line. The test suite SHALL
reject a file with another header, a row without a `route_id` or a valid URL, a
malformed date, `valid_from` after `valid_to`, an unknown `scope`, a duplicate,
or a name that is not a provider id.

The app SHALL load a network's file at most once per session, only when one of
its lines is opened. A network without a file, or whose file fails to load,
SHALL behave as if no line had a PDF.

#### Scenario: Fixing a link

- **WHEN** an operator moves a line's sheet and someone edits that row's `url`
- **THEN** the next deployment SHALL link the new URL, with no data rebuild

#### Scenario: A sheet that only gives its start

- **WHEN** a sheet says "Horaires valables à partir du 01/09/2026" and gives no
  end date
- **THEN** its row SHALL have `valid_from` `2026-09-01` and an empty `valid_to`

#### Scenario: Line codes that repeat across departments

- **WHEN** Rémi publishes a sheet for line "10" in Eure-et-Loir and another for
  line "10" in Loiret
- **THEN** each SHALL be listed under its own department's `route_id`

## MODIFIED Requirements

### Requirement: Line popup

Clicking a line SHALL open a popup anchored at the nearest point of the line's
geometry (every segment of every linestring considered), not at the raw click
point, containing:

- the line's short-name chip and long name, and the network's label;
- when the line has a `service_kind`, a pill saying so before the others: "Train",
  or "Car de remplacement TER";
- a reservation pill for every line, with the booking detail when booking is
  required;
- a "Dernière mise à jour" pill coloured by the age of the data, and the feed's
  published end date where it declares one;
- a warning when the line is `archived`;
- the number of stops and the two endpoints;
- one row per day type: "05:53–20:49 · 5 trajets", or "20:49 · 1 trajet" for a
  single trip, or "Pas de service". The direction-merged `avgGapMin` SHALL NOT be
  shown: it does not say how often a bus passes in either direction;
- a "Voir le tracé sur la carte" action, reading "Masquer le tracé" when this line
  is the highlighted one;
- when the network's PDF list has documents for the line, one "<label> (PDF) →"
  link per document, at most three, in the file's order, opening the
  operator's PDF, with the stated dates after the label ("Fiche horaire · du
  01/09/26 au 31/08/27"). A document whose `valid_to` is before today SHALL NOT
  be linked;
- otherwise a "Voir les horaires →" link: the line's `timetable_url` when the
  build set one, otherwise the network's timetable link (see
  `transit-provider-catalog`);
- a footer saying the data is indicative and may be out of date.

Escape SHALL close it.

#### Scenario: A TER replacement coach

- **WHEN** the user opens Zou's P25 coach (Grenoble – Clelles – Veynes), which the
  feed also publishes as a train
- **THEN** the popup SHALL show a "Car de remplacement TER" pill

#### Scenario: A kept train

- **WHEN** the user opens Zou's line 49 (Nice – Digne-les-Bains)
- **THEN** the popup SHALL show a "Train" pill

#### Scenario: A plain bus

- **WHEN** the user opens a coach line with no train on its route
- **THEN** the popup SHALL show no service-kind pill

#### Scenario: A line with no Sunday service

- **WHEN** the user opens a line whose Sunday window is `null`
- **THEN** its Sunday row SHALL read "Pas de service"

#### Scenario: A line whose reservation status is unknown

- **WHEN** the user opens a line with `reservation: 'unknown'`
- **THEN** a pill reading "Réservation : inconnue" SHALL be shown, with no
  explanation beneath it

#### Scenario: The popup anchors on the line

- **WHEN** the user clicks the hit area a few pixels off a line
- **THEN** the popup's tail SHALL point at the nearest point on the line

#### Scenario: A line with its operator's PDF

- **WHEN** the user opens Isère's T40 and its network file lists a sheet for it
- **THEN** the popup SHALL link that sheet, and SHALL NOT show "Voir les
  horaires →"

#### Scenario: Every document has expired

- **WHEN** the only document listed for a line has a `valid_to` in the past
- **THEN** the popup SHALL show "Voir les horaires →" instead
