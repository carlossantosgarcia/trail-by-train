import maplibregl from 'maplibre-gl';
import { setGrHighlightRef, GR_HIT_LAYER_ID } from '../../features/gr-trails';
import { claimMapTap } from '../../lib/mapGestures';

/** Cursor, click popup and highlight for GR trails. Returns the detach function. */
export function attachGrInteractions(map: maplibregl.Map): () => void {
  // GR hover: cursor affordance only. We deliberately do NOT update
  // the highlight on mousemove — setFilter on a PMTiles vector source
  // forces every loaded tile to re-evaluate matching features, which
  // is expensive at low zoom and previously produced multi-second
  // lag. The yellow highlight is now driven by click only.
  const onGrEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onGrLeave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('mouseenter', GR_HIT_LAYER_ID, onGrEnter);
  map.on('mouseleave', GR_HIT_LAYER_ID, onGrLeave);

  // GR click: popup with ref, name, baked total_km, link; also sets
  // the yellow highlight to every segment sharing the clicked ref.
  let grPopup: maplibregl.Popup | null = null;
  const onGrClick = (
    e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
  ) => {
    const feat = e.features?.[0];
    const props = feat?.properties as
      | { ref?: string; name?: string | null; total_km?: number; link?: string }
      | undefined;
    if (!props?.ref) return;
    claimMapTap();
    const totalKm =
      typeof props.total_km === 'number' ? props.total_km : Number(props.total_km ?? 0);
    const link = typeof props.link === 'string' ? props.link : null;
    const name = typeof props.name === 'string' ? props.name : '';
    const container = document.createElement('div');
    container.className = 'gr-popup';
    const refSpan = document.createElement('div');
    refSpan.className = 'gr-popup-ref';
    refSpan.textContent = props.ref;
    container.appendChild(refSpan);
    if (name) {
      const nameDiv = document.createElement('div');
      nameDiv.className = 'gr-popup-name';
      nameDiv.textContent = name;
      container.appendChild(nameDiv);
    }
    if (Number.isFinite(totalKm) && totalKm > 0) {
      const km = document.createElement('div');
      km.className = 'gr-popup-km';
      km.textContent = `${Math.round(totalKm)} km`;
      container.appendChild(km);
    }
    if (link) {
      const a = document.createElement('a');
      a.className = 'gr-popup-link';
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'More info →';
      container.appendChild(a);
    }
    // GR® is a registered trademark of the FFRandonnée, which also maintains
    // the official routes. The OSM line can lag behind a re-routing, so the
    // popup says where the data comes from and points to the authority.
    const official = document.createElement('a');
    official.className = 'gr-popup-link';
    official.href = 'https://www.mongr.fr/';
    official.target = '_blank';
    official.rel = 'noopener noreferrer';
    official.textContent = 'Official route on MonGR.fr (FFRandonnée) →';
    container.appendChild(official);
    const note = document.createElement('p');
    note.className = 'gr-popup-note';
    note.textContent =
      'Route from OpenStreetMap — may differ from the official waymarking. ' +
      'GR® is a registered trademark of the FFRandonnée.';
    container.appendChild(note);
    if (grPopup) grPopup.remove();
    grPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '260px',
    })
      .setLngLat([e.lngLat.lng, e.lngLat.lat])
      .setDOMContent(container)
      .addTo(map);
    // Highlight every segment sharing this ref; clear when the
    // popup closes (close button, map click outside, or Esc).
    setGrHighlightRef(map, props.ref);
    grPopup.on('close', () => {
      setGrHighlightRef(map, null);
    });
  };
  map.on('click', GR_HIT_LAYER_ID, onGrClick);

  return () => {
    map.off('mouseenter', GR_HIT_LAYER_ID, onGrEnter);
    map.off('mouseleave', GR_HIT_LAYER_ID, onGrLeave);
    map.off('click', GR_HIT_LAYER_ID, onGrClick);
    if (grPopup) {
      try {
        grPopup.remove();
      } catch {
        /* ignore */
      }
      grPopup = null;
    }
  };
}
