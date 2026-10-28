#!/bin/zsh
# Show mode: build, serve dist/, and open Chrome in kiosk mode.
#
# WIZARD_DISPLAY_X  x coordinate of a point on the projector's display, from
#                   System Settings > Displays arrangement (e.g. 1920 when the
#                   projector sits to the right of a 1920-wide main screen).
#                   Kiosk mode fills the display that contains this point.
# Quit with Cmd+Q. The server stops with Chrome.
set -euo pipefail
cd "${0:A:h}/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8787

if lsof -ti "tcp:$PORT" >/dev/null; then
  echo "Port $PORT is busy. Stop the dev server (npm run dev) first." >&2
  exit 1
fi

npm run build

npx tsx server/server.ts --prod &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
until curl -sf "localhost:$PORT/api/info" >/dev/null; do sleep 0.3; done

# A separate profile keeps the show isolated from your everyday Chrome windows.
# --autoplay-policy lets audio start without a click.
# --use-fake-ui-for-media-stream auto-grants the mic prompt (this profile only).
# Kiosk mode also stops the clicker's Esc button from leaving fullscreen.
"$CHROME" \
  --user-data-dir="$PWD/.chrome-show-profile" \
  --kiosk \
  --window-position="${WIZARD_DISPLAY_X:-0},0" \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --no-first-run --no-default-browser-check \
  "http://localhost:$PORT/?autostart"
