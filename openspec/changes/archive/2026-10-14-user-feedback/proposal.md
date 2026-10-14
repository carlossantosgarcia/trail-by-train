## Why

People who use the map find wrong timetables, broken PDF links, misplaced
stops and errors in hikes, and have ideas: a line to add, a feature. Today they
can only say so through GitHub issues, which needs an account most hikers do
not have. Reports that do arrive rarely say which line or hike they mean.

## What Changes

- **"Envoyer un retour"** in the line popup, the hike popup and the controls
  panel. It opens a short form: a category, a message, and the context the app
  already knows (network, line and `route_id`, or the hike; map position and
  zoom; app version), shown so the sender sees what is sent. Up to three links
  may be added, such as a timetable PDF the sender found.
- **No account needed.** The form posts to a small Cloudflare Worker,
  `workers/feedback/`, that checks a Cloudflare Turnstile token, limits how
  often one visitor can send, and opens a GitHub issue labelled `feedback` and
  `line`, `hike` or `general`. Issues are opened by a GitHub App,
  `trail-by-train-feedback[bot]`, whose key lives only in the Worker.
- **Public by design.** Reports become public issues. The form says so and asks
  for no contact details.
- **Soft failure.** If the Worker cannot be reached, the form says so and offers
  the GitHub issue page instead. The map is unaffected.

## Non-goals

- Replying to senders: there is no contact field.
- Images. Storing them safely needs private storage and moderation.
- Reports on stops, GR trails or rail stations. The general button covers them;
  dedicated buttons can follow.
- Moderation tooling beyond GitHub's own.

## Capabilities

### New Capabilities

- `user-feedback`: the report form, its entry points, and the Worker that turns
  a report into an issue.

## Impact

- `workers/feedback/` (new): Worker, `wrangler.toml`, README, tests. Deployed with
  Wrangler; secrets `GITHUB_APP_PRIVATE_KEY` and `TURNSTILE_SECRET` set in
  Cloudflare.
- GitHub: the `trail-by-train-feedback` App, installed on this repository only
  with Issues: write; `feedback`, `line`, `hike`, `general` and `test` labels.
- App: `src/features/feedback/` (form, store, Turnstile loader), a button in
  `TransitPopup`, `HikePopup` and the controls panel; the Worker URL and
  Turnstile site key in its config.
- Deploy: `VITE_APP_VERSION` set to the commit.
- Turnstile's script loads only when the form opens.
