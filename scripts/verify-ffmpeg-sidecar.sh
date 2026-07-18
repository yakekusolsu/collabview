#!/usr/bin/env bash
set -euo pipefail

FFMPEG="${1:-}"
if [[ -z "$FFMPEG" || ! -x "$FFMPEG" ]]; then
  echo "FFmpeg sidecar executable was not found: $FFMPEG" >&2
  exit 1
fi

VERSION="$("$FFMPEG" -version)"
PROTOCOLS="$("$FFMPEG" -hide_banner -protocols)"
ENCODERS="$("$FFMPEG" -hide_banner -encoders)"
DECODERS="$("$FFMPEG" -hide_banner -decoders)"
INDEVS="$("$FFMPEG" -hide_banner -devices)"
REQUIRED_ENCODER="h264_videotoolbox"

if [[ "$FFMPEG" == *windows* || "$FFMPEG" == *.exe ]]; then
  REQUIRED_ENCODER="libx264"
fi

echo "$VERSION" | head -n 1

if ! grep -Eq '(^|[[:space:]])srt($|[[:space:]])' <<<"$PROTOCOLS"; then
  echo "FFmpeg sidecar does not expose the SRT protocol." >&2
  exit 1
fi

if ! grep -q "$REQUIRED_ENCODER" <<<"$ENCODERS"; then
  echo "FFmpeg sidecar does not expose $REQUIRED_ENCODER." >&2
  exit 1
fi

if ! grep -q 'mjpeg' <<<"$ENCODERS"; then
  echo "FFmpeg sidecar does not expose the MJPEG encoder for previews." >&2
  exit 1
fi

if ! grep -q 'h264' <<<"$DECODERS"; then
  echo "FFmpeg sidecar does not expose the H.264 decoder for previews." >&2
  exit 1
fi

if ! grep -q 'lavfi' <<<"$INDEVS"; then
  echo "FFmpeg sidecar does not expose lavfi for loopback tests." >&2
  exit 1
fi

echo "FFmpeg sidecar supports SRT, $REQUIRED_ENCODER, H.264 preview decode, and lavfi loopback tests."
