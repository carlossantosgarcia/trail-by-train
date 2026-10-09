// Shared, cached access to each provider's `meta.json`.
//
// The validity banner already fetched meta, but privately. The line popup needs
// the same file to answer "when was this last confirmed?", and fetching it
// twice per provider would be wasteful — so the fetch lives here once, keyed by
// provider, and both callers share the result.
//
// Failures are deliberately soft: if meta cannot be loaded the popup simply
// omits the freshness line rather than blocking on it.

import { useEffect, useState } from 'react';
import { getProvider } from './index';
import type { TransitProviderMeta } from './types';

const cache = new Map<string, Promise<TransitProviderMeta | null>>();

export function loadProviderMeta(providerId: string): Promise<TransitProviderMeta | null> {
  const cached = cache.get(providerId);
  if (cached) return cached;
  const provider = getProvider(providerId);
  if (!provider) return Promise.resolve(null);
  const pending = fetch(provider.metaUrl)
    .then((res) => (res.ok ? (res.json() as Promise<TransitProviderMeta>) : null))
    .catch(() => null);
  cache.set(providerId, pending);
  return pending;
}

export function useProviderMeta(providerId: string): TransitProviderMeta | null {
  const [meta, setMeta] = useState<TransitProviderMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadProviderMeta(providerId).then((m) => {
      if (!cancelled) setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [providerId]);
  return meta;
}
