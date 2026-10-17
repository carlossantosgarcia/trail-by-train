## Context

The transit build currently draws a route only from `shapes.txt`, or from the
geometry the ledger recorded while a feed still published shapes. The spec
forbids "fabricating geometry from stop sequences". That rule keeps out
straight lines between stops, but it also keeps out Altigo's new lines and
every shapeless trip. Meanwhile it lets through operator shapes that are
straight lines between stops (Corsica, Hauts-de-France).

A study outside the repository (2026-10-13) ran pfaedle 99f2cd4 on 13
networks that publish both shapes and stops, and compared its output with the
published shapes:

- **Agreement**: 77–80% of variants within 25 m on Queyras, Sibra,
  Transaltitude and Cars Savoie; 49–59% on Zou, Haute-Savoie, Grésivaudan and
  Giffre; 37% on Cars Isère. Altigo matches its ledger on 9 of 11 lines.
- **Hop failures**: 5.4% of hops are broken. The causes were roads pfaedle
  chose differently (49%), detours the bus makes without a stop (25%), a stop
  snapped to the wrong road (11%) and roads missing from OSM (9%). Stops out of
  order were negligible (41 of 52,533).
- **Detectable failures**:
  - Straight-line fallbacks: 2–2.5% of hops in Haute-Savoie and Somme, near
    borders.
  - Stops moved ≥100 m: 24.6% of their hops are broken, against 4.1% for
    stops placed within 25 m.
- **Cost**: matching takes ≤19 s per network. Reading OSM
  dominates, at 50–90 s per region.

## Goals / Non-Goals

**Goals:**

- Draw lines whose feed gives no road-following geometry, as estimates the
  popup labels.
- Replace stop-to-stop shapes with estimates.
- Keep the rules few: draw pfaedle's line as it comes, and let the label cover
  its errors.
- Run in the free GitHub Actions tier, and leave local builds working without
  pfaedle.

**Non-Goals:**

- Correcting published road-following shapes, even imperfect ones.
- Fixing pfaedle's undetectable errors (a parallel road, a detour without a
  stop). The label is what covers these.
- Registering new shapeless networks. That is now allowed but is a separate
  change.
- A distinct map style for estimated lines. The popup labels them: a "Tracé
  estimé" pill and one line saying how the route was drawn.

## Decisions

### Trips that are estimated

A trip is a candidate when it has no `shape_id`, its shape was rejected, or its
shape is stop-to-stop.

A shape is stop-to-stop when both hold:

- ≥80% of its vertices lie within 25 m of a stop;
- it has fewer than 3 vertices per km.

This matches all 83 Haute-Corse shapes, 2,354 of 2,809 in Nord, and none of
the road-following shapes of the study's networks. Candidates are grouped by
(route, ordered stop list), and one representative trip per group is routed.

Two cases are skipped:

- **The route is in the ledger.** When the feed gives a route no shape at all
  and the ledger's recorded shape still passes its stops, that published
  geometry wins. It is the operator's, and it is already validated against
  today's stops.
- **The variant is already drawn.** A shapeless pattern of a route that has
  road-following shapes is skipped when 90% of its stops lie within 200 m of
  them. This is the ledger's own test. It avoids drawing an estimated copy of a
  road already drawn.

_Alternatives:_

- Estimate every trip. This is slower, and dissolves estimates over real shapes.
- Estimate whole routes from their longest trip. This loses branches.

### Drawing pfaedle's line whole

pfaedle's line is drawn as it comes. Where it finds no road between two stops
(a road missing from OSM, one tagged out of the bus profile, a stop in a field
far from any road) it joins them with a straight segment, and that segment is
drawn like the rest.

A first version cut two kinds of hop: straight segments longer than 300 m with
no vertex, and the hops either side of a stop placed more than 100 m from its
position. Cut estimates left gaps, needed a fill rule for replaced
stop-to-stop shapes, and five lines would have needed a further rule to drop
them outright. Inspecting them on a map showed the straight segments are
plainly visible as such, and the popup already says the line is estimated. So
the cut was dropped for simplicity. Straight hops and moved stops are still
counted, for the build log and the unpublished `estimates.json`.

A stop-to-stop shape is dropped only when every pattern using it got an
estimate.

_Alternatives:_

- Cut straight hops and moved stops, as above. More rules, gaps on the map.
- Drop a pattern whose cut hops exceed a share of its length. A third rule on
  top of the cut, for 5 lines out of 379.

### OSM data

- **Which extracts.** They come from Geofabrik's index: France's metropolitan
  regions plus neighbouring countries and sub-regions. The build picks those
  containing any stop or hop midpoint of the candidates. This fixes the
  border cases the study hit, such as Geneva (line 274 of Cars Haute-Savoie),
  and Zou's lines into Monaco and Italy.
- **Filtering.** Each extract is filtered with `osmium tags-filter` to
  highway, public_transport and route relations when downloaded. That keeps
  9–27% of it: Rhône-Alpes goes from 531 to 146 MB, PACA from 390 to 98 MB.
- **Cropping.** Per build, each extract is cropped (`osmium extract -b`) to
  the candidates' box plus 0.15°, and the crops are merged. A first version
  merged whole extracts: Zou needed PACA, Monaco and Italy's north-west for one
  two-hop line and spent 418 s on it. Cropped, it takes 12 s, and Altigo drops
  from 57 s to 7 s with identical output.
- **Caching.** Files are cached and refreshed after 28 days.
  `TRANSIT_OSM_CACHE` moves the cache out of the checkout. In CI the cache key
  is the month: a key is written once, so a per-run key would save a new
  1.2 GB entry every week against the repository's 10 GB cache quota.

_Alternatives:_

- A per-provider extract list in `providers.config.mjs`. This is 63 entries to
  keep in sync and misses a new cross-border line.
- The France extract, 4.5 GB. Too large for the runner.

### pfaedle as a tool

The `PFAEDLE` and `PFAEDLE_CONFIG` environment variables locate pfaedle. When
it is absent, the build logs how many lines it would estimate and draws what
it did before.

In CI, pfaedle is built from a pinned commit and cached by that commit. It is
GPL-3.0, but it is run, not distributed, so the repository's MIT licence is
unaffected.

The mini feed handed to pfaedle keeps route names, which it matches against
OSM route relations, and real stop times. It maps route types to `bus`, or to
`coach` for 200–299. Only road vehicles are estimated: buses, on-demand ones
included, coaches and trolleybuses. A funicular or lift routed along the road
would be confidently wrong.

### Data model

Lines carry `shape_estimated: 'all' | 'part' | null`:

- `part`: the route keeps some of the feed's road-following shapes, and the
  estimate adds variants.
- `all`: every variant of the route is estimated.

The ledger stores the property with the geometry. `ledgerShapeLookup` ignores
estimated entries, so an estimate never comes back as "Tracé relevé le…".
`meta.json` gains `estimated_line_count`.

## Risks / Trade-offs

- **Wrong but plausible roads.** About 5% of hops overall, more on sparse
  school lines, go along a road the bus doesn't take, and nothing flags them.
  → The popup says the route is estimated. Stops, which are what a hiker
  needs, always come from the feed.
- **Straight segments.** Where pfaedle finds no road, two stops are joined
  by a straight line across fields. → It happens on 216 of 40,271 hops (40 of
  379 estimated lines), the popup says the line is estimated, and the segment
  is no worse than the stop-to-stop shapes being replaced.
- **ODbL share-alike.** Estimated geometry is derived from OpenStreetMap, so
  `transit.tar.gz` contains a derivative database. → Attribute OpenStreetMap in
  `DATA_LICENSES.md` and on the map wherever estimated lines are shown. The
  data release should state that estimated geometry is ODbL. Confirm with the
  maintainer before merging.
- **CI time and disk.** The first run downloads every needed extract. A region
  is 0.1–0.7 GB raw, and Italy's north-west was needed for Zou. → Filtered
  extracts are cached, at a quarter of the size or less. Later runs crop them,
  and only for networks whose feed changed.
- **OSM changes do not reach an unchanged feed.** A feed whose hash is
  unchanged is skipped, so its estimate keeps last month's roads. →
  Acceptable: roads change slowly, and a bump of `BUILD_VERSION` refreshes
  everything.
- **Memory.** pfaedle peaks at 1.4 GB on HdF Nord (2,240 trips), the largest
  network; GitHub's runners have 16 GB.
- **The CI workflow could break the weekly data.** → A `dry_run` input builds
  everything without publishing, alerting or deploying, so a branch can be
  timed on GitHub's runners before merging.

## Migration Plan

`BUILD_VERSION` 5 rebuilds every network once. Lines that were stop-to-stop
change geometry in place under the same `route_id`, so the ledger matches them
as live lines. To roll back, revert. The next build redraws from the feed, and
the ledger's estimated entries are never borrowed.

## Open Questions

- ODbL wording for the data release, and whether the map attribution should
  mention OSM for estimated lines specifically.
- Should estimated lines also look different on the map (thinner, dotted)?
  This change leaves them identical, as asked.
- Whether to tighten pfaedle's own snapping distances
  (`osm_max_snap_distance` 100 m, station candidates 200 m) so fewer stops are
  moved. Not yet measured.
