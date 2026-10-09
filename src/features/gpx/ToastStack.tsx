import { dismissToast, useToasts } from './toast';
import styles from './ToastStack.module.css';
import { CloseIcon } from '../../components/icons/lucide';

export default function ToastStack() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${t.kind === 'error' ? styles.error : ''}`}>
          {t.kind === 'error' && (
            <span className={styles.errorIcon} aria-hidden>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 1.5 15 14H1L8 1.5Z" strokeLinejoin="round" />
                <path d="M8 6.5v3.2" strokeLinecap="round" />
                <circle cx="8" cy="11.8" r=".85" fill="currentColor" stroke="none" />
              </svg>
            </span>
          )}
          <span>{t.text}</span>
          <button
            type="button"
            className={styles.close}
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
