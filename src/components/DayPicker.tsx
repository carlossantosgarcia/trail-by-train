import { toggleDay, type DaySelection } from '../transit/serviceDays';
import styles from './DayPicker.module.css';

interface Props {
  value: DaySelection;
  onChange: (value: DaySelection) => void;
}

const WEEKEND = [
  { day: 5, short: 'Sam', name: 'samedi' },
  { day: 6, short: 'Dim', name: 'dimanche' },
] as const;

const SUMMARY: Record<string, string> = {
  '10': 'Lignes circulant le samedi',
  '01': 'Lignes circulant le dimanche',
  '11': 'Lignes circulant le samedi et le dimanche',
};

/**
 * Two small toggles, Saturday and Sunday: the days a weekday line is no use
 * for. Both on keeps the lines that run on both (a weekend out and back);
 * both off shows every line.
 */
export default function DayPicker({ value, onChange }: Props) {
  const summary = SUMMARY[value.slice(5)];
  return (
    <div className={styles.picker}>
      <div className={styles.row}>
        <span className={styles.label} id="day-picker-label">
          Week-end
        </span>
        <div className={styles.segments} role="group" aria-labelledby="day-picker-label">
          {WEEKEND.map(({ day, short, name }) => {
            const on = value[day] === '1';
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={name}
                title={name}
                className={`${styles.segment} ${on ? styles.on : ''}`}
                onClick={() => onChange(toggleDay(value, day))}
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>
      <p className={styles.summary} aria-live="polite">
        {summary ?? ''}
      </p>
    </div>
  );
}
