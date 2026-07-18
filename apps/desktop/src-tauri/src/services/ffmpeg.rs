use crate::{
    error::{AppError, AppResult},
    models::{FfmpegArgsRequest, FfmpegRole, SrtRelayRequest},
};
use std::path::Path;

const MIN_BITRATE_KBPS: u32 = 500;
const MAX_BITRATE_KBPS: u32 = 50000;
const SUPPORTED_ENCODERS: [&str; 3] = ["h264_videotoolbox", "hevc_videotoolbox", "libx264"];

pub fn build_ffmpeg_args(request: &FfmpegArgsRequest) -> AppResult<Vec<String>> {
    validate_request(request)?;
    match request.role {
        FfmpegRole::Sender => build_sender_args(request),
        FfmpegRole::Receiver => build_receiver_args(request),
    }
}

pub fn build_srt_relay_args(
    request: &SrtRelayRequest,
    preview_path: &Path,
) -> AppResult<Vec<String>> {
    validate_srt_relay_request(request, preview_path)?;
    let input_url = srt_url(
        "0.0.0.0",
        request.listen_port,
        "listener",
        request.latency_ms,
        request.passphrase.as_deref(),
        request.pbkeylen,
    );
    let output_url = srt_url(
        "127.0.0.1",
        request.output_port,
        "listener",
        request.latency_ms,
        request.passphrase.as_deref(),
        request.pbkeylen,
    );
    let preview_target = preview_path.to_string_lossy().into_owned();

    Ok(vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "info".to_string(),
        "-fflags".to_string(),
        "nobuffer".to_string(),
        "-flags".to_string(),
        "low_delay".to_string(),
        "-i".to_string(),
        input_url,
        "-map".to_string(),
        "0:v:0".to_string(),
        "-c:v".to_string(),
        "copy".to_string(),
        "-an".to_string(),
        "-f".to_string(),
        "mpegts".to_string(),
        output_url,
        "-map".to_string(),
        "0:v:0".to_string(),
        "-vf".to_string(),
        "fps=10,scale=640:-2,format=yuvj420p".to_string(),
        "-c:v".to_string(),
        "mjpeg".to_string(),
        "-q:v".to_string(),
        "4".to_string(),
        "-update".to_string(),
        "1".to_string(),
        preview_target,
    ])
}

fn validate_request(request: &FfmpegArgsRequest) -> AppResult<()> {
    if request.destination_port == 0 {
        return Err(AppError::InvalidFfmpegRequest(
            "ポート番号が範囲外です".to_string(),
        ));
    }
    if !SUPPORTED_ENCODERS.contains(&request.quality.encoder.as_str()) {
        return Err(AppError::InvalidFfmpegRequest(
            "未対応のエンコーダです".to_string(),
        ));
    }
    if request.quality.bitrate_kbps < MIN_BITRATE_KBPS
        || request.quality.bitrate_kbps > MAX_BITRATE_KBPS
    {
        return Err(AppError::InvalidFfmpegRequest(
            "ビットレートが安全な範囲外です".to_string(),
        ));
    }
    if !matches!(request.quality.fps, 30 | 60) {
        return Err(AppError::InvalidFfmpegRequest(
            "FPSは30または60のみ対応です".to_string(),
        ));
    }
    validate_srt_security(request.passphrase.as_deref(), request.pbkeylen)?;
    Ok(())
}

fn validate_srt_relay_request(request: &SrtRelayRequest, preview_path: &Path) -> AppResult<()> {
    if request.participant_id.trim().is_empty() {
        return Err(AppError::InvalidFfmpegRequest(
            "参加者IDが空です".to_string(),
        ));
    }
    if request.listen_port == 0 || request.output_port == 0 {
        return Err(AppError::InvalidFfmpegRequest(
            "ポート番号が範囲外です".to_string(),
        ));
    }
    if request.listen_port == request.output_port {
        return Err(AppError::InvalidFfmpegRequest(
            "受信用ポートとOBS出力ポートは分けてください".to_string(),
        ));
    }
    validate_srt_security(request.passphrase.as_deref(), request.pbkeylen)?;
    if preview_path.extension().and_then(|value| value.to_str()) != Some("jpg") {
        return Err(AppError::InvalidFfmpegRequest(
            "プレビュー出力はjpgのみ対応です".to_string(),
        ));
    }
    Ok(())
}

fn validate_srt_security(passphrase: Option<&str>, pbkeylen: Option<u16>) -> AppResult<()> {
    if let Some(passphrase) = passphrase {
        if passphrase.len() < 10 || passphrase.len() > 79 {
            return Err(AppError::InvalidFfmpegRequest(
                "SRT passphraseは10から79文字で指定してください".to_string(),
            ));
        }
    }
    if let Some(pbkeylen) = pbkeylen {
        if !matches!(pbkeylen, 16 | 24 | 32) {
            return Err(AppError::InvalidFfmpegRequest(
                "SRT PBKEYLENは16、24、32のみ対応です".to_string(),
            ));
        }
    }
    Ok(())
}

fn build_sender_args(request: &FfmpegArgsRequest) -> AppResult<Vec<String>> {
    let source = request.source_id.as_deref().ok_or_else(|| {
        AppError::InvalidFfmpegRequest("送信には共有対象IDが必要です".to_string())
    })?;
    let host = request.destination_host.as_deref().unwrap_or("127.0.0.1");
    let quality = &request.quality;
    let gop = quality.fps.saturating_mul(quality.keyframe_seconds);
    let srt_url = srt_url(
        host,
        request.destination_port,
        "caller",
        quality.latency_ms,
        request.passphrase.as_deref(),
        request.pbkeylen,
    );

    Ok(vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "info".to_string(),
        "-f".to_string(),
        "avfoundation".to_string(),
        "-framerate".to_string(),
        quality.fps.to_string(),
        "-capture_cursor".to_string(),
        "1".to_string(),
        "-i".to_string(),
        source.to_string(),
        "-vf".to_string(),
        format!("scale={}:{}", quality.width, quality.height),
        "-c:v".to_string(),
        quality.encoder.clone(),
        "-b:v".to_string(),
        format!("{}k", quality.bitrate_kbps),
        "-maxrate".to_string(),
        format!("{}k", quality.bitrate_kbps),
        "-bufsize".to_string(),
        format!("{}k", quality.bitrate_kbps.saturating_mul(2)),
        "-g".to_string(),
        gop.to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-an".to_string(),
        "-f".to_string(),
        "mpegts".to_string(),
        srt_url,
    ])
}

fn build_receiver_args(request: &FfmpegArgsRequest) -> AppResult<Vec<String>> {
    let quality = &request.quality;
    let input_url = srt_url(
        "0.0.0.0",
        request.destination_port,
        "listener",
        quality.latency_ms,
        request.passphrase.as_deref(),
        request.pbkeylen,
    );
    Ok(vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "info".to_string(),
        "-i".to_string(),
        input_url,
        "-c".to_string(),
        "copy".to_string(),
        "-f".to_string(),
        "mpegts".to_string(),
        "pipe:1".to_string(),
    ])
}

pub fn srt_url(
    host: &str,
    port: u16,
    mode: &str,
    latency_ms: u32,
    passphrase: Option<&str>,
    pbkeylen: Option<u16>,
) -> String {
    let mut query = vec![
        format!("mode={mode}"),
        format!("latency={}", latency_ms.saturating_mul(1000)),
        "transtype=live".to_string(),
    ];
    if let Some(passphrase) = passphrase {
        query.push(format!("passphrase={passphrase}"));
        query.push(format!("pbkeylen={}", pbkeylen.unwrap_or(16)));
    }
    format!("srt://{host}:{port}?{}", query.join("&"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::QualityPreset;

    fn quality() -> QualityPreset {
        QualityPreset {
            id: "standard".to_string(),
            label: "標準".to_string(),
            width: 1280,
            height: 720,
            fps: 60,
            bitrate_kbps: 8000,
            keyframe_seconds: 2,
            latency_ms: 250,
            codec: "h264".to_string(),
            encoder: "h264_videotoolbox".to_string(),
        }
    }

    #[test]
    fn converts_srt_latency_to_microseconds() {
        let url = srt_url("127.0.0.1", 12000, "caller", 250, None, None);
        assert!(url.contains("latency=250000"));
    }

    #[test]
    fn rejects_short_srt_passphrase() {
        let request = FfmpegArgsRequest {
            role: FfmpegRole::Sender,
            source_id: Some("1:none".to_string()),
            destination_host: Some("127.0.0.1".to_string()),
            destination_port: 12000,
            quality: quality(),
            passphrase: Some("short".to_string()),
            pbkeylen: Some(16),
        };
        assert!(build_ffmpeg_args(&request).is_err());
    }

    #[test]
    fn builds_sender_without_shell_fragments() {
        let request = FfmpegArgsRequest {
            role: FfmpegRole::Sender,
            source_id: Some("1:none".to_string()),
            destination_host: Some("127.0.0.1".to_string()),
            destination_port: 12000,
            quality: quality(),
            passphrase: None,
            pbkeylen: None,
        };
        let args = build_ffmpeg_args(&request).expect("sender args should be valid");
        assert!(args.contains(&"h264_videotoolbox".to_string()));
        assert!(!args.join(" ").contains(';'));
    }

    #[test]
    fn builds_srt_relay_with_preview_output() {
        let request = SrtRelayRequest {
            participant_id: "player-1".to_string(),
            listen_port: 12001,
            output_port: 13001,
            latency_ms: 250,
            passphrase: None,
            pbkeylen: None,
        };
        let args = build_srt_relay_args(&request, Path::new("/tmp/collabview-preview.jpg"))
            .expect("relay args should be valid");
        let joined = args.join(" ");
        assert!(joined.contains("srt://0.0.0.0:12001?mode=listener"));
        assert!(joined.contains("srt://127.0.0.1:13001?mode=listener"));
        assert!(joined.contains("fps=10,scale=640:-2,format=yuvj420p"));
        assert!(!joined.contains(';'));
    }
}
