import { t } from '../../i18n';
import { addTracksFromFiles } from './store';
import { pushToast } from './toast';

/** Load the GPX files among those picked, saying how many others were skipped. */
export function addPickedFiles(files: File[]): void {
  const gpx = files.filter((f) => /\.gpx$/i.test(f.name));
  const skipped = files.length - gpx.length;
  if (skipped > 0) pushToast({ kind: 'error', text: t('gpx.ignored', { n: skipped }) });
  void addTracksFromFiles(gpx);
}
