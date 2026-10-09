import EyeIcon from './icons/EyeIcon';
import styles from './SectionVisibilityToggle.module.css';

interface Props {
  visible: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export default function SectionVisibilityToggle({ visible, onChange, label }: Props) {
  const next = !visible;
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={!visible}
      aria-label={visible ? `Masquer : ${label}` : `Afficher : ${label}`}
      title={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
      onClick={() => onChange(next)}
    >
      <EyeIcon hidden={!visible} />
    </button>
  );
}
