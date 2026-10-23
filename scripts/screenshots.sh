#!/bin/bash
# Regenerates the Chrome Web Store images in store-assets/: five 1280×800
# screenshots, the 440×280 promo tile and the 1400×560 marquee.
# 1. scenes.mjs drives the real side panel into each state and captures it.
# 2. render.mjs composes the captures into the final images.
# Needs a build served on :4173 (any mode):
#   npm run build && npx vite preview --port 4173
# then: bash scripts/screenshots.sh
set -euo pipefail
cd "$(dirname "$0")/.."
node store-assets/scenes.mjs
node store-assets/render.mjs
