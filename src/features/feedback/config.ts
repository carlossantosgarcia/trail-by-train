// Where reports go. Both values are public: the Worker only accepts the site's
// own origins, and the Turnstile key is meant to sit in the page. A build can
// point elsewhere, or set VITE_FEEDBACK_URL to an empty string to send people
// to GitHub's new-issue page instead.

const env = import.meta.env;

export const FEEDBACK_URL: string =
  env.VITE_FEEDBACK_URL ?? 'https://feedback.trail-by-train.workers.dev/';
export const TURNSTILE_SITE_KEY: string = env.VITE_TURNSTILE_SITE_KEY ?? '0x4AAAAAAFV8_w_GOUp0G3Pw';
export const NEW_ISSUE_URL = 'https://github.com/carlossantosgarcia/trail-by-train/issues/new';
export const APP_VERSION: string = env.VITE_APP_VERSION ?? 'dev';
