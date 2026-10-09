// Shared French collators. `a.localeCompare(b, 'fr', …)` builds a new
// Intl.Collator on every call, which made sorting a couple of dozen Explore
// results take hundreds of milliseconds on a phone. Build each one once.

const fr = new Intl.Collator('fr');
const frNumeric = new Intl.Collator('fr', { numeric: true });

/** Alphabetical, French rules. */
export const compareFr = fr.compare;

/** Alphabetical with digit runs compared as numbers ("2" before "10"). */
export const compareFrNumeric = frNumeric.compare;
