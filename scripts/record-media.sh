#!/usr/bin/env bash
# Record README media from the running Obsidian window (X11, xdotool + ffmpeg).
#
#   scripts/record-media.sh open  <note-name> [vault]        open a note in Obsidian via URI
#   scripts/record-media.sh shot  <name>                      docs/public/media/<name>.png
#   scripts/record-media.sh gif   <name> [seconds] [--type "text to type"]
#                                                             docs/public/media/<name>.gif (+ .mp4 kept)
#   scripts/record-media.sh size  [width] [height]            resize/move the Obsidian window (default 1100x700)
#
# Typical session:
#   scripts/record-media.sh open QA-Rhythm-Sample
#   scripts/record-media.sh size
#   scripts/record-media.sh gif hero 8 --type "The tide came in slowly, and then all at once."
#   scripts/record-media.sh shot desk
#
# Recording is only allowed from the obsidian-dev vault (title check); the real vault is never captured.
# Every recording starts with a 3-second countdown in the terminal; the Obsidian window is
# focused for you, so put the caret where the typing should land before you press Enter.
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/docs/public/media"
GIF_WIDTH=${GIF_WIDTH:-800}
FPS=${FPS:-12}
mkdir -p "$OUT"

need() { command -v "$1" >/dev/null || { echo "missing: $1 (sudo apt install $1)" >&2; exit 1; }; }
need xdotool; need ffmpeg; need xwininfo

win() {
  local w
  w=$(xdotool search --classname obsidian 2>/dev/null | while read -r id; do
        [ "$(xdotool getwindowname "$id" 2>/dev/null)" ] && echo "$id" && break; done)
  [ -n "${w:-}" ] || { echo "Obsidian window not found — is it running?" >&2; exit 1; }
  echo "$w"
}

geometry() {           # sets X Y W H of the Obsidian window (absolute screen coords)
  eval "$(xwininfo -id "$1" | awk '/Absolute upper-left X/{print "X="$NF} /Absolute upper-left Y/{print "Y="$NF} /Width:/{print "WIDTH="$NF} /Height:/{print "HEIGHT="$NF}')"
  W=$(( WIDTH - WIDTH % 2 )); H=$(( HEIGHT - HEIGHT % 2 ))   # x264 needs even sizes
}
DISP=${DISPLAY:-:0}

VAULT=${VAULT:-obsidian-dev}   # the ONLY vault ever recorded — never the real writing vault
guard_vault() {
  local title; title=$(xdotool getwindowname "$1")
  case "$title" in *" - $VAULT - Obsidian"*) ;;
    *) echo "refusing: window title is '$title', not the '$VAULT' vault. Switch to it first." >&2; exit 1 ;;
  esac
}

countdown() {
  guard_vault "$1"
  xdotool windowactivate --sync "$1"
  for i in 3 2 1; do printf '\r  recording in %s… ' "$i"; sleep 1; done; printf '\r                    \r'
}

cmd=${1:-help}; shift || true
case "$cmd" in
  open)
    note=${1:?note name}; vault=${2:-obsidian-dev}
    xdg-open "obsidian://open?vault=${vault}&file=${note// /%20}" ;;

  size)
    w=$(win); xdotool windowsize "$w" "${1:-1100}" "${2:-700}"; xdotool windowmove "$w" 100 100
    xdotool windowactivate "$w"; geometry "$w"; echo "window: ${W}x${H} at ${X},${Y}" ;;

  shot)
    name=${1:?name}; w=$(win); geometry "$w"; countdown "$w"
    ffmpeg -loglevel error -y -f x11grab -video_size "${W}x${H}" -i "${DISP}+${X},${Y}" -frames:v 1 "$OUT/$name.png"
    echo "wrote $OUT/$name.png (${W}x${H})" ;;

  gif)
    name=${1:?name}; secs=${2:-8}; shift 2 || shift $#
    text=""; [ "${1:-}" = "--type" ] && text=${2:-}
    w=$(win); geometry "$w"; countdown "$w"
    if [ -n "$text" ]; then
      ( sleep 1; xdotool type --window "$w" --delay 70 "$text" ) &
    fi
    ffmpeg -loglevel error -y -f x11grab -framerate 30 -video_size "${W}x${H}" -i "${DISP}+${X},${Y}" \
      -t "$secs" -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "$OUT/$name.mp4"
    wait
    filters="fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos"
    ffmpeg -loglevel error -y -i "$OUT/$name.mp4" -vf "${filters},palettegen=stats_mode=diff" "$OUT/.$name-palette.png"
    ffmpeg -loglevel error -y -i "$OUT/$name.mp4" -i "$OUT/.$name-palette.png" \
      -lavfi "${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "$OUT/$name.gif"
    rm -f "$OUT/.$name-palette.png"
    echo "wrote $OUT/$name.gif ($(du -h "$OUT/$name.gif" | cut -f1)) and $name.mp4" ;;

  *) sed -n '2,20p' "$0" ;;
esac
