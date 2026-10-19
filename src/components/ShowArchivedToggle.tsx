import styles from './CheckboxToggle.module.css';
import { useT } from '../i18n';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Lines an operator has stopped publishing stay on the map by default, drawn
 * dashed and faded. This hides them for anyone who only wants the offer that
 * is running right now.
 */
export default function ShowArchivedToggle({ value, onChange }: Props) {
  const t = useT();
  return (
    <label className={styles.row}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>{t('bus.showArchived')}</span>
    </label>
  );
}
