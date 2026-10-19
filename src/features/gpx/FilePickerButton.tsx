import { useRef } from 'react';
import { useGpxStore } from './store';
import FileIcon from '../../components/icons/FileIcon';
import styles from './FilePickerButton.module.css';
import { useT } from '../../i18n';
import { addPickedFiles } from './pickFiles';

export default function FilePickerButton({ className }: { className?: string }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const parsing = useGpxStore((s) => s.parsing);

  const onClick = () => {
    inputRef.current?.click();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file later
    addPickedFiles(files);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={parsing > 0}
        aria-label={t('gpx.open')}
      >
        {parsing > 0 ? (
          <span className={styles.spinner} aria-hidden />
        ) : (
          <span className={styles.icon} aria-hidden>
            <FileIcon />
          </span>
        )}
        <span>{parsing > 0 ? t('gpx.loading') : t('gpx.openShort')}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        multiple
        onChange={onChange}
        className={styles.hidden}
      />
    </>
  );
}
