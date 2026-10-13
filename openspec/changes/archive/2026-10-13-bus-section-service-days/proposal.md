## Why

The Bus section offered two ways to thin the map, and neither held up.

- **"Masquer les lignes peu fréquentes"** hid weekday-only lines with at most 4
  distinct trips: half the lines (3,217 of 6,386), including two-round-trip
  rural coaches a hiker can use (Isère's T60 Pont-en-Royans – Grenoble). At the
  weekend it changed nothing, since every such line has no weekend service.
- **A school-line label** (a calendar heuristic tried on a preview) marked
  4,086 lines. Running only on school days says nothing about who may board:
  many of these services are open to everyone. Hiding them by default would
  hide buses hikers can take.

The day filter is what hikers plan with, but it has its own faults. It chose
one of "Tous", "Lun–Ven", "Sam", "Dim", so "runs on Saturday and Sunday" could
not be asked. And `runs_saturday` was true for a line with a single Saturday in
its whole feed.

The Bus section itself had grown awkward. Every selected network was a pill, so
"Tout afficher" filled the section with 63 pills that said nothing useful. Its
header held "Tout afficher / Tout retirer" and an eye pushed to the far right,
while the Trains header has its eye beside the title.

## What Changes

- **Lines carry the days they run regularly.** `service_days`, a 7-character
  mask from Monday ("1111100"), counts a day when the line runs on it on at
  least 4 dates, or in at least half of the weeks it runs at all. One-off dates
  drop out; a summer of Saturdays stays. Stops carry the masks of their lines.
  The popup's per-day-type rows follow the same rule.
- **A weekend picker with two small toggles**, "Sam" and "Dim", replacing the
  four-way choice. Both selected keeps the lines that run on both, so a
  weekend out and back can be asked. Nothing selected shows everything. While
  a day is on, a summary line says what is shown. Weekdays
  are not offered: most lines run on every weekday, so picking one would hide
  little.
- **No frequency or school filter.** `is_low_freq`, `has_high_freq_line` and
  `lowFreqThreshold` are removed, and no school label is added.
- **A Bus section laid out like Trains.**
  - The eye sits beside the title.
  - One icon toggle turns bus lines on and off (all networks when none was
    chosen).
  - Networks sit behind a one-line summary, "Tous les réseaux" or "3 réseaux
    sur 63". Its menu lists them by region, each with a checkbox, plus "Tout
    cocher" / "Tout décocher", a filter, and the colour swatch that used to be
    on the pill.

## Non-goals

- Saying who may board a line (open to all, or pupils only). Only the operator
  says so, in its PDF or on its site; no feed does. A later change may record it.
- A "usable for a day hike" filter (out in the morning, back in the afternoon).
  It needs times per stop and direction, which the timetable study is building.
- Seasons in the popup ("Saturdays in summer only").

## Capabilities

### Modified Capabilities

- `public-transit`: build output, per-day service, day filter, stop and line
  popups, network choice, colours, the Bus section; the low-frequency filter is
  removed.
- `transit-provider-catalog`: entries no longer declare `lowFreqThreshold`.
- `map-viewer`: the controls panel lists the weekend filter, and no longer a
  low-frequency toggle.
- `responsive-ui`: the network menu replaces the "+ Fournisseurs ▾" dropdown.

## Impact

- **Build:**
  - `scripts/transit/lib/service-days.mjs` is new, with its tests;
  - `build.mjs`, `stops.mjs`, `emit-geojson.mjs` and `providers.config.mjs`
    change.
  - `BUILD_VERSION` 4 rebuilds every network. Until then the app shows every
    line, since a missing mask passes the filter.
- **App:**
  - `serviceDays.ts` is new, with its tests;
  - `DayPicker.tsx`, `PublicBusesSection.tsx`, the transit overlay filters and
    the stop popup change;
  - `BusNetworkMenu.tsx` is new and replaces `BusProviderPicker` and
    `BusProviderPill`;
  - `HideLowFreqToggle` is removed.
- **Saved settings:** `hp:bus-days` is new; a weekday saved in it is dropped
  on reading. `hp:bus-day-filter` and
  `hp:bus-hide-low-freq` are no longer read.
