use crate::{
    error::{AppError, AppResult},
    models::{CaptureFrameRequest, CaptureFrameResult, CaptureSource},
};

#[cfg(target_os = "macos")]
use crate::services::sidecar;
#[cfg(target_os = "macos")]
use std::{env, path::PathBuf, process::Command};

#[cfg(target_os = "macos")]
pub fn list_capture_sources() -> AppResult<Vec<CaptureSource>> {
    let helper = sidecar::resolve_sidecar("collabview-capture-helper")
        .map_err(|error| AppError::CaptureHelperStart(error.to_string()))?;
    let output = Command::new(helper)
        .arg("list")
        .output()
        .map_err(|error| AppError::CaptureHelperStart(error.to_string()))?;

    if !output.status.success() {
        return Err(AppError::CaptureHelperStart(stderr_text(&output.stderr)));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| AppError::CaptureHelperResponse(error.to_string()))
}

#[cfg(not(target_os = "macos"))]
pub fn list_capture_sources() -> AppResult<Vec<CaptureSource>> {
    Err(AppError::CaptureHelperStart(
        "画面/ウィンドウ列挙は現在macOS版のみ対応です。Windows版はOBS操作とSRT受信/再出力から対応します。".to_string(),
    ))
}

#[cfg(target_os = "macos")]
pub fn capture_frame(request: CaptureFrameRequest) -> AppResult<CaptureFrameResult> {
    validate_frame_request(&request)?;
    let helper = sidecar::resolve_sidecar("collabview-capture-helper")
        .map_err(|error| AppError::CaptureHelperStart(error.to_string()))?;
    let output_path = frame_output_path()?;
    let kind = request
        .source_id
        .split_once(':')
        .map(|(kind, _)| kind)
        .ok_or_else(|| AppError::CaptureFrame("共有対象IDが無効です".to_string()))?;

    let output_path_str = output_path
        .to_str()
        .ok_or_else(|| AppError::CaptureFrame("出力パスが無効です".to_string()))?;

    let args = vec![
        "frame".to_string(),
        "--kind".to_string(),
        kind.to_string(),
        "--id".to_string(),
        request.source_id.clone(),
        "--output".to_string(),
        output_path_str.to_string(),
        "--width".to_string(),
        request.width.to_string(),
        "--height".to_string(),
        request.height.to_string(),
        "--fps".to_string(),
        request.fps.to_string(),
        "--showsCursor".to_string(),
        request.shows_cursor.to_string(),
        "--timeoutMs".to_string(),
        request.timeout_ms.to_string(),
    ];

    let output = Command::new(helper)
        .args(args)
        .output()
        .map_err(|error| AppError::CaptureHelperStart(error.to_string()))?;

    if !output.status.success() {
        return Err(AppError::CaptureFrame(stderr_text(&output.stderr)));
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|error| AppError::CaptureHelperResponse(error.to_string()))
}

#[cfg(not(target_os = "macos"))]
pub fn capture_frame(_request: CaptureFrameRequest) -> AppResult<CaptureFrameResult> {
    Err(AppError::CaptureFrame(
        "画面プレビュー取得は現在macOS版のみ対応です。Windows版の画面キャプチャは今後Windows Graphics Captureで実装します。"
            .to_string(),
    ))
}

#[cfg(target_os = "macos")]
fn validate_frame_request(request: &CaptureFrameRequest) -> AppResult<()> {
    if !(64..=7680).contains(&request.width) || !(64..=4320).contains(&request.height) {
        return Err(AppError::CaptureFrame(
            "フレームサイズが範囲外です".to_string(),
        ));
    }
    if !matches!(request.fps, 30 | 60) {
        return Err(AppError::CaptureFrame(
            "FPSは30または60のみ対応です".to_string(),
        ));
    }
    if !(500..=10_000).contains(&request.timeout_ms) {
        return Err(AppError::CaptureFrame(
            "タイムアウトは500から10000msで指定してください".to_string(),
        ));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn frame_output_path() -> AppResult<PathBuf> {
    let dir = env::temp_dir().join("CollabView").join("frames");
    std::fs::create_dir_all(&dir).map_err(|error| AppError::CaptureFrame(error.to_string()))?;
    Ok(dir.join(format!("frame-{}.png", timestamp_millis())))
}

#[cfg(target_os = "macos")]
fn timestamp_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn stderr_text(stderr: &[u8]) -> String {
    String::from_utf8_lossy(stderr).trim().to_string()
}
