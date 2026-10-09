import styles from './HideLowFreqToggle.module.css';

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
  return (
    <label className={styles.row}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>Afficher les lignes hors horaire actuel</span>
    </label>
  );
}
