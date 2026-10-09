# terrain-elevation Specification

## Purpose
How the application derives ground elevation for a polyline that carries no
`<ele>` of its own: IGN's RGE ALTI digital elevation model, queried on
demand through the Géoplateforme altimetry service, with its own resampling
and D+/D- tuning kept separate from the recorded-elevation path.

## Requirements

### Requirement: Terrain elevation comes from IGN's altimetry service

The application SHALL derive ground elevation for a polyline by querying
IGN's Géoplateforme altimetry service (RGE ALTI, Licence Ouverte 2.0) from
the browser. The service is keyless and CORS-open, so no proxy, key or
self-hosted elevation data SHALL be required to deploy the application.
The service SHALL be contacted only for tracks whose file carried no
usable elevation. The sampler SHALL be isolated behind a module boundary
(`src/features/terrain/ignAltimetry.mjs`) so the source can change
without altering its callers.

#### Scenario: Elevation is sampled for a polyline inside France
- **WHEN** the application requests terrain elevation for a polyline
  lying within RGE ALTI coverage
- **THEN** it MUST return one elevation value in metres per requested
  sample point, in the same order as the input

#### Scenario: Requests are batched within the service limit
- **WHEN** a track needs more sample points than one request accepts
  (5000)
- **THEN** the sampler MUST split them into sequential requests of at
  most 5000 points and reassemble the results in input order

#### Scenario: Recorded tracks make no request
- **WHEN** a loaded GPX carries its own `<ele>` values
- **THEN** no request MUST be issued to the altimetry service for it

### Requirement: Track vertices are sampled no finer than the model

Elevation for a track's own vertices SHALL be queried only at vertices at
least 25 m apart along the track (plus the first and last), and
interpolated by along-track distance in between. RGE ALTI at ~27 m/px was
measured to be as accurate for D+/D− as its native 1–5 m model, so finer
sampling only multiplies requests. D+/D− SHALL be computed from the
uniform 50 m series, not from the interpolated vertices.

#### Scenario: A dense recording needs few requests
- **WHEN** a 60 km track recorded with a vertex every few metres is
  enriched
- **THEN** the sampler MUST send at most a few thousand points, not one
  per vertex

#### Scenario: Interpolation never crosses missing coverage
- **WHEN** one of two consecutive sampled vertices has no elevation
- **THEN** the vertices between them MUST be left without elevation
  rather than interpolated

#### Scenario: Terrain mode meets the accuracy budget
- **GIVEN** the reference fixtures in `test_data/` with their `<ele>`
  values ignored
- **WHEN** `npm run bench:elevation -- --dem` re-derives elevation from
  the service and computes D+/D− with the terrain tuning
- **THEN** the mean absolute percentage error MUST be at most 10 % for D+
  and for D−, and the worst-case absolute percentage error at most 20 %

### Requirement: An unavailable service fails loudly

The application SHALL report an unreachable or failing altimetry service
as such, with a retry, rather than behaving as though the terrain had no
data. Transient failures (HTTP 429 and 5xx, network errors) SHALL be
retried with backoff before being reported.

#### Scenario: Service unreachable
- **WHEN** the altimetry service cannot be reached after retries
- **THEN** enriching a track MUST surface an error identifying the
  service as unavailable, and MUST NOT report the track as flat or as
  outside coverage

#### Scenario: A track survives a service failure
- **WHEN** elevation cannot be derived because the service is unavailable
- **THEN** the track MUST still be added, rendered and persisted, and
  MUST be marked as awaiting elevation with a way to retry

### Requirement: Uniform arc-length resampling before terrain sampling

Terrain elevation SHALL be sampled at points spaced uniformly along the
polyline by distance travelled, not at the polyline's own vertices, so that
the resulting D+/D− depends on the terrain rather than on how densely the
producing tool happened to emit vertices. The base sampling interval SHALL
be 10 m.

#### Scenario: Sample spacing is independent of vertex density

- **WHEN** two GPX files describe the same physical path but one emits a
  vertex every 7 m and the other only at direction changes
- **THEN** both MUST be resampled to the same 10 m spacing before terrain
  sampling, and their reported D+/D− MUST agree to within the accuracy
  budget

#### Scenario: The final point is preserved

- **WHEN** a polyline's total length is not an exact multiple of the
  sampling interval
- **THEN** the resampled series MUST still include the polyline's final
  coordinate, so the profile spans the whole route

### Requirement: D+/D− tuning for terrain-derived elevation series

Ascent and descent computed from a terrain-derived elevation series SHALL
use tuning parameters distinct from those used for elevation recorded in the
GPX file. A terrain-derived series SHALL be decimated from the 10 m base
grid to a 50 m spacing and evaluated with a smoothing window of 0 m and a
hysteresis threshold of 5 m, using the same `computeAscentDescentMeters`
algorithm as recorded elevation.

These values SHALL be named constants in `src/features/terrain/constants.mjs`,
so they can be re-tuned without changing the algorithm, as the
recorded-elevation parameters are.

#### Scenario: Terrain series uses terrain tuning

- **WHEN** D+/D− is computed for a track whose elevation was derived from
  terrain
- **THEN** the computation MUST use the 50 m decimated series with
  window 0 m and threshold 5 m, and MUST NOT use the recorded-elevation
  defaults

#### Scenario: Recorded series is unaffected

- **WHEN** D+/D− is computed for a track whose elevation came from the
  file's own `<ele>` values
- **THEN** the computation MUST use the recorded-elevation smoothing
  window and hysteresis threshold, unaffected by the terrain model

### Requirement: Coverage limits and no-data masking

The application SHALL treat cells marked as no-data, and any value outside a
plausible range for the covered terrain, as missing rather than as a real
elevation, and MUST NOT present a fabricated figure for terrain it has no
data for. RGE ALTI covers France (métropole and DOM) only, so routes outside
or straddling that coverage are an expected case rather than an error.

The service answers -99999 outside coverage, and RGE ALTI also carries
interpolation artifacts near coverage edges that are neither plausible
terrain nor that sentinel, so masking SHALL be by plausible-range check, not
by sentinel value alone.

#### Scenario: Implausible edge values are masked

- **WHEN** the source data yields a value far outside the plausible range
  for French terrain, such as a large negative elevation near a coverage
  boundary
- **THEN** that sample MUST be treated as no-data and MUST NOT contribute a
  spurious ascent or descent

#### Scenario: A route partially outside coverage

- **WHEN** a route crosses the French border so that some samples resolve
  and others fall on no-data cells
- **THEN** the application MUST report D+/D− accumulated over the covered
  portions only, MUST NOT interpolate elevation across the uncovered gap,
  and MUST indicate that the profile is partial

#### Scenario: A route entirely outside coverage

- **WHEN** no sample point in a route resolves to a real elevation
- **THEN** the application MUST report the track's elevation as unavailable
  rather than reporting D+ and D− of 0, since a flat profile would be a
  wrong answer presented as a real one

### Requirement: Terrain-derived elevation is persisted

Terrain-derived elevation SHALL be stored alongside the track geometry in
the browser's persistent storage, so that a given track is sampled at most
once and its profile survives reloads.

#### Scenario: Elevation survives a reload

- **WHEN** a track enriched from terrain is reloaded after a page refresh
- **THEN** its elevation profile and D+/D− MUST be restored from local
  storage without querying the service again

### Requirement: Elevation provenance is visible to the user

The application SHALL record and surface where each track's elevation came
from — the file's own `<ele>`, the terrain model, or unavailable — because a
terrain-derived profile describes the ground beneath the drawn line rather
than what a device measured while walking. The RGE ALTI source SHALL be
credited in the map attribution when terrain-derived elevation is in use.

#### Scenario: A terrain-enriched track is labelled

- **WHEN** a track's elevation was derived from the terrain model
- **THEN** the UI MUST indicate that its elevation is terrain-derived rather
  than recorded

#### Scenario: A recorded track is not relabelled

- **WHEN** a track carries its own `<ele>` values
- **THEN** the UI MUST NOT describe its elevation as terrain-derived

#### Scenario: Attribution credits the elevation source

- **WHEN** any loaded track's elevation is terrain-derived
- **THEN** the map attribution MUST credit IGN RGE ALTI in addition to the
  existing basemap attribution
