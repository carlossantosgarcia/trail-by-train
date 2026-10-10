## Context

`public/rail-stations.geojson` was a jq transform of SNCF's "Liste des gares"
(`voyageurs = O`). That register describes infrastructure, not service, and SNCF
stopped updating it in March 2022. SNCF publishes three better sources, all ODbL:

| Source | What it says | Gaps |
| --- | --- | --- |
| SNCF timetables, GTFS (TER, TGV, IC, OUIGO…) | who stops where, the next ~6 months | no RER/Transilien; summer-only lines missing in winter |
| Transilien timetables, GTFS | the Île-de-France network, RER A and B included | no UIC codes |
| Gares de voyageurs (Gares & Connexions) | stations open to passengers, updated daily | a few request halts (Train Jaune) |

## Decisions

- **Union of "a train calls" and "SNCF lists it".** Timetables alone would drop the
  Quiberon line every winter. The list alone would miss the halts it lacks and put
  no check on it. Of its 2,792 entries, 72 have no train in the timetables, and
  all 72 are tram-trains, seasonal lines or lines shut for works, so its entries
  are trusted as they are. A 12-month memory of past timetables was considered and
  dropped: the list already covers seasonal stations, without extra state.
- **Train, not coach.** SNCF's feed mixes coaches into rail routes. A stop point is
  counted only when its own mode is not `Car` or `Navette`, so a station served
  only by replacement coaches (Quillan, Autun, Vervins) is left out unless SNCF
  still lists it.
- **Merge order: SNCF timetables, Transilien timetables, the list.** The first
  source wins the name and position. Merge rules: always within 50 m (Ancenis and
  "Ancenis Bis" share one point); across sources, the same UIC, within 150 m, or
  the same normalised name within 400 m. Within one source, distinct UIC codes stay
  distinct, so Auber and Haussmann Saint-Lazare (250 m apart) both remain.
- **Register for communes only, never positions.** A row lends its commune only
  within 1 km of the station, so Grasse does not inherit MARSEILLE. The rest are
  asked of geo.api.gouv.fr, the source search already uses for communes. A station
  in no French commune is out of scope and dropped.
- **Guard against broken sources.** Fewer than 2,000 stations from the timetables
  or the list aborts the build. The previous file stays, as for a failing bus feed.

## Risks

- The list may one day keep a closed station. It is maintained daily and showed
  none today; a later change could cross-check it against timetable history if
  that happens.
- Timetable names differ slightly from the register's ("Saint-" in full,
  "Marseille Saint-Charles"). Search matches them the same way.
