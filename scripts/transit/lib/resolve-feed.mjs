// Which file to download for a network.
//
// A config's `gtfsUrl` is often a dated file on static.data.gouv.fr: the
// edition current when the network was added. When the operator publishes a
// new edition, that URL keeps serving the old one, or disappears. The
// transport.data.gouv.fr catalogue lists each dataset's current resources, so
// the build asks it, and keeps `gtfsUrl` as the fallback.

export const CATALOGUE_URL = 'https://transport.data.gouv.fr/api/datasets';

/** The catalogue, keyed by dataset slug; null when it cannot be fetched. */
export async function fetchCatalogue(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(CATALOGUE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('not a list');
    return new Map(list.map((d) => [d.slug, d]));
  } catch (err) {
    console.warn(
      `transport.data.gouv.fr catalogue unavailable (${err.message}); using configured URLs`,
    );
    return null;
  }
}

/** The dataset slug a `sourceUrl` names, or null. */
export function datasetSlug(sourceUrl) {
  return /transport\.data\.gouv\.fr\/datasets\/([^/?#]+)/.exec(sourceUrl ?? '')?.[1] ?? null;
}

const urlsOf = (r) => [r.original_url, r.url].filter(Boolean);

/**
 * The URL to download for `config`, and why.
 *
 * Only single-URL networks are resolved: a network published as several
 * archives names each one on purpose. Among a dataset's available GTFS
 * resources, one is taken as is; with several, the configured URL wins while
 * it is still listed — it may be the one network of several the dataset
 * carries — and otherwise the most recently updated one is taken.
 */
export function resolveFeedUrl(config, catalogue) {
  const configured = config.gtfsUrl;
  if (Array.isArray(configured) || !catalogue) return { url: configured, reason: 'configured' };
  const dataset = catalogue.get(datasetSlug(config.sourceUrl));
  if (!dataset) return { url: configured, reason: 'configured' };
  const gtfs = (dataset.resources ?? []).filter(
    (r) => r.format === 'GTFS' && r.is_available !== false && urlsOf(r).length > 0,
  );
  if (gtfs.length === 0) return { url: configured, reason: 'configured' };
  if (gtfs.some((r) => urlsOf(r).includes(configured))) {
    return { url: configured, reason: 'configured' };
  }
  const newest = [...gtfs].sort((a, b) =>
    String(b.updated ?? '').localeCompare(String(a.updated ?? '')),
  )[0];
  return {
    url: newest.original_url ?? newest.url,
    reason: gtfs.length === 1 ? 'catalogue' : 'catalogue-newest',
  };
}
