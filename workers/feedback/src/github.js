// Signing in to GitHub as the trail-by-train-feedback App, so issues are
// opened by its bot rather than by a person. The App's private key (PKCS#8
// PEM) signs a short JWT, exchanged for an installation token that lasts an
// hour and is reused until shortly before it expires.

const API = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'trail-by-train-feedback',
};

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const b64urlJson = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export async function appJwt(appId, pem, nowSec = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  // Backdated a minute for clock drift; GitHub accepts at most ten minutes.
  const unsigned = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson({
    iat: nowSec - 60,
    exp: nowSec + 540,
    iss: String(appId),
  })}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${b64url(sig)}`;
}

let cached = null; // { token, expiresAt } for this Worker instance

/** An installation token for the repository, from cache when still good for 5 minutes. */
export async function installationToken(env, fetcher = fetch, nowMs = Date.now()) {
  if (cached && cached.expiresAt - nowMs > 5 * 60_000) return cached.token;
  const jwt = await appJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY, Math.floor(nowMs / 1000));
  const auth = { ...HEADERS, Authorization: `Bearer ${jwt}` };
  const inst = await fetcher(`${API}/repos/${env.GITHUB_REPO}/installation`, { headers: auth });
  if (!inst.ok) throw new Error(`installation ${inst.status}`);
  const { id } = await inst.json();
  const res = await fetcher(`${API}/app/installations/${id}/access_tokens`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    // Narrowed to what the Worker needs, whatever the App is granted later.
    body: JSON.stringify({
      repositories: [env.GITHUB_REPO.split('/')[1]],
      permissions: { issues: 'write' },
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const data = await res.json();
  cached = { token: data.token, expiresAt: Date.parse(data.expires_at) };
  return cached.token;
}

export function forgetToken() {
  cached = null;
}

export async function createIssue(env, issue, fetcher = fetch) {
  const token = await installationToken(env, fetcher);
  return fetcher(`${API}/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: { ...HEADERS, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
}
