import { useEffect, useState } from 'react';
import { addTracksFromFiles } from './store';
import { pushToast } from './toast';
import styles from './GpxDropZone.module.css';

function isGpxFile(file: File): boolean {
  return /\.gpx$/i.test(file.name);
}

function eventHasFiles(e: DragEvent): boolean {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
}

export default function GpxDropZone() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let dragDepth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      dragDepth++;
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!eventHasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      const gpxFiles = files.filter(isGpxFile);
      const skipped = files.length - gpxFiles.length;
      if (skipped > 0) {
        pushToast({
          kind: 'error',
          text: `Ignored ${skipped} non-GPX file${skipped === 1 ? '' : 's'}.`,
        });
      }
      void addTracksFromFiles(gpxFiles);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <div className={`${styles.zone} ${active ? styles.active : ''}`} aria-hidden={!active}>
      <div className={styles.overlay}>
        <div className={styles.hint}>Drop GPX files to add tracks</div>
      </div>
    </div>
  );
}
