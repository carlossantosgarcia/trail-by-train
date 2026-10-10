import { describe, expect, it } from 'vitest';
import { datasetSlug, resolveFeedUrl } from '../lib/resolve-feed.mjs';

const SOURCE = 'https://transport.data.gouv.fr/datasets/reseau-x';
const res = (url, updated) => ({
  format: 'GTFS',
  original_url: url,
  url,
  updated,
  is_available: true,
});
const catalogue = (resources) => new Map([['reseau-x', { slug: 'reseau-x', resources }]]);

describe('resolveFeedUrl', () => {
  it('takes the newer edition when the pinned file is gone', () => {
    const cfg = { gtfsUrl: 'https://x/v6.zip', sourceUrl: SOURCE };
    expect(resolveFeedUrl(cfg, catalogue([res('https://x/v7.zip', '2026-09-29')])).url).toBe(
      'https://x/v7.zip',
    );
  });

  it('keeps the configured file while a dataset with several still lists it', () => {
    const cfg = { gtfsUrl: 'https://x/hiver.zip', sourceUrl: SOURCE };
    const cat = catalogue([
      res('https://x/ete.zip', '2026-10-01'),
      res('https://x/hiver.zip', '2026-01-01'),
    ]);
    expect(resolveFeedUrl(cfg, cat).url).toBe('https://x/hiver.zip');
  });

  it('falls back to the configured URL without a catalogue or a dataset', () => {
    const cfg = { gtfsUrl: 'https://x/v6.zip', sourceUrl: SOURCE };
    expect(resolveFeedUrl(cfg, null).url).toBe('https://x/v6.zip');
    expect(resolveFeedUrl({ ...cfg, sourceUrl: 'https://example.org' }, catalogue([])).url).toBe(
      'https://x/v6.zip',
    );
  });

  it('leaves multi-archive networks alone', () => {
    const cfg = { gtfsUrl: ['https://x/a.zip', 'https://x/b.zip'], sourceUrl: SOURCE };
    expect(resolveFeedUrl(cfg, catalogue([res('https://x/c.zip', '2026-10-01')])).url).toEqual(
      cfg.gtfsUrl,
    );
  });

  it('reads the dataset slug from the page URL', () => {
    expect(datasetSlug('https://transport.data.gouv.fr/datasets/navettes-tignes')).toBe(
      'navettes-tignes',
    );
  });
});
