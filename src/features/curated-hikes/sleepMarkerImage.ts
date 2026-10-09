// Build a 2×-DPI ImageData bitmap of the "sleep" marker icon, suitable
// for `map.addImage` with `{ pixelRatio: 2 }`. We avoid an async
// Image()/decode round-trip by drawing the glyph directly onto a 2D
// canvas. The result is a 36×36 ImageData (renders as 18×18 CSS px on
// 2× displays) — a small moon with a white "Z" and a soft halo so it
// stays visible on satellite basemaps.

const SIZE_PX = 36; // 18 CSS px × 2 DPR
const BG = '#1f2937'; // slate-800
const FG = '#ffffff';
const HALO = 'rgba(255, 255, 255, 0.9)';

export function sleepMarkerImage(): ImageData {
  if (typeof document === 'undefined') {
    throw new Error('sleepMarkerImage: requires a browser document');
  }
  const canvas = document.createElement('canvas');
  canvas.width = SIZE_PX;
  canvas.height = SIZE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sleepMarkerImage: 2d context unavailable');

  // White halo behind the round badge.
  ctx.beginPath();
  ctx.arc(SIZE_PX / 2, SIZE_PX / 2, SIZE_PX / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = HALO;
  ctx.fill();

  // Dark filled circle (the "moon body").
  ctx.beginPath();
  ctx.arc(SIZE_PX / 2, SIZE_PX / 2, SIZE_PX / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();

  // Crescent: a smaller circle in the halo colour, offset slightly to
  // carve a crescent out of the moon. Subtle, so the "Z" stays the
  // dominant glyph at small zoom.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(SIZE_PX / 2 + 4, SIZE_PX / 2 - 4, SIZE_PX / 2 - 6, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  // Re-fill the punched-out area with the halo color so it reads as a
  // solid badge with a crescent highlight instead of a transparent hole.
  // (Cheaper than a path-based crescent and renders the same.)
  // Note: the destination-out above already creates the cut; we leave it
  // transparent — the white halo behind shows through, producing the
  // crescent silhouette.

  // "Z" glyph centred.
  ctx.fillStyle = FG;
  ctx.font = `bold ${Math.round(SIZE_PX * 0.55)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Z', SIZE_PX / 2 - 2, SIZE_PX / 2 + 1);

  return ctx.getImageData(0, 0, SIZE_PX, SIZE_PX);
}
