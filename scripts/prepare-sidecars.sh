#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_DIR="$ROOT_DIR/apps/desktop/src-tauri"
BIN_DIR="$TAURI_DIR/binaries"
TRIPLE="${COLLABVIEW_TARGET_TRIPLE:-$(rustc -vV | awk '/host:/ { print $2 }')}"
HELPER_SRC="$ROOT_DIR/apps/capture-helper"
HELPER_NAME="collabview-capture-helper-$TRIPLE"
FFMPEG_NAME="ffmpeg-$TRIPLE"

mkdir -p "$BIN_DIR"

echo "Building ScreenCaptureKit helper for $TRIPLE"
swift build \
  --package-path "$HELPER_SRC" \
  -c release \
  -Xswiftc -parse-as-library

cp "$HELPER_SRC/.build/release/collabview-capture-helper" "$BIN_DIR/$HELPER_NAME"
chmod +x "$BIN_DIR/$HELPER_NAME"

if [[ -x "$BIN_DIR/$FFMPEG_NAME" ]]; then
  echo "FFmpeg sidecar already exists: $BIN_DIR/$FFMPEG_NAME"
else
  if [[ "$TRIPLE" == "aarch64-apple-darwin" && "${COLLABVIEW_BUILD_FFMPEG:-1}" == "1" ]]; then
    "$ROOT_DIR/scripts/build-minimal-ffmpeg-sidecar.sh"
  elif [[ "$TRIPLE" == "aarch64-apple-darwin" ]]; then
    "$ROOT_DIR/scripts/download-ffmpeg-sidecar.sh"
  else
    echo "No FFmpeg sidecar download configured for $TRIPLE." >&2
    echo "Place an executable at $BIN_DIR/$FFMPEG_NAME before running pnpm tauri build." >&2
    exit 1
  fi
fi

"$ROOT_DIR/scripts/verify-ffmpeg-sidecar.sh" "$BIN_DIR/$FFMPEG_NAME"
