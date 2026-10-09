import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  kind: 'error' | 'info';
  text: string;
}

let nextId = 1;
let toasts: Toast[] = [];
const subscribers = new Set<() => void>();
const TOAST_TTL_MS = 6000;

function emit(): void {
  for (const s of subscribers) s();
}

export function pushToast(msg: { kind: 'error' | 'info'; text: string }): number {
  const id = nextId++;
  toasts = [...toasts, { id, ...msg }];
  emit();
  setTimeout(() => dismissToast(id), TOAST_TTL_MS);
  return id;
}

export function dismissToast(id: number): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot(): Toast[] {
  return toasts;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
