import { useEffect, useMemo, useRef, useState } from 'react';
import { currentMapView } from '../../lib/currentMap';
import { FEEDBACK_URL, TURNSTILE_SITE_KEY } from './config';
import { linksValid, newIssueUrl, parseLinks, reportContext, contextRows } from './report';
import { closeFeedback, useFeedbackSubject } from './store';
import {
  CATEGORIES,
  LINKS_MAX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  subjectSummary,
  type FeedbackSubject,
} from './subject';
import { loadTurnstile } from './turnstile';
import styles from './FeedbackDialog.module.css';

type Status =
  | { state: 'editing' }
  | { state: 'sending' }
  | { state: 'sent'; url: string }
  | { state: 'failed'; reason: string };

const REASONS: Record<string, string> = {
  rate: 'Trop d’envois d’un coup : réessayez dans une minute.',
  cap: 'Beaucoup de signalements aujourd’hui : réessayez demain, ou passez par GitHub.',
  turnstile: 'La vérification anti-robot a échoué. Réessayez.',
};
const DEFAULT_REASON = 'L’envoi n’a pas abouti.';

/** The one report form, opened by any "Envoyer un retour" button. */
export default function FeedbackDialog() {
  const subject = useFeedbackSubject();
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (subject && !d.open) {
      d.showModal();
      // Focus the sheet itself: no ring on the close button, and no keyboard
      // popping up over the form on a phone.
      d.focus();
    }
    if (!subject && d.open) d.close();
  }, [subject]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      tabIndex={-1}
      aria-labelledby="feedback-title"
      onClose={closeFeedback}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) closeFeedback();
      }}
    >
      {subject && <FeedbackForm key={JSON.stringify(subject)} subject={subject} />}
    </dialog>
  );
}

function FeedbackForm({ subject }: { subject: FeedbackSubject }) {
  const categories = CATEGORIES[subject.kind];
  const [category, setCategory] = useState(categories[0]);
  const [message, setMessage] = useState('');
  const [linksText, setLinksText] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [captchaFailed, setCaptchaFailed] = useState<string | null>(null);
  // Problems are shown once the user tries to send, not while they type.
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<Status>({ state: 'editing' });
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);

  // Read once, when the form opens: where the user was looking.
  const context = useMemo(
    () => reportContext(subject, currentMapView(), window.location.href),
    [subject],
  );
  const links = parseLinks(linksText);
  const linksOk = linksValid(links, LINKS_MAX);
  const messageOk = message.trim().length >= MESSAGE_MIN && message.length <= MESSAGE_MAX;
  const relay = FEEDBACK_URL !== '';
  const githubUrl = newIssueUrl(subject, category, message.trim(), links, context);

  useEffect(() => {
    if (!relay) return;
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !captchaRef.current) return;
        widgetRef.current = ts.render(captchaRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => setToken(t),
          'error-callback': (code?: string) => {
            setCaptchaFailed(code ?? 'inconnu');
            // Turnstile retries on its own; stop it from showing an error loop.
            return true;
          },
          'expired-callback': () => setToken(null),
          language: 'fr',
          size: 'flexible',
          // Always visible, so the user sees the check pass (or what it wants).
          appearance: 'always',
        });
      })
      .catch(() => !cancelled && setCaptchaFailed('chargement'));
    return () => {
      cancelled = true;
      if (widgetRef.current) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [relay]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!messageOk || !linksOk) return;
    if (!relay) {
      window.open(githubUrl, '_blank', 'noopener');
      return;
    }
    if (!token) return;
    setStatus({ state: 'sending' });
    try {
      const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: subject.kind,
          category,
          message: message.trim(),
          links,
          token,
          context,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (res.ok && data.ok && data.url) setStatus({ state: 'sent', url: data.url });
      else setStatus({ state: 'failed', reason: REASONS[data.error ?? ''] ?? DEFAULT_REASON });
    } catch {
      setStatus({ state: 'failed', reason: DEFAULT_REASON });
    }
    // A Turnstile token is single-use.
    setToken(null);
    if (widgetRef.current) window.turnstile?.reset(widgetRef.current);
  }

  const summary = subjectSummary(subject);

  if (status.state === 'sent') {
    return (
      <div className={styles.body}>
        <h2 id="feedback-title" className={styles.title}>
          Merci !
        </h2>
        <p className={styles.text}>
          Votre signalement est publié. Vous pouvez suivre sa correction sur{' '}
          <a href={status.url} target="_blank" rel="noopener noreferrer">
            sa page GitHub
          </a>
          .
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={closeFeedback}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.body} onSubmit={send}>
      <div className={styles.head}>
        <h2 id="feedback-title" className={styles.title}>
          Envoyer un retour
        </h2>
        <button type="button" className={styles.close} aria-label="Fermer" onClick={closeFeedback}>
          ×
        </button>
      </div>
      {summary && <p className={styles.subject}>{summary}</p>}

      <label className={styles.field}>
        <span className={styles.label}>Sujet</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={MESSAGE_MAX}
          placeholder="Une erreur, une ligne à ajouter, une idée…"
          aria-invalid={tried && !messageOk}
        />
        <span className={`${styles.hint} ${tried && !messageOk ? styles.bad : ''}`}>
          {message.trim().length < MESSAGE_MIN
            ? tried
              ? `Écrivez votre message : ${MESSAGE_MIN} caractères au moins.`
              : `${MESSAGE_MIN} caractères au moins`
            : `${message.length} / ${MESSAGE_MAX}`}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Liens (facultatif)</span>
        <textarea
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          rows={1}
          placeholder="https://…"
        />
        <span className={`${styles.hint} ${linksOk ? '' : styles.bad}`}>
          {linksOk
            ? `Fiche horaire, page de l’opérateur… ${LINKS_MAX} au plus, un par ligne`
            : `Jusqu’à ${LINKS_MAX} liens commençant par https://`}
        </span>
      </label>

      <details className={styles.context}>
        <summary>Ce qui sera envoyé avec votre message</summary>
        <dl>
          {contextRows(context).map(([k, v]) => (
            <div key={k} className={styles.row}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </details>

      <p className={styles.notice}>
        Publié sur GitHub, visible par tous : pas d’informations personnelles. Aucun compte
        nécessaire.
      </p>

      {relay && <div ref={captchaRef} className={styles.captcha} />}

      {status.state === 'failed' && (
        <p className={styles.error} role="alert">
          {status.reason}{' '}
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            Signaler sur GitHub
          </a>{' '}
          (compte nécessaire).
        </p>
      )}
      {relay && tried && !token && !captchaFailed && messageOk && linksOk && (
        <p className={styles.error} role="alert">
          Terminez la vérification « Vérifiez que vous êtes humain » ci-dessus, puis envoyez.
        </p>
      )}
      {captchaFailed && status.state !== 'failed' && (
        <p className={styles.error} role="alert">
          La vérification anti-robot a échoué (code {captchaFailed}).{' '}
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            Signaler sur GitHub
          </a>{' '}
          (compte nécessaire).
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={closeFeedback}>
          Annuler
        </button>
        <button type="submit" className={styles.primary} disabled={status.state === 'sending'}>
          {!relay ? 'Continuer sur GitHub' : status.state === 'sending' ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </form>
  );
}
