import { openFeedback } from './store';
import type { FeedbackSubject } from './subject';
import styles from './FeedbackDialog.module.css';
import { useT } from '../../i18n';

/** The quiet "Envoyer un retour" link under a popup or the controls. */
export default function FeedbackButton({ subject }: { subject: FeedbackSubject }) {
  const t = useT();
  return (
    <button type="button" className={styles.trigger} onClick={() => openFeedback(subject)}>
      {t('feedback.open')}
    </button>
  );
}
