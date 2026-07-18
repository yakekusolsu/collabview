# Architecture

```mermaid
flowchart LR
  Participant["Participant Mode"] --> Capture["Screen Capture"]
  Capture --> Encoder["VideoToolbox H.264"]
  Encoder --> SRT["SRT Transport"]
  SRT --> Broadcaster["Broadcaster Mode"]
  Broadcaster --> LocalOut["Local SRT/UDP Output"]
  LocalOut --> OBS["OBS Media Source"]
  Broadcaster --> ObsWs["obs-websocket 5.x"]
  ObsWs --> OBS
```

Transport implementations are intentionally isolated:

- `SrtTransport`: v0.1.0 target through FFmpeg/libsrt
- `WebRtcTransport`: future internet-friendly option
- `QuicTransport`: future low-latency option

The desktop UI never builds shell command strings. It sends structured requests to Rust, and Rust generates validated FFmpeg argument arrays.
