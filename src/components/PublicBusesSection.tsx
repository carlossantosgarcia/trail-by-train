import BusProviderPicker from './BusProviderPicker';
import BusProviderPill from './BusProviderPill';
import DayPicker from './DayPicker';
import HideLowFreqToggle from './HideLowFreqToggle';
import ShowArchivedToggle from './ShowArchivedToggle';
import SectionVisibilityToggle from './SectionVisibilityToggle';
import TransitValidityBanner from '../transit/TransitValidityBanner';
import { TRANSIT_PROVIDERS, type DayFilter } from '../transit';
import styles from './Section.module.css';
import busStyles from './PublicBusesSection.module.css';

interface Props {
  sectionVisible: boolean;
  onSectionVisibleChange: (value: boolean) => void;
  transitVisible: Record<string, boolean>;
  onTransitVisibleChange: (providerId: string, value: boolean) => void;
  onTransitVisibleChangeAll: (value: boolean) => void;
  providerColors: Record<string, string | null>;
  onProviderColorChange: (providerId: string, value: string | null) => void;
  dayFilter: DayFilter;
  onDayFilterChange: (value: DayFilter) => void;
  hideLowFreq: boolean;
  onHideLowFreqChange: (value: boolean) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
}

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
  hideLowFreq,
  onHideLowFreqChange,
  showArchived,
  onShowArchivedChange,
}: Props) {
  const selectedProviders = TRANSIT_PROVIDERS.filter((p) => transitVisible[p.id]);
  const selectedIds = new Set(selectedProviders.map((p) => p.id));
  const anyEnabled = selectedProviders.length > 0;
  const allSelected = selectedProviders.length === TRANSIT_PROVIDERS.length;

  return (
    <section className={styles.section}>
      <div className={busStyles.header}>
        <span className={busStyles.headerLabel}>Bus ({TRANSIT_PROVIDERS.length})</span>
        <button
          type="button"
          className={busStyles.selectAll}
          onClick={() => onTransitVisibleChangeAll(!allSelected)}
        >
          {allSelected ? 'Tout retirer' : 'Tout afficher'}
        </button>
        <SectionVisibilityToggle
          visible={sectionVisible}
          onChange={onSectionVisibleChange}
          label="Bus"
        />
      </div>
      {selectedProviders.length > 0 && (
        <div className={busStyles.pillRow}>
          {selectedProviders.map((p) => (
            <BusProviderPill
              key={p.id}
              provider={p}
              currentColor={providerColors[p.id] ?? p.lineColor}
              onRemove={() => onTransitVisibleChange(p.id, false)}
              onColorChange={(v) => onProviderColorChange(p.id, v)}
            />
          ))}
        </div>
      )}
      <div className={busStyles.pickerRow}>
        <BusProviderPicker
          providers={TRANSIT_PROVIDERS}
          selectedIds={selectedIds}
          providerColors={providerColors}
          onSelect={(id) => onTransitVisibleChange(id, true)}
        />
      </div>
      {anyEnabled && (
        <>
          <div className={styles.row}>
            <DayPicker value={dayFilter} onChange={onDayFilterChange} />
          </div>
          <HideLowFreqToggle value={hideLowFreq} onChange={onHideLowFreqChange} />
          <ShowArchivedToggle value={showArchived} onChange={onShowArchivedChange} />
          <TransitValidityBanner enabledProviderIds={selectedProviders.map((p) => p.id)} />
        </>
      )}
    </section>
  );
}
