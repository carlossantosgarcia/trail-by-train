import { useRef } from 'react';
import { addTracksFromFiles, useGpxStore } from './store';
import { pushToast } from './toast';
import FileIcon from '../../components/icons/FileIcon';
import styles from './FilePickerButton.module.css';

export default function FilePickerButton({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const parsing = useGpxStore((s) => s.parsing);

  const onClick = () => {
    inputRef.current?.click();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file later
    const gpx = files.filter((f) => /\.gpx$/i.test(f.name));
    const skipped = files.length - gpx.length;
    if (skipped > 0) {
      pushToast({
        kind: 'error',
        text: `Ignored ${skipped} non-GPX file${skipped === 1 ? '' : 's'}.`,
      });
    }
    void addTracksFromFiles(gpx);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={parsing > 0}
        aria-label="Open GPX file"
      >
        {parsing > 0 ? (
          <span className={styles.spinner} aria-hidden />
        ) : (
          <span className={styles.icon} aria-hidden>
            <FileIcon />
          </span>
        )}
        <span>{parsing > 0 ? 'Loading…' : 'Open .gpx'}</span>
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
