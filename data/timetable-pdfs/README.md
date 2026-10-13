# Timetable PDFs

The operators' own timetable PDFs, linked from the line popup in place of a web
search. One file per network, named after its provider id in
`scripts/transit/providers.config.mjs`. The app loads a network's file the first
time one of its lines is opened. A network without a file keeps the search link.

| Column       | Content                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- |
| `route_id`   | The line, as in the network's GTFS feed (`routes.txt`).                                      |
| `line`       | The line's short name. For readers only; the app ignores it.                                 |
| `url`        | The PDF on the operator's official site. Never a copy.                                       |
| `label`      | Short French text, without dates: `Fiche horaire`, `Guide du réseau`, `Fiche horaire (été)`. |
| `valid_from` | `YYYY-MM-DD` as the operator states it, next to the link or in the PDF; else empty.          |
| `valid_to`   | The same for the end date. Once it has passed, the app stops linking the document.           |
| `scope`      | `line`, or `network` for one document covering every line (a guide, a leaflet).              |

A line can have several rows (seasons, directions). The popup shows the first
three, in file order, so put the line's own sheet first.

## Fixing a link

Edit the row, or add one, and open a pull request. `npm test` checks every file:
header, URLs, dates, scope, duplicates and file name. The change is live on the
next deployment; no data rebuild is needed.

Write dates only when the operator states them. An edition name such as
"2026-2027" is not a validity date.

## Refreshing a network

Replace the network's file wholesale with a new crawl's export, in the same
format, and review the diff: a network losing many rows usually means the
operator's site changed, not that its timetables were withdrawn.
