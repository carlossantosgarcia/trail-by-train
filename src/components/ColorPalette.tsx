import styles from './ColorPalette.module.css';

// Three high-contrast swatches that read well on both IGN topo and
// satellite — picked to be maximally distinct from each other (warm,
// cool, neutral-bright). Users wanting anything else use the native
// picker for full RGB choice.
export const COLOR_PALETTE: readonly string[] = [
  '#facc15', // yellow — warm, reads on satellite forest greens
  '#7c3aed', // purple — cool, reads on topo browns/greens
  '#ec4899', // pink — bright neutral, reads on snow and rock
] as const;

interface Props {
  label: string;
  currentValue: string;
  defaultValue: string;
  onChange: (value: string | null) => void;
}

export default function ColorPalette({ label, currentValue, defaultValue, onChange }: Props) {
  const lower = currentValue.toLowerCase();
  const isOverridden = lower !== defaultValue.toLowerCase();
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.swatches} role="radiogroup" aria-label={label}>
        {COLOR_PALETTE.map((hex) => {
          const selected = hex.toLowerCase() === lower;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={hex}
              title={hex}
              className={`${styles.swatch} ${selected ? styles.selected : ''}`}
              style={{ background: hex }}
              onClick={() =>
                onChange(hex.toLowerCase() === defaultValue.toLowerCase() ? null : hex)
              }
            />
          );
        })}
        <label
          className={`${styles.customSwatch} ${
            !COLOR_PALETTE.some((h) => h.toLowerCase() === lower) && isOverridden
              ? styles.selected
              : ''
          }`}
          title="Choisir une couleur"
          style={{ background: currentValue }}
        >
          <span className={styles.customPlus} aria-hidden>
            +
          </span>
          <input
            type="color"
            value={currentValue}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v.toLowerCase() === defaultValue.toLowerCase() ? null : v);
            }}
            aria-label={`${label} — couleur personnalisée`}
          />
        </label>
        <button
          type="button"
          className={styles.reset}
          onClick={() => onChange(null)}
          disabled={!isOverridden}
          title="Réinitialiser"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
