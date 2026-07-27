export type AppMode = "broadcaster" | "participant";

export type TransportMode = "lan" | "relay";

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
  remoteInputUrl?: string;
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
  remoteInputUrl?: string;
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

export interface ObsIngestForwardRequest {
  listenPort: number;
  remoteOutputUrl: string;
  latencyMs: number;
  passphrase?: string;
  pbkeylen?: 16 | 24 | 32;
}

export interface ObsIngestForwardSession {
  processId: string;
  obsPublishUrl: string;
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

export interface CreateRoomCodeRequest {
  signalingUrl: string;
  transportMode: TransportMode;
  hostAddress: string;
  hostPort: number;
}

export interface CreateRoomCodeResult {
  roomCode: string;
  hostToken: string;
  transportMode: TransportMode;
  tokenExpiresAt: number;
}

export interface JoinRoomCodeRequest {
  signalingUrl: string;
  roomCode: string;
  displayName: string;
}

export interface JoinRoomCodeResult {
  participantId: string;
  transportMode: TransportMode;
  hostAddress: string;
  hostPort: number;
  participantPublishUrl?: string;
  tokenExpiresAt: number;
}

export interface ListRoomParticipantsRequest {
  signalingUrl: string;
  roomCode: string;
  hostToken: string;
}

export interface ListRoomParticipantsResult {
  participants: RoomParticipantConnection[];
}

export interface RoomParticipantConnection {
  participantId: string;
  displayName: string;
  joinedAt: number;
  relay?: RelayEndpoint;
}

export interface RelayEndpoint {
  participantId: string;
  ingestPort: number;
  egressPort: number;
  latencyMs: number;
  pbkeylen: 16 | 24 | 32;
  participantPublishUrl: string;
  broadcasterPullUrl: string;
}
