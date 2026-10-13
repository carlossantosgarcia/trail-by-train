## Context

The study's index was first meant to be published on the `data-latest`
release and refreshed by a weekly crawl in CI. Each step of that crawl needs
judgement (a network losing half its links is usually a site redesign, not
withdrawn timetables), so a person reviews every refresh anyway. Committing the
result keeps that review in a pull request.

## Decisions

### CSV in the repository, not a dataset on the release

- **Reviewable:** a refresh is a diff of rows, readable on GitHub as a table.
- **Editable:** a wrong link is one row, fixed in any editor or spreadsheet.
- **Shipped with the app:** no change to the Data workflow or `check:data`, and
  a fix is live on the next deploy.
- **Small:** 4,479 rows, 650 kB in all, under 40 kB for most networks.

One file per network, named after its provider id, so the app loads only the
networks a hiker opens. Vite's `import.meta.glob` turns each file into a
lazily loaded chunk, so no build script is needed.

### Labels without dates

The label says what the document is; the app appends the stated dates
("· du 01/09/26 au 31/08/27"). Correcting a date then cannot leave a stale
label.

### Validity is what the operator states

`valid_from` and `valid_to` come from the text next to the link or inside the
PDF, never from an edition name ("2026-2027") or a September start. Most rows
have neither, and are linked until someone corrects them.

### Expired documents are left out

The export drops documents whose stated end date has passed, and the app drops
any that expire after it ships. Six networks, whose only sheets are last
season's (shuttles, Charente, Vienne), have no file and keep the search link.

## Risks

- **Links go stale between refreshes.** Operators republish under new URLs each
  season. The search link remains for lines without a PDF, and a broken link
  costs one click; a refresh is a pull request.
- **A site that refuses automated requests** (BreizhGo, Nomad) cannot be
  verified by download. Such a link is kept only when a search engine shows it
  as the current edition.
