use crate::{
    models::{
        AppSettings, CaptureFrameRequest, CaptureFrameResult, CaptureSource, CreateRoomCodeRequest,
        CreateRoomCodeResult, DiagnosticInfo, FfmpegArgsRequest, JoinRoomCodeRequest,
        JoinRoomCodeResult, ListRoomParticipantsRequest, ListRoomParticipantsResult,
        ManagedProcessRequest, SrtRelayRequest, SrtRelaySession,
    },
    services::{capture, diagnostics, ffmpeg, keychain, process, settings, signaling},
    state::AppState,
};
use tauri::State;

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    settings::load_settings().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    settings::save_settings(&settings).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_obs_password(password: String) -> Result<(), String> {
    keychain::save_obs_password(&password).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_obs_password() -> Result<Option<String>, String> {
    keychain::load_obs_password().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
    capture::list_capture_sources().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn capture_frame(request: CaptureFrameRequest) -> Result<CaptureFrameResult, String> {
    capture::capture_frame(request).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn build_ffmpeg_args(request: FfmpegArgsRequest) -> Result<Vec<String>, String> {
    ffmpeg::build_ffmpeg_args(&request).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn start_managed_ffmpeg(
    state: State<'_, AppState>,
    request: ManagedProcessRequest,
) -> Result<(), String> {
    process::start_ffmpeg(state, request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn start_srt_relay(
    state: State<'_, AppState>,
    request: SrtRelayRequest,
) -> Result<SrtRelaySession, String> {
    process::start_srt_relay(state, request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn stop_managed_process(state: State<'_, AppState>, id: String) -> Result<(), String> {
    process::stop_process(state, id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_runtime_logs(state: State<'_, AppState>) -> Vec<String> {
    state.logs.lock().iter().cloned().collect()
}

#[tauri::command]
pub fn get_diagnostic_info(state: State<'_, AppState>) -> DiagnosticInfo {
    diagnostics::diagnostic_info(&state)
}

#[tauri::command]
pub async fn create_room_code(
    request: CreateRoomCodeRequest,
) -> Result<CreateRoomCodeResult, String> {
    signaling::create_room_code(request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn join_room_code(request: JoinRoomCodeRequest) -> Result<JoinRoomCodeResult, String> {
    signaling::join_room_code(request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_room_participants(
    request: ListRoomParticipantsRequest,
) -> Result<ListRoomParticipantsResult, String> {
    signaling::list_room_participants(request)
        .await
        .map_err(|error| error.to_string())
}
