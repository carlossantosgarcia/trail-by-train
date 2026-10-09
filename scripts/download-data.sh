#!/usr/bin/env bash
# Download the prebuilt datasets (rail, transit, GR, place index) from the
# `data-latest` GitHub Release into public/, so the app runs locally without
# rebuilding anything. The weekly data workflow (.github/workflows/data.yml)
# keeps that release current.
#
# Usage: npm run data:download
# Env:   DATA_REPO=owner/repo   download from a fork instead

set -euo pipefail

REPO="${DATA_REPO:-carlossantosgarcia/train-to-trail}"
BASE="https://github.com/$REPO/releases/download/data-latest"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"

for archive in base transit; do
  echo "==> $archive.tar.gz from $REPO"
  curl -fSL --retry 3 "$BASE/$archive.tar.gz" | tar -xz -C "$PUBLIC_DIR"
done

echo "Done. Start the app with: npm run dev"
