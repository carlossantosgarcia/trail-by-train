// Types for the subset of providers.config.mjs the app reads. The build
// pipeline uses more fields (gtfsUrl, requiredFiles, predicates…), which the
// app ignores.

export type TimetableLink =
  /** Web search for "<search> <line> horaires". */
  | { search: string }
  /** reso-m.fr timetable addressed as <resoM>:<short_name>; indexUrl when a line has none. */
  | { resoM: string; indexUrl: string };

export interface ProviderConfigEntry {
  id: string;
  label: string;
  region: string;
  attribution: string;
  lineColor: string;
  displayDefaultOn: boolean;
  timetable: TimetableLink;
}

export declare const PROVIDERS: readonly ProviderConfigEntry[];
