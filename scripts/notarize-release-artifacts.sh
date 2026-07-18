#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
ARCH="$(uname -m)"
DMG_ARCH="aarch64"
if [[ "$ARCH" == "x86_64" ]]; then
  DMG_ARCH="x64"
fi

artifacts=(
  "$ROOT_DIR/target/release/bundle/dmg/CollabView_${VERSION}_${DMG_ARCH}.dmg"
  "$ROOT_DIR/target/release/bundle/pkg/CollabView_${VERSION}_${ARCH}.pkg"
)

"$ROOT_DIR/scripts/notarize-staple.sh" "${artifacts[@]}"
