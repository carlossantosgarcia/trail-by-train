# transit-provider-catalog Specification

## Purpose
The rules governing which GTFS feed represents a French region, how providers
are grouped and coloured, and what happens when one is retired. Created by
archiving change add-national-bus-coverage.

## Requirements
### Requirement: One feed per region, chosen by a stated precedence

Every provider SHALL be selected by a stated precedence rather than by
convenience, so that the next region added follows the same rule and a publisher
reshuffling its datasets has a defined answer. In order:

1. The official **region-wide interurban** feed published by the regional
   authority.
2. Failing that, the authority's **departmental interurban** feeds.
3. An **aggregate** feed that bundles urban networks with interurban ones SHALL
   NOT be used, even when it is the largest or most convenient dataset: it is out
   of the interurban scope, and it collapses many operators under one attribution
   so that the weekly refresh report cannot name which sub-network broke.
4. An **experimental** feed SHALL NOT be used when a stable feed covers the same
   territory.

#### Scenario: A region offers a region-wide feed and departmental feeds

- **WHEN** Grand Est publishes both a region-wide Fluo feed and ten departmental
  Fluo feeds
- **THEN** the region-wide feed SHALL be registered, and the departmental feeds
  SHALL NOT

#### Scenario: A region offers an aggregate covering more networks

- **WHEN** Bretagne publishes `breizhgo-car` alongside `Korrigo`, an aggregate of
  every Breton urban and interurban network
- **THEN** `breizhgo-car` SHALL be registered despite covering fewer lines, and
  `Korrigo` SHALL NOT

#### Scenario: A candidate feed ships no usable geometry

- **WHEN** a region's only interurban feed ships no `shapes.txt`, or ships one
  from which no route yields usable geometry
- **THEN** that region SHALL be left uncovered and recorded as a known gap with
  the reason, and geometry SHALL NOT be fabricated from stop sequences

### Requirement: Providers declare their region

Every entry in the provider catalog SHALL carry a `region` naming the French
administrative region it serves, and `ProviderConfig` SHALL expose it to the
runtime. This is what the picker groups by; without it the grouping would be
re-derived from labels, which do not reliably contain the region.

A provider spanning several regions SHALL declare the region of the authority
that publishes it, not a list.

#### Scenario: Every provider is groupable

- **WHEN** the provider catalog is read
- **THEN** every entry SHALL have a non-empty `region`

### Requirement: Line colours may repeat only between non-adjacent regions

Two providers SHALL share a `lineColor` only when their regions are **not
adjacent**, and two providers in the same region SHALL always differ. Colour
reuse is therefore bounded by geography, so that two same-coloured providers can
never plausibly be on screen together.

Reuse is permitted at all because sixty-two mutually distinguishable line
colours, legible over both topographic and satellite basemaps in both themes,
are not achievable — and what matters is telling apart what is visible at once.

Providers already registered SHALL keep their current `lineColor` when new
providers are added, so that adding coverage never repaints a map a user already
knows.

This is a review obligation, not a machine-checked one: the contrast gate covers
`src/tokens.css` and does not inspect provider colours.

#### Scenario: A new provider reuses a distant hue

- **WHEN** a Breton provider is assigned the same hex as an Alpine provider
- **THEN** this SHALL be permitted, because Bretagne and Auvergne-Rhône-Alpes are
  not adjacent

#### Scenario: A new provider collides with a neighbour

- **WHEN** a new Normandie provider is assigned the same hex as an existing
  Hauts-de-France or Centre-Val de Loire provider
- **THEN** the assignment SHALL be rejected and a different hue chosen

### Requirement: Retiring a provider does not break a returning user

Persisted user state referencing a retired provider id SHALL be ignored on load
rather than treated as an error, and the app SHALL render normally with the
remaining providers. This applies whenever a provider leaves the catalog —
because a region-wide feed supersedes it, or because its feed died permanently.

The superseding provider SHALL start a fresh line ledger rather than inheriting
the retired provider's, because `route_id`s from a different publisher export do
not correspond and merging them would present one operator's ids as another's
history.

#### Scenario: A user returns with toggles for retired providers

- **WHEN** a user who had `fluo-vosges` and `fluo-bas-rhin` enabled, with a
  custom colour on one of them, loads the app after those providers are retired
- **THEN** the stale entries SHALL be discarded silently, the app SHALL load, and
  no error SHALL surface

#### Scenario: A retired provider's ledger is not merged forward

- **WHEN** `fluo-grand-est` is built for the first time
- **THEN** it SHALL begin an empty ledger, and SHALL NOT import entries from
  `fluo-vosges`, `fluo-haut-rhin` or `fluo-bas-rhin`
