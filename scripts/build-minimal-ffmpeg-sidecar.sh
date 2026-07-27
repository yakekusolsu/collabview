#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/ffmpeg"
TAURI_DIR="$ROOT_DIR/apps/desktop/src-tauri"
BIN_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"
RESOURCES_DIR="$TAURI_DIR/Resources"
TRIPLE="${COLLABVIEW_TARGET_TRIPLE:-$(rustc -vV | awk '/host:/ { print $2 }')}"
FFMPEG_VERSION="${COLLABVIEW_FFMPEG_VERSION:-8.1.2}"
ARCHIVE="$BUILD_DIR/ffmpeg-$FFMPEG_VERSION.tar.xz"
SRC_DIR="$BUILD_DIR/ffmpeg-$FFMPEG_VERSION"
DEST="$BIN_DIR/ffmpeg-$TRIPLE"
LIB_DIR="$RESOURCES_DIR/ffmpeg-libs-$TRIPLE"
INSTALL_PREFIX="@executable_path/../Resources/ffmpeg-libs-$TRIPLE"

if [[ "$TRIPLE" != "aarch64-apple-darwin" ]]; then
  echo "Minimal FFmpeg sidecar build is currently configured for aarch64-apple-darwin." >&2
  exit 1
fi

if ! command -v pkg-config >/dev/null 2>&1; then
  echo "pkg-config is required to build the FFmpeg sidecar." >&2
  exit 1
fi

if ! pkg-config --exists srt; then
  export PKG_CONFIG_PATH="/opt/homebrew/opt/srt/lib/pkgconfig:/opt/homebrew/opt/openssl@3/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
fi

if ! pkg-config --exists srt; then
  echo "libsrt development files were not found. Install srt on the build machine." >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$BIN_DIR" "$LIB_DIR"
if [[ ! -f "$ARCHIVE" ]]; then
  curl -L --fail --output "$ARCHIVE" "https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz"
fi

if [[ ! -d "$SRC_DIR" ]]; then
  tar -C "$BUILD_DIR" -xf "$ARCHIVE"
fi

pushd "$SRC_DIR" >/dev/null
make distclean >/dev/null 2>&1 || true

export PKG_CONFIG_PATH="/opt/homebrew/opt/srt/lib/pkgconfig:/opt/homebrew/opt/openssl@3/lib/pkgconfig:${PKG_CONFIG_PATH:-}"

./configure \
  --cc=clang \
  --prefix="$BUILD_DIR/prefix" \
  --pkg-config-flags="--static" \
  --extra-cflags="-I/opt/homebrew/opt/srt/include -I/opt/homebrew/opt/openssl@3/include" \
  --extra-ldflags="-L/opt/homebrew/opt/srt/lib -L/opt/homebrew/opt/openssl@3/lib -Wl,-headerpad_max_install_names" \
  --disable-doc \
  --disable-debug \
  --disable-ffplay \
  --disable-ffprobe \
  --disable-autodetect \
  --disable-everything \
  --enable-avdevice \
  --enable-avfilter \
  --enable-avformat \
  --enable-avcodec \
  --enable-swscale \
  --enable-network \
  --enable-libsrt \
  --enable-avfoundation \
  --enable-protocol=file,pipe,libsrt,tcp,udp \
  --enable-indev=avfoundation,lavfi \
  --enable-muxer=mpegts,image2 \
  --enable-demuxer=mpegts \
  --enable-encoder=h264_videotoolbox,mjpeg \
  --enable-decoder=h264,wrapped_avframe \
  --enable-parser=h264 \
  --enable-bsf=h264_mp4toannexb \
  --enable-filter=scale,fps,format,testsrc2 \
  --enable-videotoolbox \
  --enable-audiotoolbox \
  --enable-swresample

make -j"$(sysctl -n hw.ncpu)"
cp ffmpeg "$DEST"
chmod +x "$DEST"
popd >/dev/null

copy_runtime_lib() {
  local source="$1"
  local target="$LIB_DIR/$(basename "$source")"
  cp "$source" "$target"
  chmod u+w "$target"
  install_name_tool -id "$INSTALL_PREFIX/$(basename "$source")" "$target" || true
}

copy_runtime_lib /opt/homebrew/opt/srt/lib/libsrt.1.5.dylib
copy_runtime_lib /opt/homebrew/opt/openssl@3/lib/libssl.3.dylib
copy_runtime_lib /opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib

rewrite_homebrew_refs() {
  local file="$1"
  otool -L "$file" \
    | awk 'NR > 1 { print $1 }' \
    | grep -E '^/opt/homebrew/' \
    | while IFS= read -r dep; do
      local base
      base="$(basename "$dep")"
      if [[ -f "$LIB_DIR/$base" ]]; then
        install_name_tool -change "$dep" "$INSTALL_PREFIX/$base" "$file" || true
      fi
    done
}

rewrite_homebrew_refs "$DEST"
for dylib in "$LIB_DIR"/*.dylib; do
  [[ -e "$dylib" ]] || continue
  rewrite_homebrew_refs "$dylib"
done

xattr -cr "$DEST" "$LIB_DIR" 2>/dev/null || true
codesign --force --sign - --timestamp=none "$LIB_DIR/libcrypto.3.dylib"
codesign --force --sign - --timestamp=none "$LIB_DIR/libssl.3.dylib"
codesign --force --sign - --timestamp=none "$LIB_DIR/libsrt.1.5.dylib"
codesign --force --sign - --timestamp=none "$DEST"
codesign --verify --verbose=2 "$DEST"
"$DEST" -version >/dev/null

echo "Built minimal FFmpeg sidecar at $DEST"
