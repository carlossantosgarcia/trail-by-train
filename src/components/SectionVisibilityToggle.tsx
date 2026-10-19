import EyeIcon from './icons/EyeIcon';
import styles from './SectionVisibilityToggle.module.css';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export default function SectionVisibilityToggle({ visible, onChange, label }: Props) {
  const t = useT();
  const next = !visible;
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={!visible}
      aria-label={t(visible ? 'section.hide' : 'section.show', { label })}
      title={t(visible ? 'section.hide' : 'section.show', { label })}
      onClick={() => onChange(next)}
    >
      <EyeIcon hidden={!visible} />
    </button>
  );
}
