#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAURI_DIR="$ROOT_DIR/apps/desktop/src-tauri"
BIN_DIR="$TAURI_DIR/binaries"
RESOURCES_DIR="$TAURI_DIR/Resources"
TRIPLE="${COLLABVIEW_TARGET_TRIPLE:-$(rustc -vV | awk '/host:/ { print $2 }')}"
SOURCE_FFMPEG="${1:-/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg}"
DEST_FFMPEG="$BIN_DIR/ffmpeg-$TRIPLE"
LIB_DIR="$RESOURCES_DIR/ffmpeg-libs-$TRIPLE"
INSTALL_PREFIX="@executable_path/../Resources/ffmpeg-libs-$TRIPLE"

if [[ ! -x "$SOURCE_FFMPEG" ]]; then
  echo "Source FFmpeg was not found: $SOURCE_FFMPEG" >&2
  exit 1
fi

mkdir -p "$BIN_DIR" "$LIB_DIR"
cp "$SOURCE_FFMPEG" "$DEST_FFMPEG"
chmod +x "$DEST_FFMPEG"

collect_deps() {
  local file="$1"
  otool -L "$file" \
    | awk 'NR > 1 { print $1 }' \
    | grep -E '^/opt/homebrew/' \
    | sort -u \
    || true
}

queue_file="$(mktemp)"
seen_file="$(mktemp)"
trap 'unlink "$queue_file" "$seen_file" 2>/dev/null || true' EXIT
collect_deps "$SOURCE_FFMPEG" > "$queue_file"

while [[ -s "$queue_file" ]]; do
  dep="$(sed -n '1p' "$queue_file")"
  sed '1d' "$queue_file" > "$queue_file.next"
  mv "$queue_file.next" "$queue_file"
  grep -Fxq "$dep" "$seen_file" && continue
  echo "$dep" >> "$seen_file"

  real_dep="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$dep")"
  base="$(basename "$dep")"
  target="$LIB_DIR/$base"
  cp "$real_dep" "$target"
  chmod u+w "$target"

  while IFS= read -r child; do
    grep -Fxq "$child" "$seen_file" || echo "$child" >> "$queue_file"
  done < <(collect_deps "$real_dep")
done

rewrite_file() {
  local file="$1"
  collect_deps "$file" | while IFS= read -r dep; do
    install_name_tool -change "$dep" "$INSTALL_PREFIX/$(basename "$dep")" "$file" || true
  done
}

rewrite_file "$DEST_FFMPEG"
for dylib in "$LIB_DIR"/*.dylib; do
  [[ -e "$dylib" ]] || continue
  install_name_tool -id "$INSTALL_PREFIX/$(basename "$dylib")" "$dylib" || true
  rewrite_file "$dylib"
done

xattr -cr "$DEST_FFMPEG" "$LIB_DIR" 2>/dev/null || true
for dylib in "$LIB_DIR"/*.dylib; do
  [[ -e "$dylib" ]] || continue
  codesign --force --sign - --timestamp=none "$dylib"
done
codesign --force --sign - --timestamp=none "$DEST_FFMPEG"
codesign --verify --verbose=2 "$DEST_FFMPEG"

echo "Bundled FFmpeg sidecar: $DEST_FFMPEG"
echo "Bundled FFmpeg dylibs: $LIB_DIR"
