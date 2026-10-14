// Turns a "Envoyer un retour" report into a GitHub issue, so people can
// report without a GitHub account. The GitHub token lives only here.
//
// Bindings and variables (wrangler.toml, Cloudflare dashboard):
//   GITHUB_APP_PRIVATE_KEY, TURNSTILE_SECRET   secrets (the key as PKCS#8 PEM)
//   GITHUB_APP_ID, GITHUB_REPO                 the App, and "owner/name"
//   ALLOWED_ORIGINS                  comma-separated origins of the live site
//   TEST_ORIGINS                     origins whose reports get the `test` label
//                                    (set in the dashboard, not in the repo)
//   PER_VISITOR                      rate-limiting binding (per minute)
//   COUNTS                           KV namespace for the daily cap
//   DAILY_CAP                        issues per day in all

import { createIssue } from './github.js';
import { issueFor, validateReport } from './report.js';

const list = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function reply(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function turnstileOk(token, secret, fetcher) {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  const res = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.success === true;
}

/** Counts today's issues; false once the cap is reached. */
async function underDailyCap(env, today) {
  if (!env.COUNTS) return true;
  const key = `issues:${today}`;
  const n = Number((await env.COUNTS.get(key)) ?? 0);
  if (n >= Number(env.DAILY_CAP ?? 50)) return false;
  await env.COUNTS.put(key, String(n + 1), { expirationTtl: 2 * 86400 });
  return true;
}

export async function handle(
  request,
  env,
  fetcher = fetch,
  today = new Date().toISOString().slice(0, 10),
) {
  const origin = request.headers.get('Origin') ?? '';
  const live = list(env.ALLOWED_ORIGINS);
  const test = list(env.TEST_ORIGINS);
  if (!live.includes(origin) && !test.includes(origin)) {
    return reply(403, { ok: false, error: 'origin' });
  }
  const headers = cors(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' }, headers);

  let body;
  try {
    body = await request.json();
  } catch {
    return reply(400, { ok: false, error: 'body' }, headers);
  }
  const { report, error } = validateReport(body);
  if (error) return reply(400, { ok: false, error }, headers);

  if (!(await turnstileOk(report.token, env.TURNSTILE_SECRET, fetcher))) {
    return reply(403, { ok: false, error: 'turnstile' }, headers);
  }
  // The address keys the per-minute count inside Cloudflare; it is never
  // stored by this Worker or sent to GitHub.
  const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.PER_VISITOR) {
    const { success } = await env.PER_VISITOR.limit({ key: visitor });
    if (!success) return reply(429, { ok: false, error: 'rate' }, headers);
  }
  if (!(await underDailyCap(env, today))) return reply(429, { ok: false, error: 'cap' }, headers);

  const issue = issueFor(report, { test: test.includes(origin) });
  let res;
  try {
    res = await createIssue(env, issue, fetcher);
  } catch {
    return reply(502, { ok: false, error: 'github' }, headers);
  }
  if (!res.ok) return reply(502, { ok: false, error: 'github' }, headers);
  const created = await res.json();
  return reply(201, { ok: true, url: created.html_url }, headers);
}

export default {
  fetch: (request, env) => handle(request, env),
};
