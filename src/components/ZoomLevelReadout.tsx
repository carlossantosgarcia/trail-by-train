// Live zoom-level readout — a single big, semi-transparent number in
// the bottom-left of the map viewport. Subscribes to the MapLibre
// 'zoom' event so it updates every wheel notch / pinch step without
// polling.

import { useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import styles from './ZoomLevelReadout.module.css';

interface Props {
  map: maplibregl.Map | null;
}

export default function ZoomLevelReadout({ map }: Props) {
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on('zoom', update);
    return () => {
      map.off('zoom', update);
    };
  }, [map]);

  if (zoom === null) return null;
  return (
    <div className={styles.readout} aria-hidden>
      {zoom.toFixed(1)}
    </div>
  );
}
