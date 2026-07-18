#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"
TRIPLE="${COLLABVIEW_TARGET_TRIPLE:-$(rustc -vV | awk '/host:/ { print $2 }')}"
URL="${COLLABVIEW_FFMPEG_URL:-https://www.osxexperts.net/ffmpeg80arm.zip}"
ARCHIVE="$BIN_DIR/ffmpeg-download.zip"
DEST="$BIN_DIR/ffmpeg-$TRIPLE"

if [[ "$TRIPLE" != "aarch64-apple-darwin" ]]; then
  echo "Automatic FFmpeg download is currently configured only for aarch64-apple-darwin." >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
echo "Downloading FFmpeg sidecar from $URL"
curl -L --fail --output "$ARCHIVE" "$URL"
python3 - "$ARCHIVE" "$DEST" <<'PY'
import stat
import sys
import zipfile
from pathlib import Path

archive = Path(sys.argv[1])
dest = Path(sys.argv[2])
with zipfile.ZipFile(archive) as zf:
    candidates = [name for name in zf.namelist() if Path(name).name == "ffmpeg"]
    if not candidates:
        raise SystemExit("ffmpeg executable not found in archive")
    data = zf.read(candidates[0])
dest.write_bytes(data)
dest.chmod(dest.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
PY
unlink "$ARCHIVE"
echo "Installed FFmpeg sidecar at $DEST"
