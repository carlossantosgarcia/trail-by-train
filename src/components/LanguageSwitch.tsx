import { LOCALES, setLocale, useLocale, useT } from '../i18n';
import styles from './LanguageSwitch.module.css';

/**
 * FR | EN. Small enough for the controls' footer (shared by the desktop panel
 * and the mobile sheet) and the tutorial's corner. Each option is labelled in
 * its own language, so it can be found whichever one is showing.
 */
export default function LanguageSwitch({ className }: { className?: string }) {
  const t = useT();
  const current = useLocale();
  return (
    <div
      className={`${styles.switch} ${className ?? ''}`}
      role="radiogroup"
      aria-label={t('lang.label')}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === current}
          lang={l}
          title={t(l === 'fr' ? 'lang.fr' : 'lang.en')}
          aria-label={t(l === 'fr' ? 'lang.fr' : 'lang.en')}
          className={styles.option}
          onClick={() => setLocale(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
