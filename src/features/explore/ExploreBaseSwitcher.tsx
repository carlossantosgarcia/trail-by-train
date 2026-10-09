import type { BaseLayer } from '../../layers/ignBaseLayers';
import styles from './ExploreBaseSwitcher.module.css';

interface Props {
  layers: readonly BaseLayer[];
  activeLayerId: string;
  onChange: (id: string) => void;
}

/** Compact icon-only basemap switcher for Explore mode — smaller than the
 * app's labelled BaseLayerSwitcher, so it stays out of the way. */
export default function ExploreBaseSwitcher({ layers, activeLayerId, onChange }: Props) {
  return (
    <div className={styles.switcher} role="radiogroup" aria-label="Fond de carte">
      {layers.map((layer) => {
        const active = layer.id === activeLayerId;
        return (
          <button
            key={layer.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.opt} ${active ? styles.active : ''}`}
            title={layer.label}
            aria-label={layer.label}
            onClick={() => onChange(layer.id)}
          >
            <img
              src={`${import.meta.env.BASE_URL}${layer.thumbnail}`}
              alt=""
              width={34}
              height={34}
              loading="lazy"
              decoding="async"
              className={styles.thumb}
            />
          </button>
        );
      })}
    </div>
  );
}
