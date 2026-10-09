#!/usr/bin/env bash
# Build public/rail.pmtiles from the SNCF Réseau "Lignes par statut" open
# dataset, filtered to currently-operated tronçons (statut=Exploitée).
#
# Why SNCF and not OSM:
#   The infrastructure owner publishes the authoritative network as a
#   ready-made GeoJSON. Filtering to "Exploitée" yields clean line
#   topology with no museum lines, decommissioned spurs, loops at depots,
#   or disconnected fragments — all of which OSM has plenty of.
#
# Output:
#   public/rail.pmtiles
#
# Requires:
#   - curl
#   - jq
#   - tippecanoe
# Run by the data workflow (.github/workflows/data.yml) or locally.
# Never invoked at runtime.

set -euo pipefail

# --- check prerequisites --------------------------------------------------
for tool in curl tippecanoe jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' not found on PATH" >&2
    case "$tool" in
      curl)       echo "  install: apt install curl         |   brew install curl"        >&2 ;;
      tippecanoe) echo "  install: apt install tippecanoe   |   brew install tippecanoe"  >&2 ;;
      jq)         echo "  install: apt install jq           |   brew install jq"          >&2 ;;
    esac
    exit 1
  fi
done

# --- paths ----------------------------------------------------------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="$(mktemp -d -t rail-tiles-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

OUT_DIR="$REPO_ROOT/public"
OUT_PMTILES="$OUT_DIR/rail.pmtiles"
mkdir -p "$OUT_DIR"

# --- 1. fetch SNCF "Exploitée" tronçons as GeoJSON ------------------------
SRC_GEOJSON="$WORK_DIR/sncf-rail-exploitee.geojson"
echo "[1/2] curl: fetching SNCF Lignes par statut (statut=Exploitée)…"
HTTP_STATUS=$(curl -sSL -G \
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/lignes-par-statut/exports/geojson" \
  --data-urlencode 'where=statut="Exploitée"' \
  -o "$SRC_GEOJSON" \
  -w '%{http_code}')
if [ "$HTTP_STATUS" != "200" ]; then
  echo "error: SNCF export returned HTTP $HTTP_STATUS" >&2
  exit 1
fi

FEATURE_COUNT=$(jq '.features | length' "$SRC_GEOJSON")
SRC_BYTES=$(stat -c%s "$SRC_GEOJSON" 2>/dev/null || stat -f%z "$SRC_GEOJSON")
SRC_MB=$(awk -v b="$SRC_BYTES" 'BEGIN { printf "%.2f", b/1024/1024 }')
echo "       got $FEATURE_COUNT features (${SRC_MB} MB raw GeoJSON)"

# --- 2. tippecanoe -> PMTiles --------------------------------------------
echo "[2/2] tippecanoe: building $OUT_PMTILES…"
rm -f "$OUT_PMTILES"
tippecanoe \
  --output="$OUT_PMTILES" \
  --layer=rail \
  --minimum-zoom=4 \
  --maximum-zoom=13 \
  --simplification=6 \
  --drop-densest-as-needed \
  --no-tile-size-limit \
  --force \
  "$SRC_GEOJSON"

# --- report ---------------------------------------------------------------
SIZE_BYTES=$(stat -c%s "$OUT_PMTILES" 2>/dev/null || stat -f%z "$OUT_PMTILES")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.2f", b/1024/1024 }')
echo ""
echo "done. $OUT_PMTILES  (${SIZE_MB} MB)"
echo "      commit it: git add public/rail.pmtiles && git commit"
