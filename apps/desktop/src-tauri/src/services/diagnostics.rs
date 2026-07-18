use crate::{models::DiagnosticInfo, services::sidecar, state::AppState};
use std::process::Command;

pub fn diagnostic_info(state: &AppState) -> DiagnosticInfo {
    let ffmpeg_version = sidecar::resolve_sidecar("ffmpeg")
        .ok()
        .and_then(|path| Command::new(path).arg("-version").output().ok())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|text| text.lines().next().map(ToString::to_string));

    let recent_errors = state
        .logs
        .lock()
        .iter()
        .filter(|line| line.to_lowercase().contains("error"))
        .rev()
        .take(5)
        .cloned()
        .collect();

    DiagnosticInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        obs_version: None,
        ffmpeg_version,
        encoder: "h264_videotoolbox".to_string(),
        quality: "standard".to_string(),
        recent_errors,
    }
}
