#!/usr/bin/env bash
# Build public/rail-stations.geojson from SNCF Open Data's "Liste des
# gares" dataset, filtered to passenger stations (voyageurs=O).
#
# Output:
#   public/rail-stations.geojson
#
# Requires: curl, jq.
# Run by the data workflow (.github/workflows/data.yml) or locally.
# Never invoked at runtime.

set -euo pipefail

for tool in curl jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "error: '$tool' not found on PATH" >&2
    case "$tool" in
      curl) echo "  install: apt install curl   |   brew install curl" >&2 ;;
      jq)   echo "  install: apt install jq     |   brew install jq"   >&2 ;;
    esac
    exit 1
  fi
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="$(mktemp -d -t rail-stations-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

OUT_DIR="$REPO_ROOT/public"
OUT_FILE="$OUT_DIR/rail-stations.geojson"
RAW="$WORK_DIR/stations-raw.geojson"
mkdir -p "$OUT_DIR"

echo "[1/2] curl: fetching SNCF Liste des gares (voyageurs=O)…"
HTTP_STATUS=$(curl -sSL -G \
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/liste-des-gares/exports/geojson" \
  --data-urlencode 'where=voyageurs="O"' \
  -o "$RAW" \
  -w '%{http_code}')
if [ "$HTTP_STATUS" != "200" ]; then
  echo "error: SNCF export returned HTTP $HTTP_STATUS" >&2
  exit 1
fi
RAW_COUNT=$(jq '.features | length' "$RAW")
echo "       got $RAW_COUNT raw passenger-station entries"

echo "[2/2] jq: dropping nulls, dedup by code_uic, slimming properties…"
# - Drop features with no geometry / no coordinates (some IDF entries are null).
# - Dedup multiple tronçon-level rows for the same physical station via
#   `unique_by(.properties.code_uic)` (jq keeps the first occurrence).
# - Keep only {name, commune, code_uic} as runtime properties.
jq '
  .features
  | map(select(.geometry != null and .geometry.coordinates != null))
  | (length) as $with_geom
  | unique_by(.properties.code_uic)
  | (length) as $deduped
  | map({
      type: "Feature",
      geometry: .geometry,
      properties: {
        name:     .properties.libelle,
        commune:  .properties.commune,
        code_uic: .properties.code_uic
      }
    })
  | {
      type: "FeatureCollection",
      _hike_planner: {
        source: "SNCF Open Data — liste-des-gares (voyageurs=O)",
        with_geometry: $with_geom,
        deduped_count: $deduped
      },
      features: .
    }
' "$RAW" > "$OUT_FILE"

KEPT=$(jq '.features | length' "$OUT_FILE")
DROPPED_NO_GEOM=$(jq '._hike_planner.with_geometry' "$OUT_FILE")
DROPPED_NO_GEOM=$((RAW_COUNT - DROPPED_NO_GEOM))
SIZE_BYTES=$(stat -c%s "$OUT_FILE" 2>/dev/null || stat -f%z "$OUT_FILE")
SIZE_MB=$(awk -v b="$SIZE_BYTES" 'BEGIN { printf "%.2f", b/1024/1024 }')

if [ "$DROPPED_NO_GEOM" -gt 0 ]; then
  echo "       dropped $DROPPED_NO_GEOM record(s) with no coordinates" >&2
fi
echo ""
echo "done. $OUT_FILE  ($KEPT stations, ${SIZE_MB} MB)"
echo "      commit it: git add public/rail-stations.geojson && git commit"
