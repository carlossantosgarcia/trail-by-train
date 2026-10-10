// Sort the transit providers' refresh record (public/transit/refresh-status.json,
// written by `build.mjs all`) into what needs attention:
//
//   Broken        failing 3 runs in a row, no success for 21 days after a
//                 failure, or out of season for over 13 months
//   To check      a warning from the last 21 days (a feed that shrank)
//   Out of season informational: a seasonal network between seasons
//
// Prints the data-alert issue body (Broken and To check) on stdout, nothing
// when there is neither. --summary prints all three for the job summary.
//
//   node scripts/transit/report-stale.mjs [--summary]

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './providers.config.mjs';

/** Failing this many runs in a row (weekly) is worth a look. */
export const MAX_CONSECUTIVE_FAILURES = 3;
/** No successful refresh for this long means the map is serving old data. */
export const MAX_DAYS_SINCE_SUCCESS = 21;
/** A seasonal network publishes at least once a year; past this it is gone. */
export const MAX_DAYS_OUT_OF_SEASON = 395;
/** A warning stays in the report this long after it was raised. */
export const WARNING_DAYS = 21;

const daysSince = (iso, now) =>
  iso ? Math.floor((now - new Date(`${iso}T00:00:00Z`)) / 86_400_000) : null;

export function classifyProviders(status, now) {
  const broken = [];
  const toCheck = [];
  const outOfSeason = [];
  for (const [id, s] of Object.entries(status?.providers ?? {})) {
    const days = daysSince(s.last_success, now);
    const dormantDays = daysSince(s.dormant_since, now);
    const failing = s.consecutive_failures >= MAX_CONSECUTIVE_FAILURES;
    // No success on record means no history yet (the first run that tracks
    // a provider), not a long outage: only repeated failures count then.
    const old = s.consecutive_failures > 0 && days !== null && days > MAX_DAYS_SINCE_SUCCESS;
    const goneForGood = dormantDays !== null && dormantDays > MAX_DAYS_OUT_OF_SEASON;
    const entry = { id, ...s, days_since_success: days, days_out_of_season: dormantDays };
    if (failing || old || goneForGood) broken.push(entry);
    else if (dormantDays !== null) outOfSeason.push(entry);
    const warningDays = daysSince(s.warning_on, now);
    if (s.warning && warningDays !== null && warningDays <= WARNING_DAYS) toCheck.push(entry);
  }
  broken.sort((a, b) => b.consecutive_failures - a.consecutive_failures);
  return { broken, toCheck, outOfSeason };
}

/** The broken group alone. */
export function staleProviders(status, now) {
  return classifyProviders(status, now).broken;
}

const cell = (v) =>
  String(v ?? '')
    .replace(/\|/g, '\\|')
    .slice(0, 160);

export function renderReport(groups, { summary = false, label = (id) => id } = {}) {
  const out = [];
  if (groups.broken.length > 0) {
    out.push(
      `### ${groups.broken.length} transit feed(s) broken`,
      '',
      `Failed ${MAX_CONSECUTIVE_FAILURES}+ refreshes in a row, failed with no success for over ${MAX_DAYS_SINCE_SUCCESS} days, or out of season for over 13 months. The map still shows their last good data.`,
      '',
      '| Provider | id | Failures in a row | Last success | Problem |',
      '| --- | --- | --- | --- | --- |',
      ...groups.broken.map((s) => {
        const problem =
          s.consecutive_failures > 0
            ? s.last_error
            : `out of season since ${s.dormant_since} (${s.days_out_of_season} days)`;
        return `| ${label(s.id)} | \`${s.id}\` | ${s.consecutive_failures} | ${s.last_success ?? 'never'} | ${cell(problem)} |`;
      }),
      '',
    );
  }
  if (groups.toCheck.length > 0) {
    out.push(
      `### ${groups.toCheck.length} transit feed(s) to check with the operator`,
      '',
      'These still build, but something changed that is worth a look.',
      '',
      '| Provider | id | Since | Warning |',
      '| --- | --- | --- | --- |',
      ...groups.toCheck.map(
        (s) => `| ${label(s.id)} | \`${s.id}\` | ${s.warning_on} | ${cell(s.warning)} |`,
      ),
      '',
    );
  }
  if (summary && groups.outOfSeason.length > 0) {
    out.push(
      `### ${groups.outOfSeason.length} transit feed(s) out of season`,
      '',
      "Their feed publishes no trips right now; the map keeps last season's lines.",
      '',
      '| Provider | id | Since |',
      '| --- | --- | --- |',
      ...groups.outOfSeason.map((s) => `| ${label(s.id)} | \`${s.id}\` | ${s.dormant_since} |`),
      '',
    );
  }
  return out.join('\n');
}

function main() {
  const path = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../public/transit/refresh-status.json',
  );
  if (!existsSync(path)) return;
  const groups = classifyProviders(JSON.parse(readFileSync(path, 'utf8')), new Date());
  const label = (id) => PROVIDERS.find((p) => p.id === id)?.label ?? id;
  const md = renderReport(groups, { summary: process.argv.includes('--summary'), label });
  if (md) console.log(md);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
