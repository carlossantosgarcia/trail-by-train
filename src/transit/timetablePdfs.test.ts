import { describe, expect, it } from 'vitest';
import { TRANSIT_PROVIDERS } from './providers';
import {
  indexFromCsv,
  parseCsv,
  pdfLinkText,
  pdfsForLine,
  type TimetablePdf,
  type TimetablePdfIndex,
} from './timetablePdfs';

const doc = (url: string, valid_to: string | null = null): TimetablePdf => ({
  url,
  label: 'Fiche horaire',
  valid_from: null,
  valid_to,
  scope: 'line',
});

const index = (docs: TimetablePdf[]): TimetablePdfIndex => new Map([['L:1', docs]]);

describe('pdfsForLine', () => {
  it('returns nothing for a line the index does not list, or without an index', () => {
    expect(pdfsForLine(index([doc('a')]), 'L:2', '2026-10-12')).toEqual([]);
    expect(pdfsForLine(null, 'L:1', '2026-10-12')).toEqual([]);
  });

  it('keeps the file order and drops documents that expired', () => {
    const docs = [doc('works', '2026-10-01'), doc('year', '2027-08-31'), doc('undated')];
    expect(pdfsForLine(index(docs), 'L:1', '2026-10-12').map((d) => d.url)).toEqual([
      'year',
      'undated',
    ]);
  });

  it('counts the last day of validity as valid', () => {
    expect(pdfsForLine(index([doc('a', '2026-10-12')]), 'L:1', '2026-10-12')).toHaveLength(1);
  });

  it('offers nothing once every document has expired, so the search link returns', () => {
    expect(pdfsForLine(index([doc('winter', '2026-04-10')]), 'L:1', '2026-10-12')).toEqual([]);
  });
});

describe('reading a network file', () => {
  it('handles quoted fields, doubled quotes and CRLF line ends', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  it("groups a line's rows in order, whatever the column order", () => {
    const csv = [
      'line,route_id,url,label,valid_from,valid_to,scope',
      'T40,L:1,https://x/t40.pdf,Fiche horaire,2026-09-01,2027-08-31,line',
      'T40,L:1,https://x/guide.pdf,Guide du réseau,,,network',
    ].join('\n');
    const docs = indexFromCsv(csv).get('L:1')!;
    expect(docs.map((d) => d.url)).toEqual(['https://x/t40.pdf', 'https://x/guide.pdf']);
    expect(docs[1]).toMatchObject({ scope: 'network', valid_to: null });
  });

  it('writes the stated dates after the label', () => {
    const d = { ...doc('a', '2027-08-31'), valid_from: '2026-09-01' };
    expect(pdfLinkText(d)).toBe('Fiche horaire · du 01/09/26 au 31/08/27');
    expect(pdfLinkText(doc('a', '2027-07-05'))).toBe("Fiche horaire · jusqu'au 05/07/27");
    expect(pdfLinkText(doc('a'))).toBe('Fiche horaire');
  });
});

// The committed files are edited by hand: catch a broken row before it ships.
describe('data/timetable-pdfs', () => {
  const texts = import.meta.glob<string>('../../data/timetable-pdfs/*.csv', {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const files = Object.keys(texts).map((path) => path.split('/').pop()!);
  const providers = new Set(TRANSIT_PROVIDERS.map((p) => p.id));
  const iso = /^\d{4}-\d{2}-\d{2}$/;

  it('has files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(file, () => {
      expect(providers, 'file name is a provider id').toContain(file.replace(/\.csv$/, ''));
      const [header, ...rows] = parseCsv(texts[`../../data/timetable-pdfs/${file}`]);
      expect(header).toEqual([
        'route_id',
        'line',
        'url',
        'label',
        'valid_from',
        'valid_to',
        'scope',
      ]);
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        const where = `${file} row ${i + 2}`;
        const [routeId, , url, label, from, to, scope] = r;
        expect(r, where).toHaveLength(7);
        expect(routeId, where).not.toBe('');
        expect(() => new URL(url), where).not.toThrow();
        expect(url.startsWith('https://') || url.startsWith('http://'), where).toBe(true);
        expect(label, where).not.toBe('');
        for (const d of [from, to]) {
          if (d) expect(iso.test(d) && !Number.isNaN(Date.parse(d)), `${where}: ${d}`).toBe(true);
        }
        if (from && to) expect(from <= to, where).toBe(true);
        expect(['line', 'network'], where).toContain(scope);
        expect(seen.has(`${routeId} ${url}`), `${where}: duplicate`).toBe(false);
        seen.add(`${routeId} ${url}`);
      });
    });
  }
});
