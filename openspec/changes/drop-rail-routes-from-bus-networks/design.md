## Context

`scripts/transit/build.mjs` reads `routes.txt` and draws every route as a bus
line; `route_type` is only consulted by one reservation predicate. The Zou feed
(Région Sud) bundles the regional TER trains with its coaches: 32 of 64 routes,
and 9,385 of its 10,070 trips, are `route_type` 2. A scan of all 63 networks'
`routes.txt` found rail route types in Zou only.

The feed also publishes TER replacement coaches as separate `route_type` 3 routes
that reuse the train's number and long name (e.g. P25, id suffixed `::Coach`).
Those are real buses.

The line ledger keeps every line it has seen; a route that disappears from the
build is normally kept as an archived (dashed) line.

## Goals / Non-Goals

**Goals:**
- No train is drawn, searched or matched as a bus line, for any network.
- Coaches that share a train's number stay.
- Trains already in a ledger leave the map rather than turning into "no longer
  published" lines.
- The exclusion is visible in the build summary.

**Non-Goals:**
- Train timetables. The rail overlay shows the network and stations; showing TER
  times is a separate feature.
- Excluding trams, metro, funiculars or cable cars (types 0, 1, 5, 6, 7, 12):
  the rail overlay does not cover them, and some networks (Funiculaire des Arcs)
  exist precisely for them.
- A per-network switch. No network today needs trains drawn as buses.

## Decisions

**Filter by `route_type`, not by route id or agency.** `2` and the extended rail
types `100`–`117` are what GTFS defines as rail. Matching Zou's `ZTER` agency or
the `SNC:` id prefix would also catch the TER coaches, and would not generalise to
the next feed that bundles trains. *Alternative considered:* a per-network list of
excluded lines in the catalog — rejected, it is a manual list that goes stale.

**Filter at the source, right after reading `routes.txt`.** Dropping the routes,
then their trips, means stops served only by trains and shapes used only by trains
never enter the build, exactly as if the feed had not published them. Filtering
later (at tiling) would leave train-only stops on the map.

**Purge excluded routes from the ledger by `route_id`.** `mergeLineLedger` takes
the excluded ids and drops matching entries instead of archiving them. Matching by
name, as the ledger does to follow renumbered lines, is deliberately not used here:
the P25 coach has the same short and long name as the P25 train, and must survive.
Stops left with no line are then dropped by the existing stop-ledger rule, and an
old stop kept for other lines SHALL list only lines still on the map: copying its
previous list unfiltered, as the stop ledger did, kept K24 on stops the coaches
also serve.

**Rebuild when the rules change, not only when the feed does.** A refresh skips a
provider whose feed hash is unchanged, so this rule would never reach `zou` until
Région Sud republishes. `meta.json` gains a `build_version`, bumped whenever the
build's output rules change, and the skip applies only when both the hash and the
version match. *Alternative considered:* `--force` on the next run — rejected, it
rebuilds everything and needs remembering at every rule change.

**Report, don't fail.** Excluded rail routes are counted per network in the log and
in the job summary. A feed bundling trains is a fact about the feed, not an error.

## Risks / Trade-offs

- [A feed mislabels a bus as `route_type` 2] → it would vanish silently. The
  summary's per-network count makes a sudden exclusion visible.
- [Zou shrinks to its 32 coach routes] → expected: those are its buses. The
  network's line count in `meta.json` drops accordingly.
- [The README's bus screenshot shows P25] → re-shoot it after the rebuild if the
  line clicked is a train.

## Migration Plan

Merge, then run the Data workflow (`transit`), or wait for Monday's run. The new
`build_version` makes every provider rebuild once, even with unchanged feeds; the
weekly run returns to skipping afterwards. Rollback: revert the commit; the version
change rebuilds the providers again, and `zou` needs `--reset-ledger` to forget the
purge.
