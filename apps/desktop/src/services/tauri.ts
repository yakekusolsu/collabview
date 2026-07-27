import { invoke } from "@tauri-apps/api/core";
import type {
  CaptureSource,
  CaptureFrameRequest,
  CaptureFrameResult,
  CreateRoomCodeRequest,
  CreateRoomCodeResult,
  DiagnosticInfo,
  JoinRoomCodeRequest,
  JoinRoomCodeResult,
  ListRoomParticipantsRequest,
  ListRoomParticipantsResult,
  ObsConnectionConfig,
  QualityPreset,
  ShortcutSettings,
  SrtRelayRequest,
  SrtRelaySession,
  TransportMode
} from "@collabview/shared-types";

export interface AppSettings {
  displayName: string;
  obs: ObsConnectionConfig;
  selectedQualityId: QualityPreset["id"];
  hostAddress: string;
  hostPort: number;
  signalingUrl: string;
  transportMode: TransportMode;
  autoQuality: boolean;
  audioMode: "none" | "game" | "system" | "microphone";
  shortcuts: ShortcutSettings;
}

export interface FfmpegArgsRequest {
  role: "sender" | "receiver";
  sourceId?: string;
  destinationHost?: string;
  destinationPort: number;
  remoteOutputUrl?: string;
  quality: QualityPreset;
  passphrase?: string;
  pbkeylen?: 16 | 24 | 32;
}

export interface ManagedProcessRequest {
  id: string;
  args: FfmpegArgsRequest;
}

export const tauriApi = {
  loadSettings: () => invoke<AppSettings>("load_settings"),
  saveSettings: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
  listCaptureSources: () => invoke<CaptureSource[]>("list_capture_sources"),
  captureFrame: (request: CaptureFrameRequest) =>
    invoke<CaptureFrameResult>("capture_frame", { request }),
  buildFfmpegArgs: (request: FfmpegArgsRequest) =>
    invoke<string[]>("build_ffmpeg_args", { request }),
  startManagedFfmpeg: (request: ManagedProcessRequest) =>
    invoke<void>("start_managed_ffmpeg", { request }),
  startSrtRelay: (request: SrtRelayRequest) =>
    invoke<SrtRelaySession>("start_srt_relay", { request }),
  stopManagedProcess: (id: string) => invoke<void>("stop_managed_process", { id }),
  getRuntimeLogs: () => invoke<string[]>("get_runtime_logs"),
  getDiagnosticInfo: () => invoke<DiagnosticInfo>("get_diagnostic_info"),
  saveObsPassword: (password: string) => invoke<void>("save_obs_password", { password }),
  loadObsPassword: () => invoke<string | null>("load_obs_password"),
  createRoomCode: (request: CreateRoomCodeRequest) =>
    invoke<CreateRoomCodeResult>("create_room_code", { request }),
  joinRoomCode: (request: JoinRoomCodeRequest) =>
    invoke<JoinRoomCodeResult>("join_room_code", { request }),
  listRoomParticipants: (request: ListRoomParticipantsRequest) =>
    invoke<ListRoomParticipantsResult>("list_room_participants", { request })
};
