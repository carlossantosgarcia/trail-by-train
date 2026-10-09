// Aggregated validity banner. Reads every visible provider's meta.json
// and renders the worst case across the set (expired > expiring-soon >
// healthy). Renders nothing when every visible feed is healthy. Off
// providers do not contribute.

import { useEffect, useState } from 'react';
import { getProvider } from './index';
import type { TransitProviderMeta } from './types';
import styles from './TransitValidityBanner.module.css';
import { WarningIcon } from '../components/icons/lucide';

const EXPIRING_SOON_DAYS = 30;

interface Props {
  enabledProviderIds: string[];
}

interface Loaded {
  providerId: string;
  meta: TransitProviderMeta;
}

interface BannerState {
  kind: 'expired' | 'expiring';
  label: string;
  validTo: string;
}

function daysUntil(validTo: string): number {
  const today = new Date();
  const target = new Date(validTo + 'T00:00:00Z');
  const ms = target.getTime() - today.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function frDate(iso: string | null): string {
  if (!iso) return '?';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Pick the single worst feed among visible providers. Expired beats
// expiring-soon; within a tier, earliest valid_to wins.
function selectWorst(loaded: Loaded[]): BannerState | null {
  let expired: Loaded | null = null;
  let expiring: Loaded | null = null;
  for (const entry of loaded) {
    const validTo = entry.meta.feed_valid_to;
    if (!validTo) continue;
    const days = daysUntil(validTo);
    if (days < 0) {
      if (!expired || validTo < expired.meta.feed_valid_to!) expired = entry;
    } else if (days <= EXPIRING_SOON_DAYS) {
      if (!expiring || validTo < expiring.meta.feed_valid_to!) expiring = entry;
    }
  }
  if (expired) {
    return {
      kind: 'expired',
      label: expired.meta.label,
      validTo: expired.meta.feed_valid_to!,
    };
  }
  if (expiring) {
    return {
      kind: 'expiring',
      label: expiring.meta.label,
      validTo: expiring.meta.feed_valid_to!,
    };
  }
  return null;
}

export default function TransitValidityBanner({ enabledProviderIds }: Props) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Loaded[] = [];
      for (const id of enabledProviderIds) {
        const provider = getProvider(id);
        if (!provider) continue;
        try {
          const res = await fetch(provider.metaUrl, { cache: 'no-cache' });
          if (!res.ok) continue;
          const meta = (await res.json()) as TransitProviderMeta;
          results.push({ providerId: id, meta });
        } catch {
          // Silently skip — banner is non-critical.
        }
      }
      if (!cancelled) setLoaded(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabledProviderIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const banner = selectWorst(loaded);
  if (!banner) return null;

  const expired = banner.kind === 'expired';
  const title = expired
    ? `${banner.label} : feed expiré le ${frDate(banner.validTo)} — relance le build pour rafraîchir.`
    : `${banner.label} : feed valide jusqu'au ${frDate(banner.validTo)}`;

  return (
    <div className={styles.wrap}>
      <div className={`${styles.chip} ${expired ? styles.stale : ''}`} title={title}>
        <span className={styles.label}>{banner.label}</span>
        <span className={styles.dates}>
          {expired ? (
            <>
              <WarningIcon /> expiré {frDate(banner.validTo)}
            </>
          ) : (
            `→ ${frDate(banner.validTo)}`
          )}
        </span>
      </div>
    </div>
  );
}
