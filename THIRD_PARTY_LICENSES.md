# Third Party Licenses

CollabView uses open source dependencies from the Rust and npm ecosystems.

## FFmpeg

v0.1.0 builds a minimal FFmpeg sidecar from FFmpeg source with `scripts/build-minimal-ffmpeg-sidecar.sh`.

The Apple Silicon build enables a narrow feature set: AVFoundation input, VideoToolbox H.264 encoding, MPEG-TS, and SRT transport. The generated configure output reports LGPL 2.1 or later for this minimal build. The distribution also bundles SRT and OpenSSL runtime libraries required by the sidecar.

## SRT

SRT support is expected through FFmpeg builds linked with libsrt. Confirm the FFmpeg build includes `--enable-libsrt`.

## OBS WebSocket

OBS Studio 28 and later includes obs-websocket 5.x. CollabView uses the public obs-websocket protocol through `obs-websocket-js`.
