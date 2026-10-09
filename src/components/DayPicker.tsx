import type { DayFilter } from '../transit';
import styles from './DayPicker.module.css';

const OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'any', label: 'Tous' },
  { value: 'weekday', label: 'Lun–Ven' },
  { value: 'saturday', label: 'Sam' },
  { value: 'sunday', label: 'Dim' },
];

interface Props {
  value: DayFilter;
  onChange: (value: DayFilter) => void;
}

export default function DayPicker({ value, onChange }: Props) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Jour</span>
      <div className={styles.options} role="radiogroup" aria-label="Jour de service">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`${styles.option} ${value === o.value ? styles.selected : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
