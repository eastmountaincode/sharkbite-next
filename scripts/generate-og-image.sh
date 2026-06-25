#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGO="$ROOT/public/assets/sharkbite/logo.png"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

BACKGROUND="#ebe8de"
LINE="#242424"
SIZE="1200x630"
LOGO_SIZE="$(magick identify -format '%wx%h' "$LOGO")"

magick -size "$LOGO_SIZE" xc:"$LINE" \
  \( "$LOGO" -alpha extract -level 2%,45% \) \
  -alpha off -compose copy_opacity -composite "$TMP_DIR/logo-line.png"

magick -size "$SIZE" xc:"$BACKGROUND" \
  \( "$TMP_DIR/logo-line.png" -trim +repage -resize 960x540 \) \
  -gravity center -composite -strip -depth 8 "$ROOT/src/app/opengraph-image.png"

cp "$ROOT/src/app/opengraph-image.png" "$ROOT/src/app/twitter-image.png"
