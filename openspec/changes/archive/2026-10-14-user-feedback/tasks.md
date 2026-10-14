## 1. Worker

- [x] 1.1 `workers/feedback/`: validate the report, verify Turnstile, rate-limit (per visitor per minute, per day overall), create the issue with labels as the GitHub App; CORS for the site's origins
- [x] 1.2 Links: up to three `https://` addresses, shown as code
- [x] 1.3 Tests for validation, issue title and body, origins, App sign-in and errors (GitHub and Turnstile mocked)
- [x] 1.4 `wrangler.toml`; deploy; App key and preview origin as secrets; labels created on GitHub
- [x] 1.5 `TURNSTILE_SECRET` set in Cloudflare

## 2. App

- [x] 2.1 Feedback form (dialog / bottom sheet): category, message, context shown, Turnstile loaded on open, success with the issue link, fallback to GitHub when not configured or failing
- [x] 2.2 "Envoyer un retour" in the line popup, the hike popup and the controls panel
- [x] 2.3 Worker URL and site key in `config.ts` (overridable); `VITE_APP_VERSION` in the deploy workflow

## 3. Verify

- [x] 3.1 `npm run lint`, `npm test`, `npm run build`
- [x] 3.2 Preview: a line report, a hike report and a general report become issues labelled `test`; a fourth report within a minute is refused; phone layout
