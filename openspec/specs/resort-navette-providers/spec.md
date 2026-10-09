# resort-navette-providers Specification

## Purpose
Ski-resort and valley shuttle (navette) networks as transit providers, and which of their feeds are usable on the map.
## Requirements
### Requirement: Resort navette provider registration

The system SHALL register one provider per resort navette feed, each conforming
to the `public-transit` `ProviderConfig` interface, each `displayDefaultOn:
false`, each selecting `detectReservationDefault` as its reservation predicate, and
each with an attribution crediting its own publisher and license and linking to
its transport.data.gouv.fr dataset page. The providers are:

| id | label | territory |
| --- | --- | --- |
| `funiculaire-arcs` | Funiculaire des Arcs | Bourg-Saint-Maurice ↔ Arc 1600 |
| `navettes-belleville` | Navettes Belleville | Vallée des Belleville (73) |
| `navettes-giffre` | Navettes du Giffre | Samoëns, Sixt-Fer-à-Cheval (74) |
| `navette-chorges` | Navette Chorges–Chanteloube | Serre-Ponçon (05) |
| `navettes-courchevel` | Navettes Courchevel | Courchevel (73) |
| `navettes-alpe-dhuez` | Navettes Alpe d'Huez | Oisans (38) |
| `navettes-2-alpes` | Navettes Les 2 Alpes | Oisans (38) |
| `navettes-vai-serre-poncon` | Vaï (Serre-Ponçon) | Les Orres, Crévoux, Réallon (05) |
| `navettes-bourg-saint-maurice` | Navettes Bourg-Saint-Maurice | Haute-Tarentaise (73) |
| `navettes-tignes` | Navettes Tignes | Tignes (73) |
| `transaltitude-isere` | Transaltitude (Isère) | Vercors & Oisans stations (38) |
| `navettes-val-disere` | Navettes Val d'Isère | Val d'Isère (73) |
| `valmobus-valmorel` | Valmobus (Valmorel) | Valmorel, La Léchère (73) |
| `navettes-queyras` | Navettes Guillestrois-Queyras | Queyras (05) |
| `meribus-meribel` | Méribus (Méribel) | Méribel (73) |
| `navette-restonica` | Navette Restonica (Corte) | Vallée de la Restonica (2B) |

#### Scenario: Provider is registered and toggled

- **WHEN** the user toggles any resort navette provider on
- **THEN** the lines and stops from `public/transit/<id>/{lines.pmtiles,
  stops.geojson}` SHALL appear on the map in that provider's color, and the
  MapLibre attribution control SHALL include its attribution string

#### Scenario: Default off on first load

- **WHEN** a user opens the app with no persisted selection for a navette
  provider
- **THEN** that overlay SHALL NOT render until the user enables its pill

#### Scenario: Trailhead last-mile is covered

- **WHEN** the user enables the navette providers and pans to the Tarentaise
- **THEN** the shuttles linking the Bourg-Saint-Maurice railhead to Les Arcs,
  Tignes, Val d'Isère, Méribel, Courchevel, Valmorel and the Vallée des
  Belleville SHALL be visible

### Requirement: Navette colors read as local shuttles

Every resort navette provider SHALL take its line color from the Tailwind 200 or
300 tier, so that the dense local shuttles are visually subordinate to the
400-tier departmental networks they connect to, and no two navette providers
that are co-visible in the same valley SHALL share a color.

#### Scenario: Tarentaise providers are mutually distinguishable

- **WHEN** the user enables the eight Tarentaise-area navette providers together
- **THEN** each SHALL render in a distinct hue — amber-200, green-300, red-300,
  orange-200, blue-300, emerald-300, indigo-300 and fuchsia-200 respectively

### Requirement: Feeds without usable geometry are not registered

A navette feed SHALL NOT be registered as a provider when it ships no
`shapes.txt`, when no trip references a non-empty `shape_id`, or when it
contains no routes at all — the build pipeline drops routes with no shape
variant, so such a provider would render as an empty overlay.

#### Scenario: La Rosière is excluded

- **WHEN** the "Navettes estivales La Rosière" feed is evaluated
- **THEN** it SHALL NOT be registered, because none of its 49 trips carries a
  `shape_id` and it ships no `shapes.txt`

#### Scenario: Bagnères–La Mongie is excluded

- **WHEN** the "Navettes Bagnères-de-Bigorre - La Mongie" feed is evaluated
- **THEN** it SHALL NOT be registered, because the published feed contains zero
  routes and zero trips

