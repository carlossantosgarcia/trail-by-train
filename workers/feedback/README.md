# Feedback relay

A Cloudflare Worker that turns the app's "Envoyer un retour" form into GitHub
issues, so people can report errors or suggest lines without a GitHub account.
Issues are opened by the `trail-by-train-feedback` GitHub App, installed on this
repository only with Issues: write.

For each report it checks, in order: the request's origin, the report's shape,
the Cloudflare Turnstile token, the per-visitor limit (3 a minute) and the daily
cap (`DAILY_CAP` issues a day, counted in the `COUNTS` KV namespace). The
visitor's IP address keys the per-minute count inside Cloudflare and is never
stored or sent to GitHub.

## Configuration

| Name                     | Where           | What                                                   |
| ------------------------ | --------------- | ------------------------------------------------------ |
| `GITHUB_APP_ID`          | `wrangler.toml` | The App's id                                           |
| `GITHUB_REPO`            | `wrangler.toml` | `owner/name` of the repository                         |
| `ALLOWED_ORIGINS`        | `wrangler.toml` | Origins of the live site, comma-separated              |
| `DAILY_CAP`              | `wrangler.toml` | Issues a day in all                                    |
| `GITHUB_APP_PRIVATE_KEY` | secret          | The App's private key, as PKCS#8 PEM                   |
| `TURNSTILE_SECRET`       | secret          | The Turnstile widget's secret key                      |
| `TEST_ORIGINS`           | secret          | Origins whose reports get the `test` label (a preview) |

The Turnstile site key and the Worker's URL are public; the app holds them in
`src/features/feedback/config.ts`.

## Deploying

Wrangler needs Node 22 or later. From this directory, with `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` set:

```sh
npx wrangler@4.143.0 deploy
openssl pkcs8 -topk8 -nocrypt -in app-key.pem | npx wrangler@4.143.0 secret put GITHUB_APP_PRIVATE_KEY
```

GitHub gives the App's key as PKCS#1; `openssl pkcs8` converts it. Tests run
with the app's: `npm test`.
