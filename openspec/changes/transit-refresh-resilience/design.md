## Context

`build.mjs all` builds each network in turn. A network that throws keeps its
previous artifacts, and `updateRefreshStatus` counts the failure;
`report-stale.mjs` turns three in a row into the `data-alert` issue. Today
"throws" covers four different situations (see the proposal).

## Decisions

### Out of season = no trips

A feed whose trips (rail routes left out) number zero is out of season. It is
not an empty-by-mistake download: a broken archive fails at extraction, a
missing file at the required-file check. The build writes nothing but
`meta.json`, adding `dormant_since` (kept from the previous run when already
set) and leaving `last_checked_on` alone: what the map shows is last season's
timetable, so its age must keep showing. The outcome is `dormant`; the refresh
record resets the failure count and carries `dormant_since`. An unchanged
dormant feed is skipped as before but still reported `dormant`. The first real
rebuild writes a fresh `meta.json` without the field.

A feed whose trips all ran in the past is not treated as out of season: that
is an operator who has not republished, and the existing ageing covers it.

### Resolving the current file

`resolve-feed.mjs` takes the provider config and the transport.data.gouv.fr
catalogue (`/api/datasets`, fetched once per run, ~2.5 MB) and returns the URL
to download:

- only for a single-URL network whose `sourceUrl` names a dataset in the
  catalogue;
- the dataset's GTFS resources that are available; with one, that one; with
  several, the configured URL when it is still among them, else the most
  recently updated one;
- otherwise the configured `gtfsUrl`.

The URL used is recorded in `meta.json` as `gtfs_url`, and a change of URL
forces a fresh download over a cached archive. A failed catalogue fetch logs a
warning and every network falls back to its configured URL.

### Shapes from the ledger

`shapes.txt` moves from the required list to the optional one at extraction,
for every network. A route with no usable shape looks up its ledger entry (by
`route_id`, then by name, as the ledger already matches) and takes its
geometry when at least 90% of the stops the line serves today lie within 200 m
of it. The line
carries `shape_seen_on`: the entry's own `shape_seen_on` if it was already
borrowed, else its `last_seen_on`. The popup shows "Tracé relevé le <date> : le
réseau ne publie plus le tracé de ses lignes."

The stops decide, not the endpoints: the build takes each direction's longest
trip as the line's ends, and a school variant ending at a college changes them
without changing the route (Altigo's line 5). Stops on the recorded shape are
direct evidence that the line still runs there.

### First stop by lowest sequence

The build took a trip's first stop to be the one numbered 1. Altigo numbers
from 2, so none of its trips counted in its lines' service summary and the
lines' first endpoint was blank; a feed numbering from 0 had the second stop's
departure taken. The first stop is now the lowest `stop_sequence`.

### Churn judged on overlap

`assertNoRunawayChurn` gets the number of current entries that matched a
previous one. Regenerated ids leave almost every current entry unmatched; a
shrink leaves them matched. It throws only when archived entries exceed the
floor and three times the live count **and** fewer than half the live entries
matched.

### Shrink warning

When a rebuild's line count falls below half of the previous `line_count`
(previous at least 4), the outcome carries `warning: "feed shrank from X to Y
lines; the others stay on the map as archived lines"`. The refresh record
keeps `warning` and `warning_on`; the report lists warnings from the last 21
days under "To check with the operator".

### Report and issue

`report-stale.mjs` prints the issue body: "Broken" (3+ failures, 21 days
without success after a failure, or out of season for over 395 days) and "To
check with the operator" (recent warnings). Empty means healthy.
`--summary` prints the same plus "Out of season" for the job summary. The
workflow comments on or opens the issue when the body is non-empty, and
comments "All clear" and closes the open issue when it is empty.

## Risks

- A catalogue dataset whose newest GTFS covers a different network than the
  pinned one. Mitigated by keeping the configured URL whenever it is still
  listed among several.
- Borrowed shapes can be out of date; the popup states their date.
