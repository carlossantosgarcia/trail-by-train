// Single source of truth for every transit provider: the build pipeline reads
// these entries to produce public/transit/<id>/, and the app
// (src/transit/providers.ts) derives its provider list from them — label,
// region, attribution, colour, default visibility, asset URLs and the
// timetable link. Order here is the map's layer order.
//
// To add a new provider:
//   1. Append a config entry below.
//   2. Run `npm run build:transit -- <id>` to produce its artifacts.

import {
  detectReservationDefault,
  detectReservationFlexibleOr715WithReservation,
} from './lib/reservation.mjs';

export const PROVIDERS = [
  {
    id: 'cars-isere',
    label: 'Cars Région Isère',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=ISERE&dataFormat=gtfs',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-isere-38-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-isere-38-1" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — cars Région Isère</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#facc15',
    timetable: { search: 'cars région isère' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'zou',
    label: 'Zou! Express (Région Sud)',
    region: "Provence-Alpes-Côte d'Azur",
    gtfsUrl: 'https://www.datasud.fr/fr/dataset/datasets/3743/resource/5153/download/',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-express-3-3',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-express-3-3" target="_blank" rel="noopener">Région Sud Provence-Alpes-Côte d\'Azur — Zou! Express</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    lineColor: '#fb923c',
    timetable: { search: 'zou région sud' },
    // feed_info.txt omitted — the datasud export stopped shipping one
    // (noticed on the 2026-07-30 refresh), so validFrom/validTo default
    // to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    // Rail routes kept although bus networks leave trains out: the Chemins de
    // fer de Provence (Nice – Digne, the "Train des Pignes", line 49) is not
    // part of the SNCF network the rail overlay draws, so without this the
    // line and its stations would be on no layer at all.
    keepRailRoutes: ['CFP:'],
    displayDefaultOn: false,
  },
  {
    id: 'cars-savoie',
    label: 'Cars Région Savoie',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-savoie-73',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-savoie-73" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Savoie</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#22d3ee',
    timetable: { search: 'cars région savoie' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-haute-savoie',
    label: 'Cars Région Haute-Savoie',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-savoie-74',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-savoie-74" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Haute-Savoie</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#f472b6',
    timetable: { search: 'cars région haute-savoie' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-region-drome',
    label: 'Cars Région Drôme',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=DROME&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-et-scolaire-cars-region-drome-26',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-et-scolaire-cars-region-drome-26" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Drôme</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind violet-400, distinct from existing four.
    lineColor: '#a78bfa',
    timetable: { search: 'cars région drôme' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'zou-proximite',
    label: 'Zou! Proximité (Région Sud)',
    region: "Provence-Alpes-Côte d'Azur",
    gtfsUrl: 'https://www.datasud.fr/fr/dataset/datasets/3745/resource/5016/download/',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-proximite-3-3',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-proximite-3-3" target="_blank" rel="noopener">Région Sud Provence-Alpes-Côte d\'Azur — Zou! Proximité</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind rose-400 — sibling tone to Zou! Express's orange.
    lineColor: '#fb7185',
    timetable: { search: 'zou proximité' },
    // feed_info.txt omitted — the datasud export stopped shipping one
    // (noticed on the 2026-07-30 refresh), so validFrom/validTo default
    // to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'tag-grenoble',
    label: 'M Tag (Grenoble)',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl: 'https://data.mobilites-m.fr/api/gtfs/SEM',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tag',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tag" target="_blank" rel="noopener">Grenoble-Alpes Métropole — Réseau TAG</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind emerald-400.
    lineColor: '#34d399',
    timetable: { search: 'tag grenoble' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'pays-voironnais',
    label: 'Pays Voironnais',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl: 'https://data.mobilites-m.fr/api/gtfs/TPV',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transport-du-pays-voironnais',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transport-du-pays-voironnais" target="_blank" rel="noopener">CA du Pays Voironnais — Réseau urbain Transports du Pays Voironnais</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind green-400 — adjacent green for adjacent Grenoble-area network.
    lineColor: '#4ade80',
    timetable: { search: 'pays voironnais' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // Third and last of SMMAG's "M Réso" territory feeds, alongside SEM (M Tag)
  // and TPV (Pays Voironnais) above. Carries the N93–N99 "Destinations Nature"
  // lines to Chamrousse, Les 7 Laux, Le Super Collet, Le Pleynet and the
  // Plateau des Petites Roches — the Belledonne/east-Chartreuse trailheads.
  {
    id: 'mreso-gresivaudan',
    label: 'M Réso Grésivaudan',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl: 'https://data.mobilites-m.fr/api/gtfs/GSV',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tougo',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-tougo" target="_blank" rel="noopener">CC Le Grésivaudan — Réseau Tougo / M Réso Grésivaudan</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind fuchsia-300 — the two sibling M Réso networks and Cars Région
    // Isère (the providers a user enables alongside this one) are emerald,
    // green and yellow; fuchsia reads clearly against all three, against the
    // rail overlay's purple, and over satellite imagery.
    lineColor: '#f0abfc',
    // reso-m.fr addresses every line as <agency>:<short_name>, so lines get
    // a real timetable link instead of a web search.
    timetable: { resoM: 'GSV', indexUrl: 'https://www.reso-m.fr/61-lignes-et-horaires.htm' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    // Every route is route_type 3 and there is no route_desc column, so the
    // interurban 715+réservation variant has nothing to match. The FLEXO
    // reservation lines encode their rules in GTFS-Flex booking_rules.txt,
    // which this route-level predicate does not read — see design.md D3.
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // Third M Réso feed: the périurbain Proximo / Chrono / Flexo lines (agency
  // SE2) — includes 86 Allevard ↔ Grenoble, which neither GSV nor the cars
  // Région feeds carry. Unlike its siblings it is NOT catalogued on
  // transport.data.gouv.fr, so source and attribution point at mobilites-m.fr.
  // The feed states no licence: ODbL is assumed from the publisher's other
  // feeds — revisit if it clarifies.
  {
    id: 'mreso-grenoble-peri',
    label: 'M Réso périurbain',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl: 'https://data.mobilites-m.fr/api/gtfs/SE2',
    sourceUrl: 'https://www.mobilites-m.fr/',
    license: 'ODbL',
    attribution:
      '© <a href="https://www.mobilites-m.fr/" target="_blank" rel="noopener">Mobilités M — réseau M Réso (lignes périurbaines Proximo / Chrono / Flexo)</a> (ODbL), via data.mobilites-m.fr',
    // Tailwind indigo-500 — unused elsewhere in the catalog; the Grenoble-area
    // siblings are emerald, green, yellow and fuchsia, the rail overlay purple.
    lineColor: '#6366f1',
    // reso-m.fr addresses every line as <agency>:<short_name>, so lines get
    // a real timetable link instead of a web search.
    timetable: { resoM: 'SE2', indexUrl: 'https://www.reso-m.fr/61-lignes-et-horaires.htm' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    // The "lignes privées Corse" dataset this provider was built from was
    // withdrawn (its resource now 404s, noticed on the 2026-07-30 refresh) and
    // replaced by the island-wide "Réseau interurbain - Corse" (Via Strada)
    // feed, which covers 2A as well as 2B — hence the widened label. The id is
    // kept as-is because it keys layer ids, localStorage and asset paths.
    id: 'cars-haute-corse',
    label: 'Corse — Via Strada',
    region: 'Corse',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/gtfs-transport-via-strada/20260707-125009/via-strada.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/gtfs-transport-via-strada',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/gtfs-transport-via-strada" target="_blank" rel="noopener">Collectivité de Corse — Réseau interurbain Corse (Via Strada)</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind purple-400.
    lineColor: '#c084fc',
    timetable: { search: 'via strada corse' },
    // feed_info.txt omitted — this Collectivité de Corse feed doesn't ship one
    // (feed_info is conditionally optional per the GTFS spec). The build
    // pipeline already supports its absence; validFrom/validTo just default
    // to null in meta.json.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'synchro-chambery',
    label: 'Synchro (Grand Chambéry)',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://mwe.mecatran.com/utw/ws/gtfsfeed/static/chambery?apiKey=223f2f102c1242570d3f0231326a271940774f72&type=gtfs_urbain',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/arrets-et-horaires-theoriques-bus/',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-et-horaires-theoriques-bus/" target="_blank" rel="noopener">CA du Grand Chambéry — Réseau Synchro Bus</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind blue-400 — distinct from the nine existing providers.
    lineColor: '#60a5fa',
    timetable: { search: 'synchro grand chambéry' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'lio-occitanie',
    label: 'liO Occitanie',
    region: 'Occitanie',
    gtfsUrl:
      'https://app.mecatran.com/utw/ws/gtfsfeed/static/lio?apiKey=2b160d626f783808095373766f18714901325e45&type=gtfs_lio',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/reseau-lio-occitanie',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-lio-occitanie" target="_blank" rel="noopener">Région Occitanie — Réseau interurbain liO</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind teal-400 — distinct cool tone for the central/eastern Pyrenees.
    lineColor: '#2dd4bf',
    timetable: { search: 'lio occitanie' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'cars-region-64',
    label: 'Cars Régionaux 64 (Pyrénées-Atl.)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl:
      'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/pyrenees_atlantiques-aggregated-gtfs.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-pat-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-pat-nva-m-1" target="_blank" rel="noopener">Nouvelle-Aquitaine Mobilités — Cars Régionaux 64</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind red-400 — warm tone for the western Pyrenees (Béarn).
    lineColor: '#f87171',
    timetable: { search: 'cars régionaux 64 pyrénées-atlantiques' },
    // feed_info.txt omitted — the Pigma/NA Mobilités aggregated feed doesn't
    // ship one (conditionally optional per the GTFS spec, same as
    // cars-haute-corse). validFrom/validTo default to null in meta.json.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // ── Massif Central (Auvergne-Rhône-Alpes "Cars Région" departments) ──
  // Same Oura/Cityway open-data API as Isère/Savoie/Drôme; each department
  // publishes under its own provider token. Verified working 2026-07-10.
  {
    id: 'cars-ardeche',
    label: 'Cars Région Ardèche',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=ARDECHE&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ardeche-07',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ardeche-07" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Ardèche</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind amber-400 — warm gold for the Monts d'Ardèche.
    lineColor: '#fbbf24',
    timetable: { search: 'cars région ardèche' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-puy-de-dome',
    label: 'Cars Région Puy-de-Dôme',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=PUY_DE_DOME&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-puy-de-dome-63',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-puy-de-dome-63" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Puy-de-Dôme</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind orange-500 — Chaîne des Puys / Sancy.
    lineColor: '#f97316',
    timetable: { search: 'cars région puy-de-dôme' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-cantal',
    label: 'Cars Région Cantal',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CAR_REGION_CANTAL&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-cantal-15',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-cantal-15" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Cantal</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind red-500 — Monts du Cantal / Puy Mary.
    lineColor: '#ef4444',
    timetable: { search: 'cars région cantal' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-haute-loire',
    label: 'Cars Région Haute-Loire',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_LOIRE&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-loire-43',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-haute-loire-43" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Haute-Loire</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind pink-500 — Mézenc / Velay.
    lineColor: '#ec4899',
    timetable: { search: 'cars région haute-loire' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-loire',
    label: 'Cars Région Loire',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CARS_REGION_LOIRE&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-loire-42',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-loire-42" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Loire</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind lime-400 — Massif du Pilat / Monts du Forez.
    lineColor: '#a3e635',
    timetable: { search: 'cars région loire' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-ain',
    label: 'Cars Région Ain',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CARS_REGION_AIN&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ain-01',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ain-01" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Ain</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind sky-400 — Bugey / Jura méridional.
    lineColor: '#38bdf8',
    timetable: { search: 'cars région ain' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  {
    id: 'cars-allier',
    label: 'Cars Région Allier',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=ALLIER&dataFormat=GTFS&dataProfil=OPENDATA',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-allier-03',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-allier-03" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Cars Région Allier</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind fuchsia-400 — Montagne bourbonnaise.
    lineColor: '#e879f9',
    timetable: { search: 'cars région allier' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationFlexibleOr715WithReservation,
    displayDefaultOn: false,
  },
  // ── Massif des Vosges (Grand Est "Fluo" interurbain departments) ──
  // Région Grand Est Cityway open-data endpoint; one OperatorCode per dept.
  // ── Massif du Jura & Morvan (Bourgogne-Franche-Comté "Mobigo") ──
  // BFC Cityway open-data endpoint; one operatorCode (UTxx) per dept. These
  // feeds ship no feed_info.txt (valid_from/to default to null in meta.json).
  {
    id: 'mobigo',
    label: 'Mobigo Bourgogne-Franche-Comté',
    region: 'Bourgogne-Franche-Comté',
    // The region-wide file, not the per-department Cityway endpoints: it covers
    // all seven départements at once and still ships shapes, which the Jura
    // department feed stopped doing in August 2026.
    gtfsUrl: 'https://www.viamobigo.fr/ftp/zipopendata/ut.gtfs.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-de-transport-interurbain-mobigo-en-bourgogne-franche-comte" target="_blank" rel="noopener">Région Bourgogne-Franche-Comté — Réseau Mobigo</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind teal-500 — carried over from the Jura entry this replaces.
    lineColor: '#14b8a6',
    timetable: { search: 'mobigo' },
    // No calendar.txt: this feed expresses every service day as an explicit
    // calendar_dates exception, which buildServiceWindowsByDayType handles.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // ── Alps: Briançonnais (CC du Briançonnais "Altigo") ──
  // Gateway network for the Écrins / Queyras; small urban+interurbain feed
  // without feed_info.txt.
  {
    id: 'altigo-brianconnais',
    label: 'Altigo (Briançonnais)',
    region: "Provence-Alpes-Côte d'Azur",
    // 2026-09-15 "rentrée 26/27" republish dropped shapes.txt entirely — feed
    // still 404s->builds otherwise fine. Producer already flagged by transport
    // .data.gouv.fr's own validator; nothing to fix on our side but the pin.
    gtfsUrl:
      'https://static.data.gouv.fr/resources/donnees-de-transport-en-commun-reseau-altigo-communaute-de-communes-du-brianconnais-format-gtfs/20260915-153958/gtfs-altigo-rentre-26-27-v6.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/donnees-de-transport-en-commun-reseau-altigo-communaute-de-communes-du-brianconnais-format-gtfs',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/donnees-de-transport-en-commun-reseau-altigo-communaute-de-communes-du-brianconnais-format-gtfs" target="_blank" rel="noopener">CC du Briançonnais — Réseau Altigo</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind red-500 — stands out against the Alpine providers already on
    // the map (none of which use red); distant from Cantal's identical tone.
    lineColor: '#ef4444',
    timetable: { search: 'altigo briançon' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // ── Mercantour gateway (Métropole Nice Côte d'Azur "Lignes d'Azur") ──
  // The Métropole's territory runs far up the Tinée and Vésubie, so this urban
  // feed carries the mountain lines 90/91/92 (La Bolline, Auron, Isola 2000)
  // and 93/94 (Lantosque, Roquebillière) — the bus access to the Mercantour,
  // which zou-proximite does not reach (it stops at 670 Nice–Beuil–Valberg).
  {
    id: 'lignes-azur',
    label: "Lignes d'Azur (Nice)",
    region: "Provence-Alpes-Côte d'Azur",
    gtfsUrl: 'https://chouette.enroute.mobi/api/v1/datas/OpendataRLA/gtfs.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/export-quotidien-au-format-gtfs-du-reseau-de-transport-lignes-d-azur',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/export-quotidien-au-format-gtfs-du-reseau-de-transport-lignes-d-azur" target="_blank" rel="noopener">Métropole Nice Côte d\'Azur — Réseau Lignes d\'Azur</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind sky-300 — the Région Sud providers it shares the map with are
    // orange-400 (zou) and rose-400 (zou-proximite); a cool pastel is
    // unmistakable against both, including over satellite.
    lineColor: '#7dd3fc',
    timetable: { search: "lignes d'azur nice" },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // ── Lac d'Annecy & Bauges (CA du Grand Annecy "Sibra") ──
  // Adds the walking shuttles no other provider carried: 20 to
  // Talloires-Montmin, the seasonal F1/F2 to the Col de la Forclaz under La
  // Tournette, and 41 toward Le Châtelard in the Bauges.
  {
    id: 'sibra-annecy',
    label: 'Sibra (Grand Annecy)',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl: 'https://www.data.gouv.fr/api/1/datasets/r/8b12f6db-9aa7-43dc-a179-013998a1c4c0',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs" target="_blank" rel="noopener">CA du Grand Annecy — Réseau urbain Sibra</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind orange-300 — around Annecy the neighbours are pink-400
    // (Haute-Savoie), cyan-400 (Savoie), sky-400 (Ain) and blue-400
    // (Chambéry); a warm tone is the clear outlier in that group.
    lineColor: '#fdba74',
    timetable: { search: 'sibra annecy' },
    // feed_info.txt omitted — this Sibra feed doesn't ship one, so
    // validFrom/validTo default to null (see cars-haute-corse and the Mobigo
    // providers for the same case).
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  // ── Resort & valley navettes ──
  // Small standalone feeds, one per station or valley, sourced from the
  // operators themselves rather than a departmental network. They fill the
  // last-mile gap between a valley railhead and the trailhead. All use the
  // 200/300 colour tiers so they read as local shuttles next to the
  // 400-tier departmental networks.
  {
    id: 'funiculaire-arcs',
    label: 'Funiculaire des Arcs',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/funiculaire/20260622-125937/gtfs-15-06-2026-funiculaire-ads.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/funiculaire-des-arcs',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/funiculaire-des-arcs" target="_blank" rel="noopener">Communauté de Communes Haute-Tarentaise — Funiculaire des Arcs</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind amber-200.
    lineColor: '#fde68a',
    timetable: { search: 'funiculaire des arcs bourg-saint-maurice' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-belleville',
    label: 'Navettes Belleville',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/skibus-vallee-des-belleville/20260701-134857/gtfs-prod-28062026-0322-4.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/skibus-vallee-des-belleville',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/skibus-vallee-des-belleville" target="_blank" rel="noopener">Transdev Savoie — Navettes Skibus Vallée des Belleville</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind green-300.
    lineColor: '#86efac',
    timetable: { search: 'navettes vallée des belleville les menuires' },
    // feed_info.txt omitted — this feed does not ship one, so
    // validFrom/validTo default to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-giffre',
    label: 'Navettes du Giffre',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/les-navettes-du-giffre-horaires-hiver-2023-2024/20240119-105247/gtfs-les-navettes-du-giffre-2024-v1-valide-pan.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/les-navettes-du-giffre-horaires-hiver-2023-2024',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/les-navettes-du-giffre-horaires-hiver-2023-2024" target="_blank" rel="noopener">Communauté de Communes des Montagnes du Giffre — Navettes du Giffre</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind cyan-300.
    lineColor: '#67e8f9',
    timetable: { search: 'navettes du giffre samoëns sixt' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navette-chorges',
    label: 'Navette Chorges–Chanteloube',
    region: "Provence-Alpes-Côte d'Azur",
    gtfsUrl:
      'https://static.data.gouv.fr/resources/navette-chorges-chanteloube-ete-2026-reseau-vai/20260515-073127/navette-vai-chorges-baie-de-chanteloube-ete-2026.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/navette-chorges-chanteloube-ete-2026-reseau-vai',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/navette-chorges-chanteloube-ete-2026-reseau-vai" target="_blank" rel="noopener">Communauté de communes de Serre-Ponçon — Navettes estivales Chorges - Chanteloube</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind purple-300.
    lineColor: '#d8b4fe',
    timetable: { search: 'navette vaï chorges chanteloube' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-courchevel',
    label: 'Navettes Courchevel',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/skibus-courchevel-hiver/20260703-154441/gtfs-prod-03072026-1051-1.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/skibus-courchevel-hiver',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/skibus-courchevel-hiver" target="_blank" rel="noopener">Transdev Savoie — Navettes hivernales Skibus Courchevel</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind red-300.
    lineColor: '#fca5a5',
    timetable: { search: 'navettes skibus courchevel' },
    // feed_info.txt omitted — this feed does not ship one, so
    // validFrom/validTo default to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-alpe-dhuez',
    label: 'Navettes Alpe d\'Huez',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://zenbus.net/gtfs/static/download.zip?dataset=alpe-huez',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-des-navettes-hivernales-de-lalpe-dhuez-gtfs-gtfs-rt',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-des-navettes-hivernales-de-lalpe-dhuez-gtfs-gtfs-rt" target="_blank" rel="noopener">Zenbus — Navettes hivernales de l\'Alpe d\'Huez</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind teal-300.
    lineColor: '#5eead4',
    timetable: { search: "navettes alpe d'huez" },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-2-alpes',
    label: 'Navettes Les 2 Alpes',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/gtfs-les-2alpes-saison-hiver-2025-2026/20260602-132501/gtfs-navette-annuelle-2-alpes.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/gtfs-les-2alpes-saison-hiver-2025-2026',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/gtfs-les-2alpes-saison-hiver-2025-2026" target="_blank" rel="noopener">Commune Les Deux Alpes — Navettes hivernales des 2 Alpes</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind violet-300.
    lineColor: '#c4b5fd',
    timetable: { search: 'navettes les 2 alpes' },
    // feed_info.txt omitted — this feed does not ship one, so
    // validFrom/validTo default to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-vai-serre-poncon',
    label: 'Vaï (Serre-Ponçon)',
    region: "Provence-Alpes-Côte d'Azur",
    gtfsUrl:
      'https://static.data.gouv.fr/resources/navettes-stations-hiver-2025-2026-reseau-vai/20251230-085133/navettes-stations-vai-hiver-2025-2026.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/navettes-stations-hiver-2025-2026-reseau-vai',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/navettes-stations-hiver-2025-2026-reseau-vai" target="_blank" rel="noopener">Communauté de communes de Serre-Ponçon — Navettes hivernales réseau Vaï</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind pink-300.
    lineColor: '#f9a8d4',
    timetable: { search: 'réseau vaï serre-ponçon navettes' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-bourg-saint-maurice',
    label: 'Navettes Bourg-Saint-Maurice',
    region: 'Auvergne-Rhône-Alpes',
    // Producer republishes under a new filename almost every month (5 times in
    // 2026 so far) — pinned to the stable per-resource redirect instead of a
    // dated snapshot so this stops rotting every few weeks.
    gtfsUrl: 'https://transport.data.gouv.fr/resources/83626/download',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/navettes-bourg-saint-maurice',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/navettes-bourg-saint-maurice" target="_blank" rel="noopener">Communauté de Communes Haute-Tarentaise — Navettes saisonnières Bourg-Saint-Maurice</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind orange-200.
    lineColor: '#fed7aa',
    timetable: { search: 'navettes bourg-saint-maurice les arcs' },
    // feed_info.txt omitted — this feed does not ship one, so
    // validFrom/validTo default to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-tignes',
    label: 'Navettes Tignes',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://zenbus.net/gtfs/static/download.zip?dataset=tignes',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/navettes-tignes',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/navettes-tignes" target="_blank" rel="noopener">Communauté de Communes Haute-Tarentaise — Navettes saisonnières Tignes</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind blue-300.
    lineColor: '#93c5fd',
    timetable: { search: 'navettes tignes' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'transaltitude-isere',
    label: 'Transaltitude (Isère)',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=TRANSALTITUDE&dataFormat=gtfs',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/desserte-des-stations-de-ski-iseroises-transaltitude-38',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/desserte-des-stations-de-ski-iseroises-transaltitude-38" target="_blank" rel="noopener">Région Auvergne-Rhône-Alpes — Navettes saisonnières Transaltitude - Isère</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind rose-300.
    lineColor: '#fda4af',
    timetable: { search: 'transaltitude isère' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-val-disere',
    label: 'Navettes Val d\'Isère',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://zenbus.net/gtfs/static/download.zip?dataset=valdisere',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/navettes-val-disere',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/navettes-val-disere" target="_blank" rel="noopener">Communauté de Communes Haute-Tarentaise — Navettes saisonnières Val d\'Isère</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind emerald-300.
    lineColor: '#6ee7b7',
    timetable: { search: "navettes val d'isère" },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'valmobus-valmorel',
    label: 'Valmobus (Valmorel)',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://zenbus.net/gtfs/static/download.zip?dataset=valmorel',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-de-la-station-de-ski-valmorel-gtfs-gtfs-rt',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/horaires-theoriques-et-temps-reel-de-la-station-de-ski-valmorel-gtfs-gtfs-rt" target="_blank" rel="noopener">Zenbus — Navettes saisonnières Valmobus</a> (ODbL), via transport.data.gouv.fr',
    // Tailwind indigo-300.
    lineColor: '#a5b4fc',
    timetable: { search: 'valmobus valmorel navette' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navettes-queyras',
    label: 'Navettes Guillestrois-Queyras',
    region: "Provence-Alpes-Côte d'Azur",
    gtfsUrl:
      'https://static.data.gouv.fr/resources/reseau-de-transports-collectifs-de-la-ccgq/20260817-083208/gtfsv1.7.4.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/reseau-de-transports-collectifs-de-la-ccgq',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/reseau-de-transports-collectifs-de-la-ccgq" target="_blank" rel="noopener">Communauté de communes du Guillestrois et du Queyras — Navettes saisonnières de la CC du Guillestrois et du Queyras</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind lime-200.
    lineColor: '#d9f99d',
    timetable: { search: 'navettes guillestrois queyras' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'meribus-meribel',
    label: 'Méribus (Méribel)',
    region: 'Auvergne-Rhône-Alpes',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/meribus-hiver/20260619-102403/gtfs.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/meribus-ete',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/meribus-ete" target="_blank" rel="noopener">Transdev Savoie — Navette hivernale Méribus</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind fuchsia-200.
    lineColor: '#f5d0fe',
    timetable: { search: 'méribus méribel navette' },
    // feed_info.txt omitted — this feed does not ship one, so
    // validFrom/validTo default to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'navette-restonica',
    label: 'Navette Restonica (Corte)',
    region: 'Corse',
    gtfsUrl:
      'https://static.data.gouv.fr/resources/gtfs-transport-via-corsica-corte-a-la-vallee-de-la-restonica-ligne-c13/20260727-120808/via-corsica-restonica.zip',
    sourceUrl:
      'https://transport.data.gouv.fr/datasets/gtfs-transport-via-corsica-corte-a-la-vallee-de-la-restonica-ligne-c13',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/gtfs-transport-via-corsica-corte-a-la-vallee-de-la-restonica-ligne-c13" target="_blank" rel="noopener">Collectivité de Corse — Navette estivale Corté - vallée de la Restonica</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    // Tailwind pink-200.
    lineColor: '#fbcfe8',
    timetable: { search: 'navette corte restonica' },
    // feed_info.txt omitted — this feed does not ship one, so
    // validFrom/validTo default to null.
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'breizhgo-car-22',
    label: 'BreizhGo Car (Côtes-d\'Armor)',
    region: 'Bretagne',
    gtfsUrl: 'https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_22.gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/breizhgo-car',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/breizhgo-car" target="_blank" rel="noopener">Région Bretagne — BreizhGo Car Côtes-d\'Armor</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#facc15',
    timetable: { search: "breizhgo car côtes-d'armor" },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'breizhgo-car-29',
    label: 'BreizhGo Car (Finistère)',
    region: 'Bretagne',
    gtfsUrl: 'https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_29.gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/breizhgo-car',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/breizhgo-car" target="_blank" rel="noopener">Région Bretagne — BreizhGo Car Finistère</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#22d3ee',
    timetable: { search: 'breizhgo car finistère' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'breizhgo-car-35',
    label: 'BreizhGo Car (Ille-et-Vilaine)',
    region: 'Bretagne',
    gtfsUrl: 'https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_35.gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/breizhgo-car',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/breizhgo-car" target="_blank" rel="noopener">Région Bretagne — BreizhGo Car Ille-et-Vilaine</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#f472b6',
    timetable: { search: 'breizhgo car ille-et-vilaine' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'breizhgo-car-56',
    label: 'BreizhGo Car (Morbihan)',
    region: 'Bretagne',
    gtfsUrl: 'https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_56.gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/breizhgo-car',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/breizhgo-car" target="_blank" rel="noopener">Région Bretagne — BreizhGo Car Morbihan</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#fb923c',
    timetable: { search: 'breizhgo car morbihan' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'aleop',
    label: 'Aléop (Pays de la Loire)',
    region: 'Pays de la Loire',
    gtfsUrl: 'https://donnees.paysdelaloire.fr/data/pdl.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-circuits-des-lignes-de-transports-aleop-1',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-circuits-des-lignes-de-transports-aleop-1" target="_blank" rel="noopener">Région Pays de la Loire — Aléop</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    lineColor: '#a78bfa',
    timetable: { search: 'aleop pays de la loire' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'nomad-car',
    label: 'Nomad Car (Normandie)',
    region: 'Normandie',
    gtfsUrl: 'https://transport.data.gouv.fr/resources/82317/download',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/nomad-car-region-normandie',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/nomad-car-region-normandie" target="_blank" rel="noopener">Région Normandie — Nomad Car</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    lineColor: '#34d399',
    timetable: { search: 'nomad car normandie' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'remi',
    label: 'Rémi (Centre-Val de Loire)',
    region: 'Centre-Val de Loire',
    gtfsUrl: 'https://fr.ftp.opendatasoft.com/centrevaldeloire/OKINAGTFS/GTFS_AO/REMI.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/remi-offre-theorique-mobilite-reseau-interurbain-regional',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/remi-offre-theorique-mobilite-reseau-interurbain-regional" target="_blank" rel="noopener">Région Centre-Val de Loire — Réseau Rémi</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#fb923c',
    timetable: { search: 'remi centre val de loire' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    // Four contract lots merged into one provider; only two ship
    // feed_info.txt, so it is not required.
    //
    id: 'hdf-nord-59',
    label: 'Réseau interurbain Nord (59)',
    region: 'Hauts-de-France',
    gtfsUrl: [
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_59_P1.zip',
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_59_P2.zip',
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_59_P3A.zip',
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_59_P4.zip',
    ],
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-gtfs-du-reseau-routier-regional-de-transport-scolaire-et-interurbain-59-nord',
    // The producer states no licence. French law (loi d'orientation des
    // mobilités, art. 25; Code des transports L.1115-1) requires public
    // transport data published on the national access point to be open, so
    // Licence Ouverte is presumed — revisit if the producer states otherwise.
    license: 'Licence Ouverte 2.0 (présumée, LOM)',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-gtfs-du-reseau-routier-regional-de-transport-scolaire-et-interurbain-59-nord" target="_blank" rel="noopener">Région Hauts-de-France — réseau interurbain Nord (59)</a> (Licence Ouverte présumée — LOM), via transport.data.gouv.fr',
    lineColor: '#facc15',
    timetable: { search: 'car hauts de france nord 59' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    // Four contract lots merged into one provider.
    //
    id: 'hdf-oise-60',
    label: 'Réseau interurbain Oise (60)',
    region: 'Hauts-de-France',
    gtfsUrl: [
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_60_P1.zip',
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_60_P2.zip',
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_60_P3.zip',
      'https://geocatalogue.hautsdefrance.fr/gtfs/RHDF_GTFS_COM_SCO_60_P4.zip',
    ],
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-du-reseau-routier-regional-de-transport-scolaire-et-interurbain-60-oise-1',
    // The producer states no licence. French law (loi d'orientation des
    // mobilités, art. 25; Code des transports L.1115-1) requires public
    // transport data published on the national access point to be open, so
    // Licence Ouverte is presumed — revisit if the producer states otherwise.
    license: 'Licence Ouverte 2.0 (présumée, LOM)',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-du-reseau-routier-regional-de-transport-scolaire-et-interurbain-60-oise-1" target="_blank" rel="noopener">Région Hauts-de-France — réseau interurbain Oise (60)</a> (Licence Ouverte présumée — LOM), via transport.data.gouv.fr',
    lineColor: '#fb923c',
    timetable: { search: 'car hauts de france oise 60' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'hdf-somme-80',
    label: 'Réseau interurbain Somme (80)',
    region: 'Hauts-de-France',
    gtfsUrl: 'https://sig.hautsdefrance.fr/ext/opendata/Transport/GTFS/80/RHDF_GTFS_COM_80.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-gtfs-du-reseau-routier-regional-de-transport-interurbain-80-somme',
    // The producer states no licence. French law (loi d'orientation des
    // mobilités, art. 25; Code des transports L.1115-1) requires public
    // transport data published on the national access point to be open, so
    // Licence Ouverte is presumed — revisit if the producer states otherwise.
    license: 'Licence Ouverte 2.0 (présumée, LOM)',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-gtfs-du-reseau-routier-regional-de-transport-interurbain-80-somme" target="_blank" rel="noopener">Région Hauts-de-France — réseau interurbain Somme (80)</a> (Licence Ouverte présumée — LOM), via transport.data.gouv.fr',
    lineColor: '#22d3ee',
    timetable: { search: 'car hauts de france somme 80' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-charente-16',
    label: 'Réseau interurbain Charente (16)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/charente-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cha-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cha-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Charente (16)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#22c55e',
    timetable: { search: 'car nouvelle aquitaine charente' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-charente-maritime-17',
    label: 'Réseau interurbain Charente-Maritime (17)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/charente_maritime-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cma-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cma-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Charente-Maritime (17)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#3b82f6',
    timetable: { search: 'car nouvelle aquitaine charente-maritime' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-correze-19',
    label: 'Réseau interurbain Corrèze (19)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/correze-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cor-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cor-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Corrèze (19)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#a855f7',
    timetable: { search: 'car nouvelle aquitaine corrèze' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-creuse-23',
    label: 'Réseau interurbain Creuse (23)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/creuse-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cre-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-cre-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Creuse (23)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#14b8a6',
    timetable: { search: 'car nouvelle aquitaine creuse' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-dordogne-24',
    label: 'Réseau interurbain Dordogne (24)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/dordogne-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-dor-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-dor-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Dordogne (24)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#c084fc',
    timetable: { search: 'car nouvelle aquitaine dordogne' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-gironde-33',
    label: 'Réseau interurbain Gironde (33)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/gironde-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-gir-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-gir-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Gironde (33)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#fb7185',
    timetable: { search: 'car nouvelle aquitaine gironde' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-landes-40',
    label: 'Réseau interurbain Landes (40)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/landes-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-lan-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-lan-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Landes (40)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#7dd3fc',
    timetable: { search: 'car nouvelle aquitaine landes' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-lot-et-garonne-47',
    label: 'Réseau interurbain Lot-et-Garonne (47)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/lot_et_garonne-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-lga-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-lga-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Lot-et-Garonne (47)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#d8b4fe',
    timetable: { search: 'car nouvelle aquitaine lot-et-garonne' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-deux-sevres-79',
    label: 'Réseau interurbain Deux-Sèvres (79)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/deux_sevres-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-dse-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-dse-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Deux-Sèvres (79)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#dc2626',
    timetable: { search: 'car nouvelle aquitaine deux-sèvres' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-vienne-86',
    label: 'Réseau interurbain Vienne (86)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/vienne-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-vie-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-vie-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Vienne (86)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#ea580c',
    timetable: { search: 'car nouvelle aquitaine vienne' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    id: 'na-haute-vienne-87',
    label: 'Réseau interurbain Haute-Vienne (87)',
    region: 'Nouvelle-Aquitaine',
    gtfsUrl: 'https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/haute_vienne-aggregated-gtfs.zip',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-hvi-nva-m-1',
    license: 'ODbL',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/arrets-horaires-et-parcours-theoriques-des-reseaux-naq-hvi-nva-m-1" target="_blank" rel="noopener">Région Nouvelle-Aquitaine — réseau interurbain Haute-Vienne (87)</a> (ODbL), via transport.data.gouv.fr',
    lineColor: '#ca8a04',
    timetable: { search: 'car nouvelle aquitaine haute-vienne' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar.txt',
      'calendar_dates.txt',
      'shapes.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
  {
    // Region-wide feed covering all ten departments (08 10 51 52 54 55 57 67
    // 68 88). Ships no calendar.txt — services are defined by
    // calendar_dates.txt alone.
    //
    id: 'fluo-grand-est',
    label: 'Fluo Grand Est',
    region: 'Grand Est',
    gtfsUrl: 'https://transport.data.gouv.fr/resources/83635/download',
    sourceUrl: 'https://transport.data.gouv.fr/datasets/offre-du-reseau-de-transport-interurbain-fluo-grand-est',
    license: 'Licence Ouverte 2.0',
    attribution:
      '© <a href="https://transport.data.gouv.fr/datasets/offre-du-reseau-de-transport-interurbain-fluo-grand-est" target="_blank" rel="noopener">Région Grand Est — Réseau Fluo Grand Est</a> (Licence Ouverte 2.0), via transport.data.gouv.fr',
    lineColor: '#f472b6',
    timetable: { search: 'fluo grand est' },
    requiredFiles: [
      'agency.txt',
      'routes.txt',
      'trips.txt',
      'stops.txt',
      'stop_times.txt',
      'calendar_dates.txt',
      'shapes.txt',
      'feed_info.txt',
    ],
    lowFreqThreshold: 4,
    reservationPredicate: detectReservationDefault,
    displayDefaultOn: false,
  },
];

export function getProviderConfig(id) {
  const entry = PROVIDERS.find((p) => p.id === id);
  if (!entry) throw new Error(`Unknown transit provider: ${id}`);
  return entry;
}
