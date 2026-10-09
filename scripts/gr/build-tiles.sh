#!/usr/bin/env bash
# Pack the normalized GR GeoJSON (produced by fetch-overpass.mjs) into
# public/data/gr-routes.pmtiles using Tippecanoe.

set -euo pipefail

if ! command -v tippecanoe >/dev/null 2>&1; then
  echo "error: 'tippecanoe' not found on PATH" >&2
  echo "  install: apt install tippecanoe   |   brew install tippecanoe" >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

SRC="$SCRIPT_DIR/.cache/gr-routes.normalized.geojson"
OUT_DIR="$REPO_ROOT/public/data"
OUT="$OUT_DIR/gr-routes.pmtiles"

if [ ! -f "$SRC" ]; then
  echo "error: $SRC not found — run 'npm run gr:fetch' first" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT"

echo "[tippecanoe] building $OUT…"
tippecanoe \
  --output="$OUT" \
  --layer=gr \
  --minimum-zoom=4 \
  --maximum-zoom=13 \
  --simplification=10 \
  --no-tile-size-limit \
  --force \
  "$SRC"

SIZE_BYTES=$(stat -c%s "$OUT" 2>/dev/null || stat -f%z "$OUT")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.2f", b/1024/1024 }')
echo "[done] $OUT (${SIZE_MB} MB)"
