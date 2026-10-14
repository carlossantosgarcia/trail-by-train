import { openFeedback } from './store';
import type { FeedbackSubject } from './subject';
import styles from './FeedbackDialog.module.css';

/** The quiet "Envoyer un retour" link under a popup or the controls. */
export default function FeedbackButton({ subject }: { subject: FeedbackSubject }) {
  return (
    <button type="button" className={styles.trigger} onClick={() => openFeedback(subject)}>
      Envoyer un retour
    </button>
  );
}
