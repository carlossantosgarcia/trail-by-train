// The live map, for code outside the map component that needs its view (the
// report form sends where the user was looking).

import type maplibregl from 'maplibre-gl';

let map: maplibregl.Map | null = null;

export function setCurrentMap(m: maplibregl.Map | null): void {
  map = m;
}

export function currentMapView(): { lat: number; lon: number; zoom: number } | null {
  if (!map) return null;
  const c = map.getCenter();
  return { lat: c.lat, lon: c.lng, zoom: map.getZoom() };
}
