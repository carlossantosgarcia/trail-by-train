// Tiny pub/sub store for the transit popup. Map.tsx writes to it from
// click handlers; <TransitPopup/> reads from it. Mirrors the lightweight
// store pattern used by the curated-hikes feature.

import type { TransitLineProperties, TransitStopProperties } from './types';

export type TransitPopupTarget =
  | { kind: 'line'; providerId: string; props: TransitLineProperties; anchor: [number, number] }
  | { kind: 'stop'; providerId: string; props: TransitStopProperties; anchor: [number, number] }
  | null;

type Listener = (target: TransitPopupTarget) => void;

let current: TransitPopupTarget = null;
const listeners = new Set<Listener>();

export function getTransitPopupTarget(): TransitPopupTarget {
  return current;
}

export function setTransitPopupTarget(target: TransitPopupTarget): void {
  current = target;
  for (const fn of listeners) fn(current);
}

export function subscribeTransitPopup(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
