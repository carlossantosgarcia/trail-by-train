// Read GTFS-Flex `booking_rules.txt`.
//
// This is the only place a feed states, in data, that a line must be booked
// ahead — and it carries the detail a hiker actually needs: how late you can
// call, on what number, and where to read the terms. Everything else the
// pipeline had was inference from route ids and free-text descriptions.
//
// The file is optional and most feeds omit it entirely. Four of the registered
// providers ship one; only three attach it to any trip (see `reservation.mjs`
// for why that distinction decides the answer).

import { existsSync } from 'node:fs';

import { readAllRows } from './gtfs.mjs';

function clean(value) {
  const v = (value ?? '').trim();
  return v === '' ? null : v;
}

/**
 * Human-readable deadline from the GTFS-Flex prior-notice fields.
 * `prior_notice_last_day` counts days before travel, `prior_notice_last_time`
 * is the cut-off on that day.
 */
function describeDeadline(row) {
  const day = clean(row.prior_notice_last_day);
  const time = clean(row.prior_notice_last_time);
  if (!day && !time) return null;
  const days = Number(day);
  if (Number.isFinite(days) && days > 0) {
    const when = days === 1 ? 'la veille' : `${days} jours avant`;
    return time ? `${when} avant ${time.slice(0, 5)}` : when;
  }
  return time ? `le jour même avant ${time.slice(0, 5)}` : null;
}

/**
 * @returns {Promise<Map<string, {message: string|null, phone: string|null, url: string|null, deadline: string|null}>>}
 */
export async function readBookingRules(path) {
  if (!existsSync(path)) return new Map();
  const rows = await readAllRows(path);
  const out = new Map();
  for (const row of rows) {
    const id = clean(row.booking_rule_id);
    if (!id) continue;
    out.set(id, {
      message: clean(row.message) ?? clean(row.pickup_message) ?? clean(row.drop_off_message),
      phone: clean(row.phone_number),
      url: clean(row.info_url) ?? clean(row.booking_url),
      deadline: describeDeadline(row),
    });
  }
  return out;
}

/**
 * Collapse the rules a route references into the single detail shown in the
 * popup. Routes normally reference one rule; when they reference several we
 * keep the first that carries each field rather than inventing a merge.
 */
export function summariseRules(ruleIds, bookingRules) {
  const detail = { message: null, phone: null, url: null, deadline: null };
  let found = false;
  for (const id of ruleIds) {
    const rule = bookingRules.get(id);
    if (!rule) continue;
    found = true;
    for (const key of Object.keys(detail)) {
      if (detail[key] === null && rule[key] !== null) detail[key] = rule[key];
    }
  }
  return found ? detail : null;
}
