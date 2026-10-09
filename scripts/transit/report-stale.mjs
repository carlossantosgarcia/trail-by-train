// List the transit providers whose refresh keeps failing, from
// public/transit/refresh-status.json (written by `build.mjs all`).
// Prints a Markdown report on stdout, nothing when every provider is healthy.
// The Data workflow turns a non-empty report into a GitHub issue.
//
//   node scripts/transit/report-stale.mjs

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './providers.config.mjs';

/** Failing this many runs in a row (weekly) is worth a look. */
export const MAX_CONSECUTIVE_FAILURES = 3;
/** No successful refresh for this long means the map is serving old data. */
export const MAX_DAYS_SINCE_SUCCESS = 21;

export function staleProviders(status, now) {
  const out = [];
  for (const [id, s] of Object.entries(status?.providers ?? {})) {
    const days = s.last_success
      ? Math.floor((now - new Date(`${s.last_success}T00:00:00Z`)) / 86_400_000)
      : null;
    const failing = s.consecutive_failures >= MAX_CONSECUTIVE_FAILURES;
    // No success on record means no history yet (the first run that tracks
    // a provider), not a long outage: only repeated failures count then.
    const old = s.consecutive_failures > 0 && days !== null && days > MAX_DAYS_SINCE_SUCCESS;
    if (failing || old) out.push({ id, ...s, days_since_success: days });
  }
  return out.sort((a, b) => b.consecutive_failures - a.consecutive_failures);
}

function main() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/transit/refresh-status.json');
  if (!existsSync(path)) return;
  const stale = staleProviders(JSON.parse(readFileSync(path, 'utf8')), new Date());
  if (stale.length === 0) return;
  const label = (id) => PROVIDERS.find((p) => p.id === id)?.label ?? id;
  const rows = stale.map(
    (s) =>
      `| ${label(s.id)} | \`${s.id}\` | ${s.consecutive_failures} | ${s.last_success ?? 'never'} | ${String(s.last_error ?? '').replace(/\|/g, '\\|').slice(0, 160)} |`,
  );
  console.log(
    [
      `### ${stale.length} transit feed(s) keep failing`,
      '',
      `These providers failed ${MAX_CONSECUTIVE_FAILURES}+ refreshes in a row, or have not refreshed for over ${MAX_DAYS_SINCE_SUCCESS} days. The map still shows their last good data.`,
      '',
      '| Provider | id | Failures in a row | Last success | Last error |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n'),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
