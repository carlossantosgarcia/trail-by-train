import BusNetworkMenu from './BusNetworkMenu';
import DayPicker from './DayPicker';
import ShowArchivedToggle from './ShowArchivedToggle';
import SectionVisibilityToggle from './SectionVisibilityToggle';
import { OverlayToggle, OverlayToggleGroup } from './OverlayToggle';
import BusIcon from './icons/BusIcon';
import TransitValidityBanner from '../transit/TransitValidityBanner';
import { TRANSIT_PROVIDERS, type DaySelection } from '../transit';
import styles from './Section.module.css';
import busStyles from './PublicBusesSection.module.css';
import { useT } from '../i18n';

interface Props {
  sectionVisible: boolean;
  onSectionVisibleChange: (value: boolean) => void;
  transitVisible: Record<string, boolean>;
  onTransitVisibleChange: (providerId: string, value: boolean) => void;
  onTransitVisibleChangeAll: (value: boolean) => void;
  providerColors: Record<string, string | null>;
  onProviderColorChange: (providerId: string, value: string | null) => void;
  dayFilter: DaySelection;
  onDayFilterChange: (value: DaySelection) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
}

/**
 * Laid out like the Trains section: the eye beside the title, one toggle for
 * the layer, then what refines it. Networks are a detail most people never
 * touch, so they sit behind a one-line summary instead of a pill each.
 */
export default function PublicBusesSection({
  sectionVisible,
  onSectionVisibleChange,
  transitVisible,
  onTransitVisibleChange,
  onTransitVisibleChangeAll,
  providerColors,
  onProviderColorChange,
  dayFilter,
  onDayFilterChange,
  showArchived,
  onShowArchivedChange,
}: Props) {
  const t = useT();
  const selectedProviders = TRANSIT_PROVIDERS.filter((p) => transitVisible[p.id]);
  const anyEnabled = selectedProviders.length > 0;

  return (
    <section className={styles.section}>
      <div className={busStyles.header}>
        <span className={busStyles.headerLabel}>{t('layers.bus')}</span>
        <SectionVisibilityToggle
          visible={sectionVisible}
          onChange={onSectionVisibleChange}
          label={t('layers.bus')}
        />
      </div>
      <div className={styles.row}>
        <OverlayToggleGroup>
          <OverlayToggle
            icon={<BusIcon />}
            label={t('bus.lines')}
            value={anyEnabled}
            onChange={onTransitVisibleChangeAll}
          />
        </OverlayToggleGroup>
        <BusNetworkMenu
          providers={TRANSIT_PROVIDERS}
          visible={transitVisible}
          providerColors={providerColors}
          onVisibleChange={onTransitVisibleChange}
          onVisibleChangeAll={onTransitVisibleChangeAll}
          onColorChange={onProviderColorChange}
        />
      </div>
      {anyEnabled && (
        <>
          <DayPicker value={dayFilter} onChange={onDayFilterChange} />
          <ShowArchivedToggle value={showArchived} onChange={onShowArchivedChange} />
          <TransitValidityBanner enabledProviderIds={selectedProviders.map((p) => p.id)} />
        </>
      )}
    </section>
  );
}
