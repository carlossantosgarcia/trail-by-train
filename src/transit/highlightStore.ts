// Tiny pub/sub store for the focused route. At most one route is focused at a
// time, scoped to a single provider (route_id is provider-local). Tapping a
// line, a search result or an Explore chip writes; the map draws it bold with
// its stops, and the focus bar names it while its card is closed.

import { useEffect, useState } from 'react';

export type TransitHighlight = {
  providerId: string;
  routeId: string;
  /** Frame the route on the map as it is focused. */
  fit?: boolean;
} | null;

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
