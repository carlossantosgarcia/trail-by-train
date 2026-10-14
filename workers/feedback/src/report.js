// What a report may contain, and the GitHub issue it becomes. Pure functions,
// so they are tested without Cloudflare or GitHub.

export const CATEGORIES = {
  line: ['Horaires', 'Tracé', 'Arrêts', 'Lien vers les horaires', 'Réservation', 'Autre'],
  hike: ['Tracé', 'Accès en transport', 'Informations', 'Autre'],
  general: [
    'Horaires',
    'Tracé',
    'Arrêts',
    'Lien vers les horaires',
    'Réservation',
    'Randonnée',
    'Demande de ligne',
    'Suggestion',
    'Autre',
  ],
};

const KIND_TITLE = { line: 'Ligne', hike: 'Randonnée', general: 'Général' };
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const LINKS_MAX = 3;
const LINK_LEN_MAX = 500;

function validLink(v) {
  if (typeof v !== 'string' || v.length > LINK_LEN_MAX || !v.startsWith('https://')) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}
const SHORT_MAX = 200;

const str = (v, max = SHORT_MAX) => (typeof v === 'string' && v.length <= max ? v.trim() : null);
const num = (v, lo, hi) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;

/**
 * Checks a report as sent by the app. Returns `{ report }` with only the known
 * fields, or `{ error }` naming the first problem.
 */
export function validateReport(body) {
  if (!body || typeof body !== 'object') return { error: 'body' };
  const kind = body.kind;
  if (!Object.hasOwn(CATEGORIES, kind)) return { error: 'kind' };
  if (!CATEGORIES[kind].includes(body.category)) return { error: 'category' };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) return { error: 'message' };
  if (typeof body.token !== 'string' || !body.token) return { error: 'token' };
  const rawLinks = body.links ?? [];
  if (!Array.isArray(rawLinks)) return { error: 'links' };
  const links = rawLinks.map((l) => (typeof l === 'string' ? l.trim() : l)).filter((l) => l !== '');
  if (links.length > LINKS_MAX || !links.every(validLink)) return { error: 'links' };

  const c = body.context && typeof body.context === 'object' ? body.context : {};
  const context = {
    network: str(c.network),
    providerId: str(c.providerId, 80),
    line: str(c.line, 80),
    lineName: str(c.lineName),
    routeId: str(c.routeId),
    hike: str(c.hike),
    hikeId: str(c.hikeId, 120),
    lat: num(c.lat, -90, 90),
    lon: num(c.lon, -180, 180),
    zoom: num(c.zoom, 0, 24),
    version: str(c.version, 40),
    page: str(c.page, 500),
  };
  if (kind === 'line' && !(context.providerId && context.routeId)) return { error: 'context' };
  if (kind === 'hike' && !context.hikeId) return { error: 'context' };
  return { report: { kind, category: body.category, message, links, token: body.token, context } };
}

/**
 * Text a stranger wrote, made inert for an issue: no HTML, no clickable links
 * or images, no @mentions that would notify someone.
 */
export function inert(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, "'")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, (url) => `\`${url}\``)
    .replace(/@(?=\w)/g, '@​');
}

function cell(value) {
  return inert(String(value))
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ');
}

/** The issue for a valid report. `test` marks reports sent from the preview. */
export function issueFor(report, { test = false } = {}) {
  const c = report.context;
  const subject =
    report.kind === 'line'
      ? [c.network, c.line].filter(Boolean).join(' ')
      : report.kind === 'hike'
        ? c.hike || c.hikeId
        : '';
  const clean = String(subject)
    .replace(/[\r\n<>`@]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title = `[${KIND_TITLE[report.kind]}] ${clean ? `${clean} : ` : ''}${report.category}`;

  const code = (v) => `\`${String(v).replace(/[`|\n]/g, ' ')}\``;
  const rows = [
    ['Réseau', c.network && `${cell(c.network)}${c.providerId ? ` (${code(c.providerId)})` : ''}`],
    ['Ligne', c.line && cell([c.line, c.lineName].filter(Boolean).join(' · '))],
    ['route_id', c.routeId && code(c.routeId)],
    ['Randonnée', (c.hike || c.hikeId) && cell(c.hike || c.hikeId)],
    ['id', c.hikeId && code(c.hikeId)],
    ['Position', c.lat != null && c.lon != null && `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`],
    ['Zoom', c.zoom != null && c.zoom.toFixed(1)],
    ['Version', c.version && cell(c.version)],
    // A preview's address is a private host: kept out of public issues.
    ['Page', !test && c.page && code(c.page)],
  ].filter(([, v]) => v);

  const quoted = inert(report.message)
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  const table = rows.map(([k, v]) => `| ${k} | ${v} |`);
  const linkLines = (report.links ?? []).map((l) => `- ${code(l)}`);
  const body = [
    quoted,
    '',
    ...(linkLines.length ? ['Liens :', '', ...linkLines, ''] : []),
    '| | |',
    '| --- | --- |',
    ...table,
    '',
    '_Envoyé depuis le formulaire « Envoyer un retour »._',
  ].join('\n');

  const labels = ['feedback', report.kind];
  if (test) labels.push('test');
  return { title: title.slice(0, 250), body, labels };
}
