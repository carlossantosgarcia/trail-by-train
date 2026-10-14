## Context

The site is static (GitHub Pages), so a report needs somewhere to go. Issues
are where fixes are tracked: a wrong PDF link is a row in
`data/timetable-pdfs/<network>.csv`, and a report that names the network and
`route_id` points straight at it.

## Decisions

### A Worker relays to GitHub issues

The page cannot hold GitHub credentials. A Cloudflare Worker (free tier:
100,000 requests a day) is the only thing that talks to GitHub.

### Issues are opened by a GitHub App

The Worker signs in as the `trail-by-train-feedback` App: its private key signs
a JWT, exchanged for an installation token that lasts an hour, narrowed to
Issues: write on this repository and reused until it nears expiry.

- Issues show `trail-by-train-feedback[bot]` as author, not the maintainer.
- The key does not expire, unlike a personal token (a year at most).
- Uninstalling the App stops everything without touching anyone's account.

Alternatives: a hosted form service (reports end up in email, 50 to 250 a month
free), a pre-filled Google Form (leaves the app), `mailto:` (needs a mail app,
exposes an address). Each keeps reports away from where fixes happen.

### Abuse is stopped at the Worker

- **Turnstile:** each report carries a token the Worker checks with Cloudflare
  before doing anything else.
- **Rate limits:** at most 3 reports a minute from one visitor, counted by
  Cloudflare's rate-limiting binding (it counts over 10 or 60 seconds), and at
  most 50 issues a day in all, counted in Workers KV (one write per report,
  well within the free 1,000 a day). The visitor's IP address keys the
  per-minute count inside Cloudflare and is never stored or forwarded.
- **Origin:** only the site's own origins (the GitHub Pages site and the
  preview) are allowed through CORS.
- **Shape:** fields are checked and capped (message 10 to 2,000 characters);
  links are shown as code, not links, so an issue cannot become a link farm.
  The link field takes up to three `https://` addresses of 500 characters at
  most.

### What an issue looks like

Title: `[Ligne] Cars Région Isère T40 : Lien PDF`,
`[Randonnée] <name> : Tracé`, or `[Général] Horaires`. Body: the message as a
quote, the links as code, then a context table (network, line, `route_id`,
hike, position, zoom, app version, page). Labels: `feedback` plus `line`, `hike` or `general`, and
`test` when the report comes from the preview, so preview checks never mix
with real reports. A preview report leaves out the page address: the preview's
host is private.

### The form

A native modal dialog, centred on desktop and pinned to the bottom of the
screen on phones (not the map's `BottomSheet`: the form is modal and has no
snap points). "Annuler" and "Envoyer" sit in a bar that stays at the dialog's
bottom edge, so they stay in reach when the screen is short or the keyboard is
open; on a 375×667 phone the whole form fits without scrolling. The dialog
takes focus on opening, so no field brings up the keyboard. Categories depend on the
subject: for a line, "Horaires", "Tracé", "Arrêts", "Lien vers les horaires",
"Réservation", "Autre"; for a hike, "Tracé", "Accès en transport",
"Informations", "Autre"; in general, the union plus "Demande de ligne" and
"Suggestion". The context is listed under the message. On success the form
shows the issue's link.

"Envoyer" stays enabled. Pressing it with a message under 10 characters, a bad
link, or the Turnstile check unfinished sends nothing and says what is missing,
next to the field concerned. A disabled button gave no reason, and testers took
it for a broken form. The Turnstile widget is always visible, so the user sees
the check pass.

### Configuration

The Worker URL and Turnstile site key are public, so they are written in
`src/features/feedback/config.ts`; `VITE_FEEDBACK_URL` and
`VITE_TURNSTILE_SITE_KEY` override them, and an empty `VITE_FEEDBACK_URL` sends
people to GitHub's new-issue page instead. A fork or a local build that keeps
the defaults is refused by the Worker's origin check, and the form then offers
GitHub. The deploy sets `VITE_APP_VERSION` to the commit.

## Risks

- **Spam that gets past Turnstile** lands as public issues. The rate limit
  bounds it; the token can be revoked from GitHub at once.
- **GitHub refuses the App** (uninstalled, key revoked). The Worker answers 502
  and the form falls back to the GitHub link, so nothing breaks on the map.
- **Personal data in messages.** The form says reports are public; an issue can
  be edited or deleted.
