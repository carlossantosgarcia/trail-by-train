import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { appJwt, forgetToken } from '../src/github.js';
import { handle } from '../src/index.js';
import { inert, issueFor, validateReport } from '../src/report.js';

const LIVE = 'https://example.github.io';
const PREVIEW = 'https://preview.example';

const lineReport = (over = {}) => ({
  kind: 'line',
  category: 'Lien vers les horaires',
  message: 'Le lien PDF mène à la fiche de l’an dernier.',
  token: 'tok',
  context: {
    network: 'Cars Région Isère',
    providerId: 'cars-isere',
    line: 'T40',
    lineName: 'ST PIERRE DE CHARTREUSE-GRENOBLE',
    routeId: 'ISERE:Line:1003603:LOC',
    lat: 45.38114,
    lon: 5.73614,
    zoom: 10,
    version: 'abc1234',
    page: `${LIVE}/trail-by-train/`,
  },
  ...over,
});

// A throwaway key pair standing in for the App's.
let PEM;
let PUBLIC_KEY;
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  PEM = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----\n`;
  PUBLIC_KEY = pair.publicKey;
});
beforeEach(() => forgetToken());

function env(over = {}) {
  const kv = new Map();
  return {
    GITHUB_REPO: 'owner/repo',
    GITHUB_APP_ID: '42',
    GITHUB_APP_PRIVATE_KEY: PEM,
    TURNSTILE_SECRET: 'ts',
    ALLOWED_ORIGINS: LIVE,
    TEST_ORIGINS: PREVIEW,
    DAILY_CAP: '2',
    COUNTS: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v) },
    PER_VISITOR: { limit: async () => ({ success: true }) },
    ...over,
  };
}

/** A fetch double: Turnstile answers `turnstile`, GitHub records the issue. */
function fakeFetch({ turnstile = true, github = 201 } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('turnstile')) return Response.json({ success: turnstile });
    if (url.endsWith('/installation')) return Response.json({ id: 7 });
    if (url.endsWith('/access_tokens')) {
      return Response.json(
        { token: 'inst-token', expires_at: new Date(Date.now() + 3600_000).toISOString() },
        { status: 201 },
      );
    }
    if (github !== 201) return new Response('nope', { status: github });
    return Response.json({ html_url: 'https://github.com/owner/repo/issues/1' }, { status: 201 });
  };
  fn.calls = calls;
  return fn;
}

const post = (body, origin = LIVE) =>
  new Request('https://feedback.example/', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.9',
    },
    body: JSON.stringify(body),
  });

describe('validateReport', () => {
  it('accepts a line report and keeps only known fields', () => {
    const { report } = validateReport({ ...lineReport(), extra: 1 });
    expect(report.context.routeId).toBe('ISERE:Line:1003603:LOC');
    expect(report).not.toHaveProperty('extra');
  });

  it('rejects an unknown kind or category, a short message and a missing token', () => {
    expect(validateReport(lineReport({ kind: 'stop' })).error).toBe('kind');
    expect(validateReport(lineReport({ category: 'Randonnée' })).error).toBe('category');
    expect(validateReport(lineReport({ message: 'court' })).error).toBe('message');
    expect(validateReport(lineReport({ token: '' })).error).toBe('token');
  });

  it('needs the line or hike a report is about', () => {
    expect(validateReport(lineReport({ context: {} })).error).toBe('context');
    expect(
      validateReport({ ...lineReport(), kind: 'general', category: 'Suggestion', context: {} })
        .report,
    ).toBeTruthy();
  });

  it('drops a position out of range', () => {
    const { report } = validateReport(
      lineReport({ context: { ...lineReport().context, lat: 200 } }),
    );
    expect(report.context.lat).toBeNull();
  });
});

describe('links', () => {
  it('accepts up to three https links and lists them as code', () => {
    const { report } = validateReport(lineReport({ links: ['https://op.example/t40.pdf', ' '] }));
    expect(report.links).toEqual(['https://op.example/t40.pdf']);
    expect(issueFor(report).body).toContain('- `https://op.example/t40.pdf`');
  });

  it('rejects other schemes, too many links and a non-list', () => {
    expect(validateReport(lineReport({ links: ['http://op.example/a.pdf'] })).error).toBe('links');
    expect(validateReport(lineReport({ links: ['javascript:alert(1)'] })).error).toBe('links');
    expect(
      validateReport(
        lineReport({
          links: [
            'https://a.example',
            'https://b.example',
            'https://c.example',
            'https://d.example',
          ],
        }),
      ).error,
    ).toBe('links');
    expect(validateReport(lineReport({ links: 'https://a.example' })).error).toBe('links');
  });
});

describe('issueFor', () => {
  it('names the network, line and category, and labels it', () => {
    const issue = issueFor(validateReport(lineReport()).report);
    expect(issue.title).toBe('[Ligne] Cars Région Isère T40 : Lien vers les horaires');
    expect(issue.labels).toEqual(['feedback', 'line']);
    expect(issue.body).toContain('`ISERE:Line:1003603:LOC`');
    expect(issue.body).toContain('45.38114, 5.73614');
  });

  it('adds the test label for preview reports', () => {
    expect(issueFor(validateReport(lineReport()).report, { test: true }).labels).toContain('test');
  });

  it("leaves a preview's address out of the issue", () => {
    const report = validateReport(lineReport()).report;
    report.context.page = 'https://preview.example/hike_preview/';
    expect(issueFor(report).body).toContain('| Page | `https://preview.example/hike_preview/` |');
    expect(issueFor(report, { test: true }).body).not.toContain('preview.example');
  });

  it('makes a message inert: no HTML, links, images or mentions', () => {
    const text = inert('voir <img src=x> ![a](https://evil.example/p.png) @carlos');
    expect(text).not.toContain('<img');
    expect(text).toContain('`https://evil.example/p.png)`');
    expect(text).toContain('@​carlos');
  });

  it('keeps a table cell on one row', () => {
    const r = validateReport(
      lineReport({ context: { ...lineReport().context, network: 'A | B\nC' } }),
    ).report;
    expect(issueFor(r).body).toContain('A \\| B C');
  });
});

describe('handle', () => {
  it('creates the issue and returns its link', async () => {
    const f = fakeFetch();
    const res = await handle(post(lineReport()), env(), f);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, url: 'https://github.com/owner/repo/issues/1' });
    const gh = f.calls.find((c) => c.url.endsWith('/issues'));
    expect(JSON.parse(gh.init.body).labels).toEqual(['feedback', 'line']);
    expect(gh.init.body).not.toContain('203.0.113.9');
    expect(gh.init.headers.Authorization).toBe('Bearer inst-token');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(LIVE);
  });

  it('labels preview reports as tests', async () => {
    const f = fakeFetch();
    await handle(post(lineReport(), PREVIEW), env(), f);
    const gh = f.calls.find((c) => c.url.endsWith('/issues'));
    expect(JSON.parse(gh.init.body).labels).toContain('test');
  });

  it('refuses other origins before reading anything', async () => {
    const f = fakeFetch();
    const res = await handle(post(lineReport(), 'https://elsewhere.example'), env(), f);
    expect(res.status).toBe(403);
    expect(f.calls).toHaveLength(0);
  });

  it('answers the CORS preflight', async () => {
    const req = new Request('https://feedback.example/', {
      method: 'OPTIONS',
      headers: { Origin: LIVE },
    });
    const res = await handle(req, env(), fakeFetch());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('creates nothing without a valid Turnstile token', async () => {
    const f = fakeFetch({ turnstile: false });
    const res = await handle(post(lineReport()), env(), f);
    expect(res.status).toBe(403);
    expect(f.calls.some((c) => c.url.includes('api.github.com'))).toBe(false);
  });

  it('turns away a visitor over the per-minute limit', async () => {
    const e = env({ PER_VISITOR: { limit: async () => ({ success: false }) } });
    const res = await handle(post(lineReport()), e, fakeFetch());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('rate');
  });

  it('stops at the daily cap', async () => {
    const e = env();
    for (let i = 0; i < 2; i += 1) {
      expect((await handle(post(lineReport()), e, fakeFetch(), '2026-10-13')).status).toBe(201);
    }
    const res = await handle(post(lineReport()), e, fakeFetch(), '2026-10-13');
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('cap');
    expect((await handle(post(lineReport()), e, fakeFetch(), '2026-10-14')).status).toBe(201);
  });

  it('reports a GitHub failure as 502', async () => {
    const res = await handle(post(lineReport()), env(), fakeFetch({ github: 401 }));
    expect(res.status).toBe(502);
  });

  it('rejects a malformed body', async () => {
    const req = new Request('https://feedback.example/', {
      method: 'POST',
      headers: { Origin: LIVE },
      body: '{',
    });
    expect((await handle(req, env(), fakeFetch())).status).toBe(400);
  });
});

describe('signing in as the App', () => {
  it('signs a JWT GitHub can verify, issued by the App, valid under ten minutes', async () => {
    const jwt = await appJwt('42', PEM, 1_000_000);
    const [h, p, sig] = jwt.split('.');
    const dec = (x) =>
      Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      PUBLIC_KEY,
      dec(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
    const claims = JSON.parse(new TextDecoder().decode(dec(p)));
    expect(claims).toEqual({ iat: 999_940, exp: 1_000_540, iss: '42' });
  });

  it('asks for an issues-only token on this repository, then reuses it', async () => {
    const f = fakeFetch();
    await handle(post(lineReport()), env(), f);
    await handle(post(lineReport()), env(), f);
    const exchanges = f.calls.filter((c) => c.url.endsWith('/access_tokens'));
    expect(exchanges).toHaveLength(1);
    expect(JSON.parse(exchanges[0].init.body)).toEqual({
      repositories: ['repo'],
      permissions: { issues: 'write' },
    });
  });

  it('answers 502 when GitHub refuses the App', async () => {
    const f = async (url) =>
      url.includes('turnstile')
        ? Response.json({ success: true })
        : new Response('no', { status: 404 });
    expect((await handle(post(lineReport()), env(), f)).status).toBe(502);
  });
});

describe('the app and the Worker agree', () => {
  it('on categories and limits', async () => {
    const app = await import('../../../src/features/feedback/subject.ts');
    const worker = await import('../src/report.js');
    expect(app.CATEGORIES).toEqual(worker.CATEGORIES);
    expect([app.MESSAGE_MIN, app.MESSAGE_MAX, app.LINKS_MAX]).toEqual([
      worker.MESSAGE_MIN,
      worker.MESSAGE_MAX,
      worker.LINKS_MAX,
    ]);
  });
});
