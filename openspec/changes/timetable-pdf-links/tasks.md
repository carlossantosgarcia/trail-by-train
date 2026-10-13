## 1. Data

- [x] 1.1 `data/timetable-pdfs/<provider>.csv` from the study's export (verified downloads, best first, expired documents left out), plus a link found while reviewing (BreizhGo 9611)
- [x] 1.2 `data/timetable-pdfs/README.md`: columns, ordering, how to fix or refresh a file
- [x] 1.3 `DATA_LICENSES.md`: operator PDFs are linked, not redistributed

## 2. App

- [x] 2.1 `src/transit/timetablePdfs.ts`: CSV parsing, lazy per-network loading (soft failure), dates in the link text, expired documents dropped; unit tests
- [x] 2.2 A test validating every committed file
- [x] 2.3 Line popup: up to three PDF links in place of "Voir les horaires →"; search link otherwise

## 3. Verify

- [x] 3.1 `npm run lint`, `npm test`, `npm run build`
- [ ] 3.2 Preview: T40 (Isère), a Fluo line, a Rémi line in two departments, a line with summer and winter sheets, a network-wide guide, a line without a PDF (search link)
