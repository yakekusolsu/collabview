#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG="${COLLABVIEW_FFMPEG:-$ROOT_DIR/apps/desktop/src-tauri/binaries/ffmpeg-aarch64-apple-darwin}"
INPUT_PORT="${COLLABVIEW_SRT_INPUT_PORT:-18060}"
OBS_PORT="${COLLABVIEW_SRT_OBS_PORT:-18061}"
LATENCY_US="${COLLABVIEW_SRT_LATENCY_US:-250000}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/collabview-srt-loopback.XXXXXX")"
PREVIEW="$WORK_DIR/preview.jpg"
OBS_OUT="$WORK_DIR/obs-output.ts"
RELAY_LOG="$WORK_DIR/relay.log"
OBS_LOG="$WORK_DIR/obs.log"
SENDER_LOG="$WORK_DIR/sender.log"

cleanup() {
  for pid in ${RELAY_PID:-} ${OBS_PID:-} ${SENDER_PID:-}; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

if [[ ! -x "$FFMPEG" ]]; then
  echo "FFmpeg sidecar executable was not found: $FFMPEG" >&2
  exit 1
fi

"$FFMPEG" \
  -hide_banner \
  -loglevel info \
  -fflags nobuffer \
  -flags low_delay \
  -i "srt://0.0.0.0:${INPUT_PORT}?mode=listener&latency=${LATENCY_US}&transtype=live" \
  -map 0:v:0 \
  -c:v copy \
  -an \
  -f mpegts \
  "srt://127.0.0.1:${OBS_PORT}?mode=listener&latency=${LATENCY_US}&transtype=live" \
  -map 0:v:0 \
  -vf "fps=10,scale=640:-2,format=yuvj420p" \
  -c:v mjpeg \
  -q:v 4 \
  -update 1 \
  "$PREVIEW" \
  >"$RELAY_LOG" 2>&1 &
RELAY_PID=$!

sleep 1

"$FFMPEG" \
  -hide_banner \
  -loglevel warning \
  -re \
  -f lavfi \
  -i "testsrc2=size=1280x720:rate=60" \
  -t 8 \
  -c:v h264_videotoolbox \
  -b:v 8000k \
  -maxrate 8000k \
  -bufsize 16000k \
  -g 120 \
  -pix_fmt yuv420p \
  -an \
  -f mpegts \
  "srt://127.0.0.1:${INPUT_PORT}?mode=caller&latency=${LATENCY_US}&transtype=live" \
  >"$SENDER_LOG" 2>&1 &
SENDER_PID=$!

sleep 1

(
  for attempt in {1..10}; do
    "$FFMPEG" \
      -y \
      -hide_banner \
      -loglevel warning \
      -t 5 \
      -i "srt://127.0.0.1:${OBS_PORT}?mode=caller&latency=${LATENCY_US}&transtype=live" \
      -c copy \
      -f mpegts \
      "$OBS_OUT" \
      >>"$OBS_LOG" 2>&1 && exit 0
    echo "OBS SRT caller retry $attempt" >>"$OBS_LOG"
    sleep 0.75
  done
  exit 1
) &
OBS_PID=$!

wait "$SENDER_PID"
wait "$OBS_PID" || true
sleep 1
cleanup
wait "$RELAY_PID" >/dev/null 2>&1 || true
wait "$OBS_PID" >/dev/null 2>&1 || true

if [[ ! -s "$PREVIEW" ]]; then
  echo "Preview JPEG was not generated. Logs are in $WORK_DIR" >&2
  exit 1
fi

if [[ ! -s "$OBS_OUT" ]]; then
  echo "OBS-simulated SRT output was not generated. Logs are in $WORK_DIR" >&2
  exit 1
fi

PREVIEW_BYTES="$(stat -f%z "$PREVIEW")"
OBS_BYTES="$(stat -f%z "$OBS_OUT")"
echo "720p60 SRT loopback succeeded."
echo "Preview JPEG: $PREVIEW ($PREVIEW_BYTES bytes)"
echo "OBS SRT capture: $OBS_OUT ($OBS_BYTES bytes)"
