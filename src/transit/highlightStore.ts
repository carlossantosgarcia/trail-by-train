// Tiny pub/sub store for the active route highlight. At most one route is
// highlighted at a time, scoped to a single provider (route_id is
// provider-local). The popup writes; Map.tsx reads and drives MapLibre.

import { useEffect, useState } from 'react';

export type TransitHighlight = { providerId: string; routeId: string } | null;

type Listener = (highlight: TransitHighlight) => void;

let current: TransitHighlight = null;
const listeners = new Set<Listener>();

export function getTransitHighlight(): TransitHighlight {
  return current;
}

export function setTransitHighlight(highlight: TransitHighlight): void {
  current = highlight;
  for (const fn of listeners) fn(current);
}

export function subscribeTransitHighlight(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useTransitHighlight(): TransitHighlight {
  const [value, setValue] = useState<TransitHighlight>(getTransitHighlight());
  useEffect(() => subscribeTransitHighlight(setValue), []);
  return value;
}
