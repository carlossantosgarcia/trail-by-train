## ADDED Requirements

### Requirement: The interface exists in French and English

Every interface string SHALL exist in French and in English: control
labels, accessible names, popups and sheets, Explore, search, the GPX tools
and effort explainers, the feedback form, toasts and the tutorial. Data
SHALL be shown as published, in neither language's form: line, stop and place
names, hike titles, operator notes, timetable document labels and map
attributions.

#### Scenario: The same panel in English

- **WHEN** the language is English and the user opens the controls
- **THEN** the sections SHALL read "Hiking", "Trains" and "Bus", and the
  network menu SHALL read "No network"

#### Scenario: Data is not translated

- **WHEN** the language is English and the user opens a line called
  "Die ↔ Valence"
- **THEN** the popup SHALL show "Die ↔ Valence" with English labels around it

#### Scenario: Dates follow the language

- **WHEN** a popup shows a date of 2026-10-17
- **THEN** it SHALL read 17/10/2026 in French and 17 Oct 2026 in English

### Requirement: The language is detected, chosen and stored per browser

On a first visit the language SHALL be the first of French or English in the
browser's language preferences, and English when it lists neither. A choice
made with the language switch SHALL be stored in `localStorage` under
`hp.lang` and SHALL take precedence on later visits. It SHALL NOT be sent
anywhere. When storage cannot be used, the app SHALL work in the detected
language. `<html lang>` and the page title SHALL follow the language.

#### Scenario: A French browser

- **WHEN** a first visit comes from a browser preferring `fr-FR`
- **THEN** the interface SHALL be in French

#### Scenario: A German browser

- **WHEN** a first visit comes from a browser listing only `de-DE`
- **THEN** the interface SHALL be in English

#### Scenario: The choice is kept

- **WHEN** a user on a French browser picks EN and reloads
- **THEN** the interface SHALL be in English

### Requirement: Switching the language in place

The language switch SHALL change the language at once, without a reload. It
SHALL offer two options, FR and EN, each named in its own language. The map view,
loaded tracks, open panels and the tutorial's step SHALL be kept. Interface
built outside React SHALL be in the new language the next time it is built.
On mobile each option SHALL meet the touch-target minimum.

#### Scenario: Switching with a track loaded

- **WHEN** a GPX track is loaded and its elevation panel open, and the user
  switches to English
- **THEN** the panel SHALL read in English, with the same track and map view

### Requirement: Feedback keeps the relay's format

The feedback form SHALL show its categories in the interface language, and
SHALL send the French category names the relay accepts. The GitHub issue
built for the fallback link SHALL keep its French body.

#### Scenario: Reporting in English

- **WHEN** the language is English and the user sends a report under
  "Timetable"
- **THEN** the relay SHALL receive the category "Horaires"
