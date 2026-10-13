## Why

A line popup's "Voir les horaires →" link is, for most networks, a web search
for the network, the line and "horaires". The hiker then has to pick the right
document among the results, and often lands on a stale copy or an aggregator.

The document they need is the operator's own timetable PDF. It is also the only
source for the operator's rules: which days count as school holidays, which
trips run on public holidays, which stops are served only in summer.

A study crawled the operators' sites and found a PDF, confirmed by downloading
it, for 4,369 of the app's lines across 49 networks.

## What Changes

- **The links are committed**, one CSV per network in `data/timetable-pdfs/`:
  `route_id`, the line's name for readers, the URL, a short label ("Fiche
  horaire", "Guide du réseau", "Fiche horaire (été)"), the validity dates the
  operator states, and whether the document covers one line or the whole
  network. A link is fixed by editing a row; a refresh replaces a network's
  file.
- **The line popup links the PDFs instead of the search**: up to three
  "<label> (PDF) →" links, the stated dates appended. A document past its
  stated end date is not linked, and a line left without one keeps the search
  link.
- **Each network's file loads on demand**, as its own small chunk, the first
  time one of its lines is opened. A network without a file behaves as today.
- **A test checks every file**: header, URLs, dates, scope, duplicates, and
  that the file is named after a known network.

## Non-goals

- Refreshing the links automatically. The crawl needs a person to look at what
  changed; it stays outside the repository for now.
- Reading times out of the PDFs.
- Redistributing the PDFs: the app links to the operator's copy.

## Capabilities

### Modified Capabilities

- `public-transit`: the line popup links the operator's PDFs; new requirement
  for the committed PDF lists.

## Impact

- `data/timetable-pdfs/*.csv` and its README (new).
- `src/transit/timetablePdfs.ts` (new, with tests); `TransitPopup.tsx` and its
  stylesheet.
- `DATA_LICENSES.md`: the PDFs are linked, not redistributed.
