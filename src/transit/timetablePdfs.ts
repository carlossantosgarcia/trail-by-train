// The operator's own timetable PDFs, per line.
//
// The links live in the repository, one CSV per network in
// data/timetable-pdfs/<provider>.csv (format in its README), so a link can be
// fixed by editing a row. Each network's file becomes its own small chunk,
// loaded the first time one of its lines is opened. The PDF is what the
// operator stands behind (holidays, school periods, conditional stops), so
// when there is one the popup links it instead of a web search.

import { useEffect, useState } from 'react';
import { formatIsoDate, getLocale, t } from '../i18n';

export interface TimetablePdf {
  url: string;
  /** Short French label: "Fiche horaire", "Guide du réseau", "Fiche horaire (été)". */
  label: string;
  /** Validity the operator states, next to the link or in the PDF; null when unknown. */
  valid_from: string | null;
  valid_to: string | null;
  /** `network`: one document for every line of the network (a guide, a leaflet). */
  scope: 'line' | 'network';
}

/** route_id → its documents, best first. */
export type TimetablePdfIndex = Map<string, TimetablePdf[]>;

const FILES = import.meta.glob<string>('../../data/timetable-pdfs/*.csv', {
  query: '?raw',
  import: 'default',
});

const cache = new Map<string, Promise<TimetablePdfIndex | null>>();

/** CSV as written by spreadsheets: quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

/** One network's CSV as an index. Rows keep their order: a line's first row is its best document. */
export function indexFromCsv(text: string): TimetablePdfIndex {
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header?.indexOf(name) ?? -1;
  const [routeId, url, label, from, to, scope] = [
    'route_id',
    'url',
    'label',
    'valid_from',
    'valid_to',
    'scope',
  ].map(col);
  const index: TimetablePdfIndex = new Map();
  for (const r of rows) {
    const id = r[routeId]?.trim();
    const href = r[url]?.trim();
    if (!id || !href) continue;
    const docs = index.get(id) ?? [];
    docs.push({
      url: href,
      label: r[label]?.trim() || 'Fiche horaire',
      valid_from: r[from]?.trim() || null,
      valid_to: r[to]?.trim() || null,
      scope: r[scope]?.trim() === 'network' ? 'network' : 'line',
    });
    index.set(id, docs);
  }
  return index;
}

export function loadTimetablePdfs(providerId: string): Promise<TimetablePdfIndex | null> {
  const cached = cache.get(providerId);
  if (cached) return cached;
  const load = FILES[`../../data/timetable-pdfs/${providerId}.csv`];
  const pending = load
    ? load()
        .then(indexFromCsv)
        .catch(() => null)
    : Promise.resolve(null);
  cache.set(providerId, pending);
  return pending;
}

function frDate(iso: string): string {
  if (getLocale() !== 'fr') return formatIsoDate(iso);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

/** "Fiche horaire · du 01/09/26 au 31/08/27", or the bare label when no end date is stated. */
export function pdfLinkText(pdf: TimetablePdf): string {
  if (pdf.valid_from && pdf.valid_to) {
    return t('pdf.fromTo', {
      label: pdf.label,
      from: frDate(pdf.valid_from),
      to: frDate(pdf.valid_to),
    });
  }
  if (pdf.valid_to) return t('pdf.until', { label: pdf.label, to: frDate(pdf.valid_to) });
  return pdf.label;
}

/**
 * The PDFs to offer for a line on a given day, in the file's order. A document
 * past its stated end date is not offered: the line falls back to its search
 * link rather than send the hiker to an expired timetable. A document whose
 * end date is unknown is offered.
 */
export function pdfsForLine(
  index: TimetablePdfIndex | null,
  routeId: string,
  todayIso: string,
): TimetablePdf[] {
  const docs = index?.get(routeId) ?? [];
  return docs.filter((d) => !d.valid_to || d.valid_to >= todayIso);
}

export function useTimetablePdfs(providerId: string, routeId: string): TimetablePdf[] {
  const [index, setIndex] = useState<TimetablePdfIndex | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadTimetablePdfs(providerId).then((i) => {
      if (!cancelled) setIndex(i);
    });
    return () => {
      cancelled = true;
    };
  }, [providerId]);
  return pdfsForLine(index, routeId, new Date().toISOString().slice(0, 10));
}
