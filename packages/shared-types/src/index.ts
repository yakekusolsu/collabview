export type AppMode = "broadcaster" | "participant";

export type ConnectionState =
  "idle" | "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "stopped";

export interface QualityPreset {
  id: "light" | "standard" | "high" | "ultra" | "custom";
  label: string;
  width: number;
  height: number;
  fps: 30 | 60;
  bitrateKbps: number;
  keyframeSeconds: number;
  latencyMs: number;
  codec: "h264" | "hevc";
  encoder: "h264_videotoolbox" | "hevc_videotoolbox" | "libx264";
}

export interface ParticipantSummary {
  id: string;
  displayName: string;
  state: ConnectionState;
  srtUrl: string;
  obsUrl?: string;
  previewPath?: string;
  relayProcessId?: string;
  port: number;
  outputPort?: number;
  stats: StreamStats;
}

export interface StreamStats {
  fps: number;
  bitrateKbps: number;
  latencyMs: number;
  packetLossPercent: number;
  width: number;
  height: number;
  droppedFrames: number;
}

export interface ObsConnectionConfig {
  host: string;
  port: number;
  passwordConfigured: boolean;
  autoConnect: boolean;
  autoReconnect: boolean;
}

export interface ShortcutSettings {
  selfView: string;
  player1: string;
  player2: string;
  player3: string;
  split2: string;
  split4: string;
}

export interface CaptureSource {
  id: string;
  name: string;
  kind: "display" | "window" | "application";
  width: number;
  height: number;
  appName?: string;
  bundleIdentifier?: string;
  processId?: number;
}

export interface CaptureFrameRequest {
  sourceId: string;
  width: number;
  height: number;
  fps: 30 | 60;
  showsCursor: boolean;
  timeoutMs: number;
}

export interface CaptureFrameResult {
  path: string;
  width: number;
  height: number;
  timestampNs: number;
}

export interface SrtRelayRequest {
  participantId: string;
  listenPort: number;
  outputPort: number;
  latencyMs: number;
  passphrase?: string;
  pbkeylen?: 16 | 24 | 32;
}

export interface SrtRelaySession {
  processId: string;
  inputUrl: string;
  obsUrl: string;
  previewPath: string;
}

export interface DiagnosticInfo {
  appVersion: string;
  platform: string;
  arch: string;
  obsVersion?: string;
  ffmpegVersion?: string;
  encoder: string;
  quality: string;
  recentErrors: string[];
}
