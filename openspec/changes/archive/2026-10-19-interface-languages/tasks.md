## 1. Core

- [x] 1.1 `src/i18n/`: locale store, detection, `t`/`useT`, `formatIsoDate`; `fr.ts` reference, `en.ts` typed against it
- [x] 1.2 `index.html` stamps `<html lang>` before first paint; the page title follows the language
- [x] 1.3 `LanguageSwitch` (FR | EN) in the controls' footer and the tutorial

## 2. Strings

- [x] 2.1 Shell, dock, panel, mobile sheet, layer sections, day picker, colour palette, basemaps
- [x] 2.2 Transit popup, freshness and validity labels, timetable PDF links
- [x] 2.3 Explore mode, search
- [x] 2.4 GPX: track list, elevation panel and chart, effort explainers, errors and toasts
- [x] 2.5 Hike popup and duration filter, GR popup, sleep markers
- [x] 2.6 Feedback form, keeping French categories and issue body on the wire

## 3. Verification

- [x] 3.1 Tests: detection, interpolation, plurals, both dictionaries complete with the same placeholders
- [x] 3.2 `npm run lint`, `npm test`, `npm run build`
- [x] 3.3 Media pinned to French; captures unchanged
- [x] 3.4 Check on a preview: detection on a fresh browser, switching on desktop and mobile, a GPX and a popup in both languages
