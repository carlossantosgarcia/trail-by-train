// What the user does to the map, for the mobile sheets that should get out of
// the way when it happens. Map.tsx publishes; sheets subscribe.
//
// A tap on a feature reaches the feature's own click handler and the map's
// general one in the same dispatch, in no guaranteed order. Feature handlers
// call claimMapTap(), and the tap is published on the next tick, so a listener
// can tell "tapped a line" from "tapped empty map".

import { useEffect, useRef } from 'react';

export type MapGesture = { kind: 'pan' } | { kind: 'tap'; claimed: boolean };

type Listener = (g: MapGesture) => void;

const listeners = new Set<Listener>();
let claimed = false;

function emit(g: MapGesture): void {
  for (const fn of listeners) fn(g);
}

/** Called by a feature's click handler: this tap opened something. */
export function claimMapTap(): void {
  claimed = true;
}

/** A user-initiated pan, zoom or rotate started. */
export function publishMapPan(): void {
  emit({ kind: 'pan' });
}

/** A click on the map; publish once every handler of this click has run. */
export function publishMapTap(): void {
  setTimeout(() => {
    const c = claimed;
    claimed = false;
    emit({ kind: 'tap', claimed: c });
  }, 0);
}

export function subscribeMapGestures(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Run `handler` on each gesture while `enabled`. The latest handler is used. */
export function useMapGesture(handler: Listener, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return subscribeMapGestures((g) => ref.current(g));
  }, [enabled]);
}
