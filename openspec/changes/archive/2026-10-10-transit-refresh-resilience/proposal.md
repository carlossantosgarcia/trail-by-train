## Why

Issue #4 lists six transit networks that "keep failing to refresh". None of
them is a bug in the build, and none has lost data on the map, but the build
cannot tell their situations apart from a broken feed:

- **Out of season.** The Alpe d'Huez, Tignes, Val d'Isère and Valmorel shuttles
  publish every file with headers and no rows until their winter timetable
  comes out. The build reads 0 routes and fails.
- **Shapes dropped.** Altigo (Briançonnais) stopped shipping `shapes.txt` in
  its 2026-09-15 edition and in the 2026-09-29 one. `shapes.txt` is a required
  file, so extraction fails before anything else is tried.
- **A pinned file.** Altigo's config points at the dated 2026-09-15 file, so
  the build never saw the newer edition. 12 of the 63 networks are pinned the
  same way.
- **A shrunken feed.** Charente (16) now publishes 2 of its 21 lines with the
  same stop ids as before. The churn guard reads 882 archived stops against 69
  live and reports regenerated ids, which is not what happened.

Every seasonal network will raise the same alert every year, and the issue
mixes "nothing to do" with "needs a look".

## What Changes

- **Out-of-season feeds are not failures.** A feed with no trips is recorded
  as out of season: the previous artifacts stay, the line popup says "Hors
  saison", and the refresh record keeps no failure. Only a network out of
  season for over 13 months is raised.
- **The current file is fetched.** For a network whose `sourceUrl` is a
  transport.data.gouv.fr dataset, the build looks up the dataset's GTFS
  resources once per run and downloads the current one; `gtfsUrl` remains the
  fallback when the lookup fails or is ambiguous.
- **A feed without shapes keeps the shapes already recorded.** `shapes.txt` is
  extracted when present instead of being required. A line with no shape in
  the feed takes the geometry its ledger entry recorded, when the stops it
  serves today lie on that geometry; its popup says when that shape was
  recorded. Lines
  with no recorded shape are still not drawn: geometry is never made up from
  stop sequences.
- **Shrinking is not churn.** The churn guard fails a build only when most of
  the feed's current lines or stops are unknown to the ledger. A feed that
  keeps its ids and drops lines builds normally, the dropped lines become
  archived, and a drop of more than half the lines is recorded as a warning.
- **A trip's first stop is its lowest `stop_sequence`**, not the stop numbered
  1. Altigo numbers from 2, which left every trip out of its lines' service
     summary and blanked their first endpoint.
- **The alert has sections**: broken (opens or updates the issue), to check
  with the operator (recent warnings) and out of season, both in the job
  summary only so they never flood the issue. When nothing is broken, the run
  closes the open issue.

## Capabilities

### Modified Capabilities

- `scheduled-data-refresh`: out-of-season outcome; sectioned alert that closes
  itself.
- `transit-provider-catalog`: current dataset file resolved at build time;
  shapes optional, borrowed from the ledger.
- `transit-line-ledger`: churn guard judged on id overlap; shrink warning.

## Impact

- `scripts/transit/build.mjs`: catalog lookup, optional shapes, ledger shapes,
  out-of-season outcome, shrink warning, refresh record.
- `scripts/transit/lib/resolve-feed.mjs` (new), `lib/ledger.mjs`.
- `scripts/transit/report-stale.mjs`, `.github/workflows/data.yml`.
- `src/transit/TransitPopup.tsx`, types: "Hors saison" pill, borrowed-shape note.
- `scripts/transit/providers.config.mjs`: Altigo's pin comment.
- `BUILD_VERSION` 3, so every network is rebuilt once under the new rules.
