#!/usr/bin/env bash
# Put recorded frames into the browser window and encode an animated WebP.
# Usage: encode.sh <frames_dir> <window.png> <window.json> <hold_sec> <out.webp> [width]
set -euo pipefail
F=$1; FRAME=$2; JSON=$3; HOLD=$4; OUT=$5; WID=${6:-1200}
read -r FW FH FX FY < <(node -e "const d=require(process.argv[1]);console.log(d.W,d.H,d.x,d.y)" "$(realpath "$JSON")")
# Hold the last frame so the loop has a beat before it restarts.
ffmpeg -v error -y -f lavfi -i "color=c=white:s=${FW}x${FH}:r=30" -framerate 30 -i "$F/%05d.png" -i "$FRAME" \
  -filter_complex "[1]tpad=stop_mode=clone:stop_duration=$HOLD[v];[0][v]overlay=$FX:$FY:shortest=1[a];[a][2]overlay=0:0,scale=$WID:-2:flags=lanczos" \
  -c:v libwebp_anim -lossless 0 -quality 82 -compression_level 6 -loop 0 "$OUT"
