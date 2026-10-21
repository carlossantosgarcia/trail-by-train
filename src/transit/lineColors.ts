// The colour a bus line is drawn in, as one answer for the whole app. The map
// paints a network's lines in the network's colour (or the one the user chose
// for it), and Explore paints each matched line in its own palette colour. Every
// card, chip and list then asks this module, so a line looks the same on the
// map as in what opens when it is tapped.

import { useEffect, useState } from 'react';
import { getProvider } from './index';

type Listener = () => void;

/** The user's colour per network, null meaning the catalog colour. */
let networkColors: Record<string, string | null> = {};
/** Explore's per-line colours, by network then route, while Explore draws them. */
let exploreColors: Record<string, Record<string, string>> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function setNetworkColors(colors: Record<string, string | null>): void {
  networkColors = colors;
  emit();
}

export function setExploreLineColors(colors: Record<string, Record<string, string>> | null): void {
  exploreColors = colors;
  emit();
}

/** The colour a network's lines are drawn in outside Explore. */
export function networkColor(providerId: string): string {
  return networkColors[providerId] ?? getProvider(providerId)?.lineColor ?? '#64748b';
}

/** The colour this line is drawn in right now. */
export function lineColor(providerId: string, routeId: string): string {
  return exploreColors?.[providerId]?.[routeId] ?? networkColor(providerId);
}

/** Re-render when any line's colour may have changed. */
export function useLineColors(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
}
