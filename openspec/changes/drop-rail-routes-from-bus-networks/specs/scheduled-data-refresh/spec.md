## MODIFIED Requirements

### Requirement: An unchanged feed is not rebuilt

Each provider's `meta.json` SHALL record a content hash of the feed it was built
from and the `build_version` of the transit build that produced it. The
`build_version` SHALL change whenever the build's output rules change. When a
refresh downloads a feed whose hash matches and the recorded `build_version` is
the current one, the provider SHALL be reported as skipped and its line and stop
artifacts left untouched; otherwise it SHALL be rebuilt.

#### Scenario: A feed that has not been republished
- **WHEN** a provider's downloaded feed is byte-identical to the one used
  for its last build, by the current build version
- **THEN** no rebuild MUST occur and its artifacts MUST keep their bytes

#### Scenario: A provider with no recorded hash
- **WHEN** a provider has never recorded a feed hash
- **THEN** it MUST be rebuilt, so the skip path can never suppress a first
  build

#### Scenario: The build's rules changed
- **WHEN** a provider's feed is unchanged but its `meta.json` records an older
  `build_version`, or none
- **THEN** it MUST be rebuilt, so a rule change reaches every provider
