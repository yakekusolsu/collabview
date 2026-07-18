#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="$ROOT_DIR/target/release/bundle/macos/CollabView.app"
PKG_DIR="$ROOT_DIR/target/release/bundle/pkg"
VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"

if [[ ! -d "$APP_PATH" ]]; then
  echo "CollabView.appが見つかりません。先に pnpm tauri build を実行してください。" >&2
  exit 1
fi

mkdir -p "$PKG_DIR"
PKG_PATH="$PKG_DIR/CollabView_${VERSION}_$(uname -m).pkg"
pkg_args=(
  --install-location /Applications
  --component "$APP_PATH"
)

if [[ -n "${APPLE_INSTALLER_SIGNING_IDENTITY:-}" ]]; then
  pkg_args+=(--sign "$APPLE_INSTALLER_SIGNING_IDENTITY")
fi

pkgbuild "${pkg_args[@]}" "$PKG_PATH"

if [[ "${COLLABVIEW_NOTARIZE_PKG:-0}" == "1" ]]; then
  "$ROOT_DIR/scripts/notarize-staple.sh" "$PKG_PATH"
fi
