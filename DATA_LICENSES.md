# Data sources and licences

The **code** in this repository is MIT-licensed (see `LICENSE`). The **data**
the app shows comes from the open sources below, each under its own licence.
Every source is credited in the map's attribution control while its layer is
shown; keep it that way when adding or changing a layer.

Generated datasets are not committed. The Data workflow builds them and
publishes them on the [`data-latest` release](../../releases/tag/data-latest).
Where a dataset is derived from an ODbL source, the published files are
themselves made available under the **ODbL 1.0**, as share-alike requires.

## Shipped datasets (built by `scripts/`, published on `data-latest`)

| Layer                                 | Source                                                                                                                                                                     | Licence                                                                   | Built by                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| Rail network                          | [SNCF Réseau — Lignes par statut](https://ressources.data.sncf.com/explore/dataset/lignes-par-statut/) (`statut = Exploitée`)                                              | ODbL                                                                      | `scripts/build-rail-tiles.sh`    |
| Rail stations                         | [SNCF — Liste des gares](https://ressources.data.sncf.com/explore/dataset/liste-des-gares/) (`voyageurs = O`)                                                              | ODbL                                                                      | `scripts/build-rail-stations.sh` |
| Bus and coach networks (63 providers) | GTFS feeds via [transport.data.gouv.fr](https://transport.data.gouv.fr/) — licence, source and attribution recorded per provider in `scripts/transit/providers.config.mjs` | 39 ODbL · 21 Licence Ouverte 2.0 · 3 Licence Ouverte presumed (see below) | `scripts/transit/build.mjs`      |
| GR trails                             | [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass                                                                                                      | ODbL                                                                      | `scripts/gr/`                    |
| Place search                          | [GeoNames](https://www.geonames.org/) FR dump; [API Découpage administratif](https://geo.api.gouv.fr/) (communes); the rail and transit datasets above                     | CC-BY 4.0; Licence Ouverte 2.0                                            | `scripts/search/build-index.mjs` |

**Presumed Licence Ouverte.** Three Hauts-de-France feeds (`hdf-nord-59`,
`hdf-oise-60`, `hdf-somme-80`) state no licence. French law (loi
d'orientation des mobilités, art. 25; Code des transports L.1115-1) requires
public transport data on the national access point to be published as open
data, so they are treated as Licence Ouverte 2.0 and credited to their
publisher. If a producer states otherwise, update its entry.

**GR®** is a registered trademark of the [Fédération Française de la
Randonnée Pédestre](https://www.ffrandonnee.fr/). GR routes are shown from
OpenStreetMap data, which may differ from the official waymarking; the GR
popup links to the official route on [MonGR.fr](https://www.mongr.fr/). This
project is not affiliated with or endorsed by the FFRandonnée.

## Fetched at runtime

| Use                                      | Service                                                                                                                               | Licence / terms                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Satellite basemap                        | [IGN Géoplateforme](https://geoservices.ign.fr/) — ORTHOIMAGERY.ORTHOPHOTOS                                                           | Licence Ouverte 2.0                                                                                      |
| Elevation for GPX files without altitude | [IGN Géoplateforme altimetry service](https://geoservices.ign.fr/documentation/services/services-geoplateforme/altimetrie) — RGE ALTI | Licence Ouverte 2.0                                                                                      |
| Topographic basemap                      | [OpenTopoMap](https://opentopomap.org/)                                                                                               | Data ODbL (OSM), rendering CC-BY-SA 3.0; subject to OpenTopoMap's tile usage policy                      |
| Street basemap                           | [OpenStreetMap tiles](https://www.openstreetmap.org/)                                                                                 | Data ODbL; subject to the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/) |

The public OSM and OpenTopoMap tile servers are donation-funded and meant
for light use. A popular deployment should move these basemaps to its own
or a commercial tile provider.

## Hikes

Hikes are shown with their author's agreement and always credit and link to
them. Tracks shared by contributors (`"source": "community"`, in
`public/curated/tracks/`) are published under
[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
