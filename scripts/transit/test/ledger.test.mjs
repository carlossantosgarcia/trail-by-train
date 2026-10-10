import { describe, expect, it } from 'vitest';
import { assertNoRunawayChurn, ledgerShapeLookup } from '../lib/ledger.mjs';

describe('assertNoRunawayChurn', () => {
  it('fails when the live stops are unknown to the ledger (regenerated ids)', () => {
    expect(() => assertNoRunawayChurn('stops', 69, 882, 'p', 3)).toThrow(/regenerated/);
  });

  it('accepts a feed that dropped lines but kept its ids', () => {
    expect(() => assertNoRunawayChurn('stops', 69, 882, 'p', 69)).not.toThrow();
  });
});

describe('ledgerShapeLookup', () => {
  // A line along the 44.9° parallel, 0.04° (about 3 km) long.
  const entry = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [6.6, 44.9],
        [6.64, 44.9],
      ],
    },
    properties: {
      route_id: 'L1',
      route_short_name: '1',
      route_long_name: 'Briançon – Serre Chevalier',
      last_seen_on: '2026-09-10',
    },
  };
  const lookup = ledgerShapeLookup([entry]);
  const onLine = [
    [6.6, 44.9],
    [6.62, 44.9005],
    [6.64, 44.9],
  ];

  it('reuses the recorded shape when the stops lie on it', () => {
    const got = lookup({ route_id: 'L1' }, onLine);
    expect(got?.shape_seen_on).toBe('2026-09-10');
    expect(got?.geometry.coordinates).toHaveLength(2);
  });

  it('refuses when the line now serves stops off the recorded shape', () => {
    expect(lookup({ route_id: 'L1' }, [...onLine, [6.62, 44.95]])).toBeNull();
  });

  it('finds a renumbered line by name', () => {
    const route = {
      route_id: 'NEW',
      route_short_name: '1',
      route_long_name: 'Briançon – Serre Chevalier',
    };
    expect(lookup(route, onLine)).not.toBeNull();
  });

  it('keeps the original date of a shape that was already borrowed', () => {
    const again = ledgerShapeLookup([
      {
        ...entry,
        properties: {
          ...entry.properties,
          last_seen_on: '2026-10-10',
          shape_seen_on: '2026-09-10',
        },
      },
    ]);
    expect(again({ route_id: 'L1' }, onLine)?.shape_seen_on).toBe('2026-09-10');
  });
});
