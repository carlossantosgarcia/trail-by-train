import styles from './HideLowFreqToggle.module.css';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function HideLowFreqToggle({ value, onChange }: Props) {
  return (
    <label className={styles.row}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>Masquer les lignes peu fréquentes</span>
    </label>
  );
}
