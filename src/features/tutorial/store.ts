// Whether the tutorial is open. A module store like the feedback form's: the
// dock's info button and the first-visit check open it, and the one dialog
// mounted in App renders it.

import { useSyncExternalStore } from 'react';
import { writeTutorialSeen } from '../../lib/tutorialStorage';

let open = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (open === value) return;
  open = value;
  listeners.forEach((l) => l());
}

export function openTutorial(): void {
  set(true);
}

/** Closing, by whatever means, counts as seen: the user has decided. */
export function closeTutorial(): void {
  writeTutorialSeen();
  set(false);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTutorialOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
