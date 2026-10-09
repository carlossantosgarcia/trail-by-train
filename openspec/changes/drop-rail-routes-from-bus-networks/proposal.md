## Why

Line K24 (Avignon – Lyon Perrache – Mâcon) appears on the map as a Zou! Express
bus line, but it is a regional train. The Zou feed publishes the Région Sud TER
trains alongside its coaches: 32 of its 64 routes are `route_type` 2 (rail), and
the transit build draws every route as a bus, whatever its type. A planner reading
"bus K24" would look for a bus stop that does not exist.

## What Changes

- The transit build SHALL leave out routes whose GTFS `route_type` is rail — `2`,
  or the extended rail types `100`–`117` — from every bus network, together with
  the trips, stops and shapes that only they use. Trains are what the rail overlay
  is for.
- Road coaches sharing a train's number stay: the TER replacement coaches the same
  feed publishes as `route_type` 3 (for example P25 Grenoble – Clelles – Veynes) are
  buses and remain on the map.
- Other route types are unaffected, including trams, metro, funiculars and cable
  cars, which no rail overlay covers.
- The build summary SHALL report, per network, how many rail routes it left out, so
  a feed that starts bundling trains is visible.
- Once rebuilt, the 32 Zou trains, K24 among them, leave the bus overlay, place
  search and Explore. Their ledger entries are not archived as if withdrawn.

Of the 63 networks, only Zou publishes rail routes today; the rule applies to all.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `transit-provider-catalog`: "Whole feeds, whatever files they ship" gains the
  rule that a bus network's build excludes rail routes.
- `scheduled-data-refresh`: "An unchanged feed is not rebuilt" also requires an
  unchanged build version, so a rule change reaches every provider.

## Impact

- `scripts/transit/build.mjs`: filter routes by `route_type` before trips, stops
  and shapes are derived; count the exclusions in the job summary.
- `scripts/transit/lib/`: a small route-type helper, with tests.
- `scripts/transit/lib/ledger.mjs`: routes left out by type must not be archived.
- `meta.json` gains a `build_version`, so a change to the build's rules rebuilds
  every provider once even when its feed is unchanged.
- Data: the next Data run rebuilds `zou`; the place index and Explore index follow.
- No change to the app code, the data schema, or other networks' output.
