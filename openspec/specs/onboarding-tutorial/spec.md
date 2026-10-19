# onboarding-tutorial Specification

## Purpose
TBD - created by archiving change onboarding-tutorial. Update Purpose after archive.
## Requirements
### Requirement: A four-step visual tutorial

The application SHALL provide a tutorial, shown as a modal dialog, made of
four steps in this order:

1. **Explorer**: an animation that opens close up on the Explore button as it
   is pressed, pulls back to the whole screen, then draws a zone around a
   single station (Luc-en-Diois) and gets the bus lines, stations and hikes
   inside it; and a button that closes the tutorial and enters Explore mode.
2. **Trains et bus**: a screenshot of the app itself in the interface
   language, on the Topo basemap between Crest and Bourdeaux with the Saturday
   and Sunday filters on, the card open (the mobile sheet on a phone) of a
   line that keeps away from the railway (the D52 through Saoû). For the
   picture only, the basemap is paled and that line drawn thick in the colour
   of its card's chip, or chip and line both in the line's map colour when it
   has no colour of its own; the app's own drawing is unchanged. Below it,
   the train and bus layer toggles as the controls show them, each with one
   line on what the layer shows, and a line saying that selecting a line
   gives more detail on its timetable and selecting a stop the buses through
   it, in one wording for click and tap. The step SHALL NOT state a number of networks.
3. **Repérez les transports près de votre trace GPX**: an animation that opens close up on the
   dock's "Ouvrir .gpx" as it is pressed, pulls back as the map flies to the
   track, shows the track under a plain name in the track list, reads the
   elevation profile along its length with the whole track in view above it
   (on a phone, framed above the sheet), then runs Explore a few kilometres
   around Saoû, at its far end, the radius brought in on its slider; one line
   saying so; and a button that opens
   the file picker, loads the chosen tracks as the dock's "Ouvrir .gpx" does
   and closes the tutorial.
4. **Randonnées**: the satellite map around a hike that starts and ends at a
   station (Alès to Chamborigaud), captured from the app with its railways and
   station names, with the hike's trace, smoothed, drawn over it like the
   curated-hikes layer draws a route, in a colour that holds on the imagery,
   with its A and B ends; one line on what these hikes are; the curated-hikes
   layer toggle as the controls show it, with one line saying it shows them
   on the map; and a line saying that a click (a tap on mobile) on a hike
   gives its distance, climb and walking time. The step SHALL NOT fly to or
   pick out any one hike of the collection. The map's
   attribution SHALL be shown on it. The step SHALL NOT state how many hikes
   the collection holds.

Both animations SHALL be muted looping videos, recorded in the interface language: the tutorial
SHALL show the French or English take to match it, and switch take when the
language changes.

Each step SHALL carry a title and at most two short sentences. The
dialog SHALL show which step is current among the four, and SHALL let the
user go to the next and previous step, and skip from any step. The language
switch and the skip button SHALL sit in a bar of their own above the
picture, never over it.

#### Scenario: Walking through the steps

- **WHEN** the tutorial is open on its first step and the user presses
  "Suivant" three times
- **THEN** the fourth step SHALL show, the step indicator SHALL mark it
  current, and its primary button SHALL close the tutorial

#### Scenario: Starting Explore from the tutorial

- **WHEN** the user presses the Explore button of the first step
- **THEN** the tutorial SHALL close and Explore mode SHALL be active

#### Scenario: Opening a GPX from the tutorial

- **WHEN** the user presses the third step's button and picks a GPX file
- **THEN** the tutorial SHALL close and the track SHALL load as if opened
  from the dock

#### Scenario: The hikes step points to the layer

- **WHEN** the tutorial shows its fourth step
- **THEN** it SHALL show the curated-hikes toggle with its line, and SHALL
  have no button that changes the map

### Requirement: The language can be chosen from the tutorial

The tutorial SHALL carry the language switch (see `interface-languages`), so a
first visit that lands in the wrong language can change it before reading on.
Switching SHALL keep the current step.

#### Scenario: Switching on the second step

- **WHEN** the tutorial shows its second step in French and the user picks EN
- **THEN** the same step SHALL show in English

#### Scenario: The animation follows the language

- **WHEN** the tutorial shows its first step and the user picks EN
- **THEN** the animation SHALL be the one recorded with the English interface

### Requirement: Opens once on a first visit

On load, the tutorial SHALL open by itself when this browser has no record of
it having been seen, and SHALL NOT open by itself otherwise. Closing the
tutorial by any means — skipping, finishing, a step's own button, Escape or
a click on the backdrop — SHALL record it as seen in `localStorage` under
`tutorial.seen`, with the tutorial's version as the value. The record SHALL
NOT leave the browser. When storage cannot be read or written, the app SHALL
keep working and treat the tutorial as not seen.

#### Scenario: A new visitor

- **WHEN** the app loads in a browser with no `tutorial.seen` entry
- **THEN** the tutorial SHALL open on its first step

#### Scenario: A returning visitor

- **WHEN** the user skipped the tutorial and reloads the page
- **THEN** the tutorial SHALL NOT open by itself

#### Scenario: A new tutorial version

- **WHEN** `tutorial.seen` holds an older version than the current tutorial
- **THEN** the tutorial SHALL open once more by itself

### Requirement: Reopened from the dock

A help action in the Tracks dock (see `map-chrome`) SHALL open the tutorial on
its first step at any time outside Explore mode. It SHALL be icon-only, SHALL
carry the accessible name "Comment ça marche" ("How it works" in English), and SHALL meet the mobile
touch-target minimum.

#### Scenario: Reopening after skipping

- **WHEN** a user who has seen the tutorial presses the help action
- **THEN** the tutorial SHALL open on its first step

### Requirement: Fits the screen it is on

At or below the mobile breakpoint, the tutorial SHALL fill the width of the
screen as a bottom-anchored sheet, its controls SHALL meet the touch-target
minimum, a horizontal swipe SHALL change step, and its first step SHALL show an
animation recorded on the phone layout. Above the breakpoint it SHALL be a
centred dialog showing an animation recorded on the desktop layout. On every
viewport it SHALL fit the viewport height without scrolling the page behind
it, and the left and right arrow keys SHALL change step.

The animation SHALL be fetched only once the first step is shown. With
`prefers-reduced-motion: reduce`, a still image of the same scene SHALL be shown
instead of the animation.

#### Scenario: On a phone

- **WHEN** the tutorial opens on a 393×708 viewport
- **THEN** the phone animation SHALL be shown, and every button SHALL be at
  least 44×44 px

#### Scenario: Reduced motion

- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** the first step SHALL show the still image, not the animation

### Requirement: Tutorial media come from the media pipeline

The tutorial's animations and stills SHALL be generated by the README media
scripts (`npm run media -- tutorial tutorial-phone tutorial-gpx tutorial-gpx-phone
tutorial-stills`),
from the real app, in French and English, into `public/tutorial/`, rather than edited by hand. Every media scene SHALL mark the
tutorial as seen before loading the app, so the dialog never covers a capture.

#### Scenario: Regenerating the README media

- **WHEN** `npm run media` runs any scene
- **THEN** no capture SHALL show the tutorial dialog

