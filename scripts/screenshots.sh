#!/bin/bash
# Renders the 1280×800 Chrome Web Store screenshots (light and dark) from
# store-assets/screenshot.html with headless Chrome. The panel needs a dev
# build (for the ?seed sample data) served on :4173:
#   npx vite build --mode development && npx vite preview --port 4173
# then: bash scripts/screenshots.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Blink's preferredColorScheme: 0 = dark, 1 = light. Reduced motion skips the
# entrance fades, which headless capture can otherwise freeze part-way.
for mode in light dark; do
  scheme=1; [ "$mode" = dark ] && scheme=0
  profile=$(mktemp -d)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$profile" \
    --window-size=1280,800 --virtual-time-budget=6000 --force-prefers-reduced-motion \
    --blink-settings=preferredColorScheme=$scheme \
    --screenshot="store-assets/screenshot-1-$mode.png" "file://$PWD/store-assets/screenshot.html" 2>/dev/null
  rm -rf "$profile"
  echo "store-assets/screenshot-1-$mode.png"
done
