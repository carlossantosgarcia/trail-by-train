// Cloudflare Turnstile, loaded the first time a report form opens, so the
// map itself never loads a third-party script.

interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      /** Returning true tells Turnstile the error is handled. */
      'error-callback'?: (code?: string) => boolean | void;
      'expired-callback'?: () => void;
      language?: string;
      size?: 'normal' | 'flexible' | 'compact';
      appearance?: 'always' | 'execute' | 'interaction-only';
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
      s.onerror = () => {
        loading = null;
        reject(new Error('turnstile'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}
