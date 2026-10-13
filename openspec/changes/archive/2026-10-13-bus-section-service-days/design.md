## Context

Day filtering used three booleans per line, `runs_weekday`, `runs_saturday` and
`runs_sunday`, each true when any trip ran on any such day in the feed.

Measured on the study's copy of every feed (6,386 live lines), weekend service
is nearly all or nothing:

| Saturdays a line runs              | Lines |
| ---------------------------------- | ----: |
| none                               | 4,589 |
| at least half of the weeks it runs | 1,731 |
| in between                         |    66 |

The 66 lines in between are of two kinds:

- **one-off dates** (a Saturday before term, an event), 22 of them on one or
  two Saturdays;
- **seasonal service** (liO's Toulouse – Saint-Girons runs 9 summer Saturdays
  in a 53-week feed).

## Decisions

### A day counts when the line runs on it regularly

For each day of the week, the build counts the dates the line runs on it, over
every trip of the route. The day counts when that is at least 4 dates, or at
least half the number of weeks in which the line runs at all.

- The first test keeps a season of Saturdays.
- The second keeps a short feed's two weekends.
- Both drop a lone Saturday in a year of weekdays.

The popup's per-day-type rows follow the same mask, so a line the filter calls
weekday-only does not show a Saturday departure.

Seven days rather than three day types: Wednesday differs from other weekdays
on many rural networks. Seven booleans would cost more per feature, and stops
repeat their lines', so the mask is one string.

### The picker offers Saturday and Sunday only

The question a hiker asks is "can I go at the weekend?". Weekdays filter
little, since most lines run on every weekday. A seven-day picker was tried on
the preview; its weekday toggles added choices people did not need.

The selection is still stored as a 7-day mask, the same shape as the data, so
the filter code does not care which days the picker offers. A weekday saved by
that preview is dropped when read.

### Both days mean "both"

A hiker asking for Saturday and Sunday wants a line they can take out on one
day and back on the other, or on either day of a weekend. Both selected
therefore keeps lines that run on both.

Nothing selected is the default and shows everything. The summary line under
the toggles says which rule applies ("Lignes circulant le samedi et le
dimanche").

### Stops keep a few masks, not their union

With "all of them", a stop must pass only if one of its lines runs on every
selected day. A stop served by a Saturday-only line and a Sunday-only line
should not pass "Saturday and Sunday", and the union of their masks would let
it.

- **What a stop stores:** the distinct masks of its lines, leaving out any that
  a broader one covers, comma-separated.
- **How the map tests it:** the filter is an `any` over the first 8 masks, each
  an `all` over the selected days. Each test is a `slice` of one character at
  `8·j + day`; past the string's end, `slice` gives "".
- **More than 8 masks:** the stop stores their union. It is rare and errs on
  the side of showing.

The stop popup tests each serving line's own mask, so its chips and
"+N masquée(s)" are exact.

### Missing masks pass

Tiles built before this change carry no `service_days`. The filter coalesces a
missing mask to "every day", so the app can ship before the data and never
hides what it cannot judge.

Archived lines recorded before the change get a mask from their old
`runs_<day>` flags when the ledger carries them forward. Ledger stops get
theirs recomputed from their lines.

### No frequency or school filter

- **"Peu fréquentes"** hid half the map, and a trip count cannot tell a useful
  line (out in the morning, back at night) from a useless one (the reverse).
- **A school label** would answer "does it stop in the holidays?" while users
  read it as "can I board?".

Both are dropped. The day picker and the popup's trips per day type let people
judge for themselves.

### Networks: a summary, not a list of pills

People choose an area, not an operator: the map only draws what is in view, so
"every network" is the right default once buses are on. The section therefore
shows a one-line summary that opens the full list.

- **Ticking instead of add/remove:** the list does not reorder under the finger.
- **Bulk actions** live where the list is.
- **Colours are kept,** since some people use them, but move into the list as
  one swatch per network.

The icon toggle mirrors Trains' "Réseau ferroviaire" button. Turning it on with
nothing chosen selects every network; turning it off clears the choice, as
"Tout retirer" did. The eye keeps its meaning: hide everything without losing
the choice.

### Phones

- **Weekend toggles:** a small segmented track beside the "Week-end" label,
  "Sam" and "Dim", 30 px tall on phones (22 px on desktop). A toggle that is on
  fills with the accent colour; both can be on.
- **Network menu:** it opens in flow inside the sheet, with rows at least 44 px
  tall, 20 px checkboxes and a 24 px swatch, so a row can be ticked without
  opening the palette by mistake.

## Risks

- **Seasonal service reads as all-year.** A line running Saturdays only in
  summer is listed for Saturday in October. The popup shows departures, not
  dates; seasons are a later change.
- **The threshold is a judgement call.** Four dates or half the weeks is tuned
  on today's feeds; the tests pin the cases it must get right.
