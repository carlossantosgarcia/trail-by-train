## Why

The interface mixes French and English (the layer controls and Explore in
French, the GPX tools and their explainers in English), so it reads as
unfinished in either language, and visitors from outside France have no
English version at all. Offering both, chosen once per browser, fixes the
mix and opens the app to hikers who do not read French.

## What Changes

- Every interface string exists in **French and English**: controls, popups,
  sheets, Explore, search, GPX tools and effort explainers, the feedback form,
  toasts and the tutorial. Data is shown as published (line, stop and place
  names, hike titles, operator notes, attributions).
- The language is **detected** from the browser's preferences (the first of
  French or English it lists; English otherwise) and can be **switched** with
  a small FR | EN control. The choice is stored in `localStorage` (`hp.lang`)
  and never sent anywhere.
- The switch sits at the end of the controls' footer row, beside "Envoyer un
  retour", which the desktop panel and the mobile sheet share, and in the
  tutorial's corner.
- Switching re-renders the interface in place: no reload, the map and the
  panels keep their state. Dates follow the language (17/10/2026,
  17 Oct 2026); `<html lang>` and the page title follow it too.
- Feedback still sends the French category names the relay expects, and
  issues keep their French body; only what the form shows is translated.
- The README media are captured in French unless `UI_LANG=en` is set; the
  tutorial's clips and stills are captured in both languages.

## Capabilities

### New Capabilities

- `interface-languages`: which languages exist, how the language is chosen
  and stored, where it is switched, what is and is not translated.

### Modified Capabilities

- `map-chrome`: the controls' footer row carries the language switch.

## Impact

- New `src/i18n/` (store, `fr.ts` reference dictionary, `en.ts` typed
  against it, date formatting) and `components/LanguageSwitch`.
- Every component with interface text reads it through `useT()`; non-React
  builders (GR popup, hike sleep markers, freshness labels, effort
  definitions) call `t()` when they build.
- `index.html` sets `<html lang>` before first paint.
- `scripts/media/lib.mjs` pins captures to French.
- No new dependency, no data change.
