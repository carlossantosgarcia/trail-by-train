## Context

The app has no i18n layer: strings are literals in about sixty modules, some
French, some English. Some live outside React: the GR popup is built with
plain DOM, freshness labels and effort definitions are computed in plain
modules, and the uPlot chart draws its axis labels once.

## Goals / Non-Goals

**Goals:**

- One place per language for every interface string, with a missing
  translation caught by the type check, not by a user.
- Switching without a reload and without losing map state.
- No dependency.

**Non-Goals:**

- Translating data (names, operator texts) or the search index.
- A third language now; the structure should allow one.
- Server-side or URL-based language (`/en/`): the app is a static SPA.

## Decisions

- **Flat dictionaries, French as the reference.** `fr.ts` holds every key;
  `en.ts` is typed `Messages` from it, so a key missing in English fails
  `tsc`. A message is a string with `{name}` placeholders, or a function of
  its parameters when the wording depends on them (plurals). A test checks
  that both dictionaries carry the same placeholders.
- **A module store, not a context.** `getLocale`/`setLocale`/`useLocale`,
  like the app's other stores. `useT()` subscribes the calling component and
  returns `t`; plain modules call `t()` when they build their output. App
  calls `useT()` too, so its whole tree re-renders on a switch. Anything
  already built outside React (an open GR popup) changes at its next build.
- **Labels in tables become keys.** Constant tables of labels (reservation,
  service kind, search kinds, day picker) hold message keys and are resolved
  at render; effort definitions expose getters, so callers are unchanged.
- **Detection.** The first entry of `navigator.languages` whose base is `fr`
  or `en` wins; anything else gets English, the more widely read of the two.
  The stored choice overrides detection. `index.html` mirrors this to stamp
  `<html lang>` before first paint, as it does for the theme.
- **Feedback keeps its wire format.** Categories stay French values (the
  relay checks them); the form shows them translated. The issue body built
  for GitHub stays French, for the maintainers.
- **Media in either language.** The capture scripts find buttons by their
  labels in the language `UI_LANG` names (French by default); `open()` stores
  `hp.lang` like it marks the tutorial seen.

## Risks / Trade-offs

- [A new string added as a literal] → review; the dictionaries are the only
  place a reviewer should see interface text.
- [Chart and plain-DOM popups lag a switch] → the chart rebuilds on a locale
  change; popups are rebuilt on their next opening.
