import { OverlayToggle, OverlayToggleGroup } from './OverlayToggle';
import SectionVisibilityToggle from './SectionVisibilityToggle';
import TrainIcon from './icons/TrainIcon';
import styles from './Section.module.css';
import busStyles from './PublicBusesSection.module.css';
import { useT } from '../i18n';

interface Props {
  sectionVisible: boolean;
  onSectionVisibleChange: (value: boolean) => void;
  railVisible: boolean;
  onRailVisibleChange: (value: boolean) => void;
  stationsVisible: boolean;
  onStationsVisibleChange: (value: boolean) => void;
}

export default function TrainsSection({
  sectionVisible,
  onSectionVisibleChange,
  railVisible,
  onRailVisibleChange,
  stationsVisible,
  onStationsVisibleChange,
}: Props) {
  const t = useT();
  return (
    <section className={styles.section}>
      <div className={busStyles.header}>
        <span className={busStyles.headerLabel}>{t('layers.trains')}</span>
        <SectionVisibilityToggle
          visible={sectionVisible}
          onChange={onSectionVisibleChange}
          label={t('layers.trains')}
        />
      </div>
      <div className={styles.row}>
        <OverlayToggleGroup>
          <OverlayToggle
            icon={<TrainIcon />}
            label={t('rail.network')}
            value={railVisible}
            onChange={onRailVisibleChange}
          />
        </OverlayToggleGroup>
        {railVisible && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => onStationsVisibleChange(!stationsVisible)}
          >
            {t(stationsVisible ? 'rail.hideStations' : 'rail.showStations')}
          </button>
        )}
      </div>
    </section>
  );
}
