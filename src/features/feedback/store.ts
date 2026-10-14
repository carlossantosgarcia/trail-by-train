// Which report form is open, if any. A module store like the popups': any
// button can open the form, and the one dialog mounted in App renders it.

import { useSyncExternalStore } from 'react';
import type { FeedbackSubject } from './subject';

let current: FeedbackSubject | null = null;
const listeners = new Set<() => void>();

export function openFeedback(subject: FeedbackSubject): void {
  current = subject;
  listeners.forEach((l) => l());
}

export function closeFeedback(): void {
  current = null;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFeedbackSubject(): FeedbackSubject | null {
  return useSyncExternalStore(subscribe, () => current);
}
