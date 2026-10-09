import { OverlayToggle, OverlayToggleGroup } from './OverlayToggle';
import SectionVisibilityToggle from './SectionVisibilityToggle';
import TrainIcon from './icons/TrainIcon';
import styles from './Section.module.css';
import busStyles from './PublicBusesSection.module.css';

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
  return (
    <section className={styles.section}>
      <div className={busStyles.header}>
        <span className={busStyles.headerLabel}>Trains</span>
        <SectionVisibilityToggle
          visible={sectionVisible}
          onChange={onSectionVisibleChange}
          label="Trains"
        />
      </div>
      <div className={styles.row}>
        <OverlayToggleGroup>
          <OverlayToggle
            icon={<TrainIcon />}
            label="Réseau ferroviaire"
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
            {stationsVisible ? 'Masquer les gares' : 'Afficher les gares'}
          </button>
        )}
      </div>
    </section>
  );
}
