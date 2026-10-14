import { describe, expect, it } from 'vitest';
import { contextRows, linksValid, newIssueUrl, parseLinks, reportContext } from './report';
import { reportTitle, type FeedbackSubject } from './subject';

const t40: FeedbackSubject = {
  kind: 'line',
  network: 'Cars Région Isère',
  providerId: 'cars-isere',
  line: 'T40',
  lineName: 'ST PIERRE DE CHARTREUSE-GRENOBLE',
  routeId: 'ISERE:Line:1003603:LOC',
};
const view = { lat: 45.381144, lon: 5.736139, zoom: 10.04 };

describe('reportContext', () => {
  it('sends the line and a rounded map view', () => {
    const ctx = reportContext(t40, view, 'https://x/');
    expect(ctx).toMatchObject({
      providerId: 'cars-isere',
      routeId: 'ISERE:Line:1003603:LOC',
      lat: 45.38114,
      lon: 5.73614,
      zoom: 10,
    });
  });

  it('sends only the view for a general report', () => {
    const ctx = reportContext({ kind: 'general' }, null, 'https://x/');
    expect(ctx).not.toHaveProperty('routeId');
    expect(ctx).not.toHaveProperty('lat');
    expect(contextRows(ctx).map(([k]) => k)).toEqual(['Version']);
  });
});

describe('reportTitle', () => {
  it('matches the issue title the Worker writes', () => {
    expect(reportTitle(t40, 'Horaires')).toBe('[Ligne] Cars Région Isère T40 : Horaires');
    expect(reportTitle({ kind: 'hike', hike: 'Tour du Taillefer', hikeId: 'x/y' }, 'Tracé')).toBe(
      '[Randonnée] Tour du Taillefer : Tracé',
    );
    expect(reportTitle({ kind: 'general' }, 'Suggestion')).toBe('[Général] Suggestion');
  });
});

describe('links', () => {
  it('reads one link per line and accepts up to three https links', () => {
    const links = parseLinks(' https://a.example/x.pdf \n\nhttps://b.example ');
    expect(links).toEqual(['https://a.example/x.pdf', 'https://b.example']);
    expect(linksValid(links, 3)).toBe(true);
    expect(linksValid(['http://a.example'], 3)).toBe(false);
    expect(linksValid(['https://a', 'https://b', 'https://c', 'https://d'], 3)).toBe(false);
  });
});

describe('newIssueUrl', () => {
  it('fills in the title, message, links and context', () => {
    const url = new URL(
      newIssueUrl(
        t40,
        'Lien vers les horaires',
        'Le PDF est périmé.',
        ['https://a.example/x.pdf'],
        {
          ...reportContext(t40, view, 'https://x/'),
        },
      ),
    );
    expect(url.searchParams.get('title')).toBe(
      '[Ligne] Cars Région Isère T40 : Lien vers les horaires',
    );
    const body = url.searchParams.get('body')!;
    expect(body).toContain('Le PDF est périmé.');
    expect(body).toContain('- https://a.example/x.pdf');
    expect(body).toContain('route_id : ISERE:Line:1003603:LOC');
  });
});
