#!/bin/sh
# Renders the site's pictures. macOS only (swift, WebKit); the results are
# committed, so the site build does not need this.
#
#   public/og.png     1200 × 630, from scripts/og.html, which shows the icon
#                     from public/logo.svg. The icon files themselves
#                     (logo.svg, favicon.svg, favicon.ico,
#                     apple-touch-icon.png) are the designer's icon and
#                     renderings of it; see README.md.
#   public/tour.webp  the tour's window as it starts (2560 × 1600), shown
#                     until the live demo runs and without JavaScript. Taken
#                     from the site itself, so it needs `pnpm dev` or
#                     `pnpm preview` running (SITE, default
#                     http://localhost:4321) and cwebp (brew install webp);
#                     skipped otherwise. Run it again when the app's sidebar
#                     or the demo's sample tabs change.
#   public/cards/     the pictures on the feature cards, by
#                     scripts/make-card-pictures.mjs: the same needs.
set -eu
cd "$(dirname "$0")/.."
swift scripts/render.swift scripts/og.html 1200 630 public/og.png
echo "public/og.png"

site="${SITE:-http://localhost:4321}"
if command -v cwebp >/dev/null && curl -fs -o /dev/null "$site/demo/"; then
  png="$(mktemp -t tour).png"
  swift scripts/render.swift "$site/demo/?film" 1280 800 "$png" 2
  cwebp -quiet -q 82 "$png" -o public/tour.webp
  rm -f "$png"
  echo "public/tour.webp"
  node scripts/make-card-pictures.mjs "$site"
else
  echo "skipped public/tour.webp and public/cards/: needs cwebp and the site at $site"
fi
