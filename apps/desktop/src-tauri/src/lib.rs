mod commands;
mod error;
mod models;
mod services;
mod state;

use commands::{
    build_ffmpeg_args, capture_frame, get_diagnostic_info, get_runtime_logs, list_capture_sources,
    load_obs_password, load_settings, save_obs_password, save_settings, start_managed_ffmpeg,
    start_srt_relay, stop_managed_process,
};
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            load_settings,
            save_settings,
            save_obs_password,
            load_obs_password,
            list_capture_sources,
            capture_frame,
            build_ffmpeg_args,
            start_managed_ffmpeg,
            start_srt_relay,
            stop_managed_process,
            get_runtime_logs,
            get_diagnostic_info
        ]);

    if let Err(error) = builder.run(tauri::generate_context!()) {
        eprintln!("failed to run CollabView: {error}");
    }
}
