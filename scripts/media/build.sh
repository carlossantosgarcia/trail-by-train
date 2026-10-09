#!/usr/bin/env bash
# Regenerate the README media in docs/media. See scripts/media/README.md.
# Usage: scripts/media/build.sh [explore gpx bus hike satellite phone]  (default: all)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
CACHE="$HERE/.cache"
WORK="$CACHE/work"
MEDIA="$REPO/docs/media"
PORT=${PORT:-4321}
SCENES=("$@")
[ ${#SCENES[@]} -eq 0 ] && SCENES=(explore gpx bus hike satellite phone)

command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
[[ $(ffmpeg -hide_banner -encoders 2>/dev/null) == *libwebp_anim* ]] \
  || { echo "ffmpeg needs libwebp (libwebp_anim encoder)" >&2; exit 1; }
mkdir -p "$WORK"

# Linux resolves the app's system-ui font stack to whatever is installed,
# often DejaVu Sans. Capture with Inter instead, close to what macOS and
# Windows users see. On macOS the system font is already right.
if [ "$(uname)" = Linux ]; then
  if [ ! -f "$CACHE/fonts/Inter-Regular.ttf" ]; then
    echo "Fetching Inter…"
    curl -sfL -o "$CACHE/inter.zip" https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
    mkdir -p "$CACHE/fonts" && unzip -q -o -j "$CACHE/inter.zip" 'extras/ttf/Inter-Regular.ttf' 'extras/ttf/Inter-Medium.ttf' \
      'extras/ttf/Inter-SemiBold.ttf' 'extras/ttf/Inter-Bold.ttf' 'extras/ttf/Inter-Italic.ttf' -d "$CACHE/fonts"
  fi
  cat > "$CACHE/fonts.conf" <<CONF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>$CACHE/fonts</dir>
  <cachedir>$CACHE/fccache</cachedir>
  <alias binding="strong"><family>sans-serif</family><prefer><family>Inter</family></prefer></alias>
  <alias binding="strong"><family>system-ui</family><prefer><family>Inter</family></prefer></alias>
</fontconfig>
CONF
  export FONTCONFIG_FILE="$CACHE/fonts.conf"
fi

echo "Building the app…"
(cd "$REPO" && npm run build >/dev/null)
(cd "$REPO" && exec npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/dev/null 2>&1) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$PORT/" >/dev/null && break; sleep 0.5; done
export APP_URL="http://127.0.0.1:$PORT/"

# Frames: the browser window at 1x (animations) and 2x (stills), and the phone.
node "$HERE/frame.mjs" "$WORK/window.png" 1280 760 > "$WORK/window.json"
DPR=2 node "$HERE/frame.mjs" "$WORK/window2x.png" 1280 760 > "$WORK/window2x.json"
DPR=2 node "$HERE/phoneframe.mjs" "$WORK/phone2x.png" 393 708 > "$WORK/phone2x.json"

# Put a 2x still into its frame and write a WebP.
still() { # <app.png> <frame.png> <frame.json> <out.webp> <width>
  read -r FW FH FX FY < <(node -e "const d=require(process.argv[1]);console.log(d.W*2,d.H*2,d.x*2,d.y*2)" "$3")
  ffmpeg -v error -y -f lavfi -i "color=c=white:s=${FW}x${FH}" -i "$1" -i "$2" \
    -filter_complex "[0][1]overlay=$FX:$FY[a];[a][2]overlay=0:0,scale=$5:-2:flags=lanczos" \
    -frames:v 1 -c:v libwebp -quality 88 "$4"
}

for s in "${SCENES[@]}"; do
  echo "Capturing $s…"
  case $s in
    explore | gpx)
      OUT="$WORK/$s" node "$HERE/$s.mjs"
      hold=$([ "$s" = explore ] && echo 1.0 || echo 0.4)
      "$HERE/encode.sh" "$WORK/$s/frames" "$WORK/window.png" "$WORK/window.json" "$hold" "$MEDIA/$s.webp"
      ;;
    bus | hike | satellite)
      OUT="$WORK" node "$HERE/stills.mjs" "$s"
      still "$WORK/$s.png" "$WORK/window2x.png" "$WORK/window2x.json" "$MEDIA/$s.webp" 1600
      ;;
    phone)
      OUT="$WORK" node "$HERE/stills.mjs" phone
      still "$WORK/phone.png" "$WORK/phone2x.png" "$WORK/phone2x.json" "$MEDIA/phone.webp" 640
      ;;
    *) echo "unknown scene: $s" >&2; exit 1 ;;
  esac
  echo "  → docs/media/$s.webp ($(du -h "$MEDIA/$s.webp" | cut -f1))"
done
