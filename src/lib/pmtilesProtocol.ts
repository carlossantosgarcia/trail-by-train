import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

// Module-level guard so React strict-mode double renders and HMR reloads do
// not re-register the protocol (MapLibre throws if the same protocol name is
// registered twice).
let registered = false;

export function ensurePmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}
