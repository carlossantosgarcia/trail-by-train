import { toggleDay, type DaySelection } from '../transit/serviceDays';
import styles from './DayPicker.module.css';
import { useT, type MessageKey } from '../i18n';

interface Props {
  value: DaySelection;
  onChange: (value: DaySelection) => void;
}

const WEEKEND = [
  { day: 5, short: 'days.satShort', name: 'days.sat' },
  { day: 6, short: 'days.sunShort', name: 'days.sun' },
] as const;

const SUMMARY: Record<string, MessageKey> = {
  '10': 'days.summarySat',
  '01': 'days.summarySun',
  '11': 'days.summaryBoth',
};

/**
 * Two small toggles, Saturday and Sunday: the days a weekday line is no use
 * for. Both on keeps the lines that run on both (a weekend out and back);
 * both off shows every line.
 */
export default function DayPicker({ value, onChange }: Props) {
  const t = useT();
  const summary = SUMMARY[value.slice(5)];
  return (
    <div className={styles.picker}>
      <div className={styles.row}>
        <span className={styles.label} id="day-picker-label">
          {t('days.weekend')}
        </span>
        <div className={styles.segments} role="group" aria-labelledby="day-picker-label">
          {WEEKEND.map(({ day, short, name }) => {
            const on = value[day] === '1';
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={t(name)}
                title={t(name)}
                className={`${styles.segment} ${on ? styles.on : ''}`}
                onClick={() => onChange(toggleDay(value, day))}
              >
                {t(short)}
              </button>
            );
          })}
        </div>
      </div>
      <p className={styles.summary} aria-live="polite">
        {summary ? t(summary) : ''}
      </p>
    </div>
  );
}
