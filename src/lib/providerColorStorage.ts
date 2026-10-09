// Per-provider line-color override. `null` means "use the provider's
// built-in default" (provider.lineColor in ProviderConfig).

function keyFor(providerId: string): string {
  return `hp:provider-color:${providerId}`;
}

export function readProviderColor(providerId: string): string | null {
  try {
    const raw = window.localStorage.getItem(keyFor(providerId));
    return isHex(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeProviderColor(providerId: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(keyFor(providerId));
      return;
    }
    if (!isHex(value)) return;
    window.localStorage.setItem(keyFor(providerId), value);
  } catch {
    // Storage unavailable.
  }
}

function isHex(v: string | null): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

const PREFIX = 'hp:provider-color:';

/**
 * Drop stored colour overrides for providers that no longer exist. See the
 * matching note in transitVisibilityStorage — same reasoning, same trigger.
 */
export function pruneUnknownProviderColors(knownIds: readonly string[]): void {
  try {
    const known = new Set(knownIds);
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX) && !known.has(key.slice(PREFIX.length))) stale.push(key);
    }
    for (const key of stale) window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable — nothing to prune.
  }
}
