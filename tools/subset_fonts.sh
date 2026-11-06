#!/usr/bin/env bash
# Subset the OFL fonts to Arabic + basic Latin and compress to WOFF2 (requires fonttools + brotli).
set -euo pipefail
cd "$(dirname "$0")/.."
U="U+0020-007E,U+00A0,U+00AB,U+00BB,U+00D7,U+060C,U+061B,U+061F,U+0621-063A,U+0640-0652,U+0653-0655,U+0660-0669,U+066A-066D,U+0670,U+06D4,U+200C-200F,U+2010-2014,U+2018-201D,U+2022,U+2026,U+2066-2069,U+FD3E,U+FD3F"
for f in ArefRuqaa-700 Amiri-400 Amiri-700; do
  pyftsubset "tools/fonts-src/$f.ttf" --unicodes="$U" --layout-features='*' --flavor=woff2 \
    --output-file="assets/fonts/$f.woff2"
done
ls -la assets/fonts/*.woff2
