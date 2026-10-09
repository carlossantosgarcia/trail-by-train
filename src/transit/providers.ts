// The app's transit providers, derived from the build config so every
// provider is declared once — in scripts/transit/providers.config.mjs — and
// the map can never disagree with the pipeline about a label, colour or
// attribution. Asset URLs follow the layout build.mjs writes.

import { PROVIDERS } from '../../scripts/transit/providers.config.mjs';
import type { TimetableLink } from '../../scripts/transit/providers.config.d.mts';
import type { ProviderConfig, TransitLineProperties } from './types';

const BASE = import.meta.env.BASE_URL;

function timetableUrl(link: TimetableLink): (line: TransitLineProperties) => string {
  if ('resoM' in link) {
    return (line) => {
      const shortName = line.route_short_name?.trim();
      if (!shortName) return link.indexUrl;
      return `https://www.reso-m.fr/8-horaires.htm?code=${encodeURIComponent(`${link.resoM}:${shortName}`)}`;
    };
  }
  return (line) => {
    const q = [link.search, line.route_short_name, line.route_long_name, 'horaires']
      .filter(Boolean)
      .join(' ');
    return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
  };
}

export const TRANSIT_PROVIDERS: readonly ProviderConfig[] = PROVIDERS.map((c) => ({
  id: c.id,
  label: c.label,
  region: c.region,
  attribution: c.attribution,
  lineColor: c.lineColor,
  displayDefaultOn: c.displayDefaultOn,
  linesPmtilesUrl: `${BASE}transit/${c.id}/lines.pmtiles`,
  stopsGeoJsonUrl: `${BASE}transit/${c.id}/stops.geojson`,
  metaUrl: `${BASE}transit/${c.id}/meta.json`,
  timetableSearchUrl: timetableUrl(c.timetable),
}));
