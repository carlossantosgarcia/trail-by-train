import { APP_VERSION, NEW_ISSUE_URL } from './config';
import { reportTitle, type FeedbackSubject } from './subject';

export interface MapView {
  lat: number;
  lon: number;
  zoom: number;
}

export interface ReportContext {
  network?: string;
  providerId?: string;
  line?: string;
  lineName?: string;
  routeId?: string;
  hike?: string;
  hikeId?: string;
  lat?: number;
  lon?: number;
  zoom?: number;
  version: string;
  page: string;
}

/** Everything sent besides the message, as the Worker expects it. */
export function reportContext(
  subject: FeedbackSubject,
  view: MapView | null,
  page: string,
): ReportContext {
  const ctx: ReportContext = { version: APP_VERSION, page };
  if (view) {
    ctx.lat = Number(view.lat.toFixed(5));
    ctx.lon = Number(view.lon.toFixed(5));
    ctx.zoom = Number(view.zoom.toFixed(1));
  }
  if (subject.kind === 'line') {
    Object.assign(ctx, {
      network: subject.network,
      providerId: subject.providerId,
      line: subject.line,
      lineName: subject.lineName,
      routeId: subject.routeId,
    });
  } else if (subject.kind === 'hike') {
    Object.assign(ctx, { hike: subject.hike, hikeId: subject.hikeId });
  }
  return ctx;
}

/** The context as label/value pairs, for the form and the GitHub fallback. */
export function contextRows(ctx: ReportContext): [string, string][] {
  const rows: [string, string | undefined][] = [
    ['Réseau', ctx.network && `${ctx.network} (${ctx.providerId})`],
    ['Ligne', ctx.line && `${ctx.line} · ${ctx.lineName ?? ''}`.trim()],
    ['route_id', ctx.routeId],
    ['Randonnée', ctx.hike && `${ctx.hike} (${ctx.hikeId})`],
    ['Position', ctx.lat != null ? `${ctx.lat}, ${ctx.lon} (zoom ${ctx.zoom})` : undefined],
    ['Version', ctx.version],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

/** GitHub's new-issue page, filled in, for when the relay cannot be used. */
export function newIssueUrl(
  subject: FeedbackSubject,
  category: string,
  message: string,
  links: string[],
  ctx: ReportContext,
): string {
  const body = [
    message,
    '',
    ...(links.length ? ['Liens :', ...links.map((l) => `- ${l}`), ''] : []),
    ...contextRows(ctx).map(([k, v]) => `- ${k} : ${v}`),
  ].join('\n');
  const params = new URLSearchParams({
    title: reportTitle(subject, category),
    body,
    labels: 'feedback',
  });
  return `${NEW_ISSUE_URL}?${params}`;
}

/** Links as typed, one per line: trimmed, blanks dropped. */
export function parseLinks(text: string): string[] {
  return text
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function linksValid(links: string[], max: number): boolean {
  return (
    links.length <= max &&
    links.every((l) => {
      try {
        return l.length <= 500 && new URL(l).protocol === 'https:';
      } catch {
        return false;
      }
    })
  );
}
