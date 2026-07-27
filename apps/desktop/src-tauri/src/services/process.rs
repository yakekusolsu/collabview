use crate::{
    error::{AppError, AppResult},
    models::{
        ManagedProcessRequest, ObsIngestForwardRequest, ObsIngestForwardSession, SrtRelayRequest,
        SrtRelaySession,
    },
    services::{ffmpeg, sidecar},
    state::AppState,
};
use std::{fs, path::PathBuf, process::Stdio};
use tauri::State;
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
    time::{sleep, timeout, Duration},
};

pub async fn start_ffmpeg(
    state: State<'_, AppState>,
    request: ManagedProcessRequest,
) -> AppResult<()> {
    {
        let processes = state.processes.lock();
        if processes.contains_key(&request.id) {
            return Err(AppError::FfmpegStart(
                "同じIDのFFmpegが既に起動しています".to_string(),
            ));
        }
    }

    let args = ffmpeg::build_ffmpeg_args(&request.args)?;
    state.push_log(format!(
        "FFmpeg起動: id={}, args={}個",
        request.id,
        args.len()
    ));

    let child = spawn_ffmpeg_child(&request.id, &args).await?;
    state.processes.lock().insert(request.id, child);
    Ok(())
}

pub async fn start_srt_relay(
    state: State<'_, AppState>,
    request: SrtRelayRequest,
) -> AppResult<SrtRelaySession> {
    let process_id = format!("srt-relay-{}", request.participant_id);
    {
        let processes = state.processes.lock();
        if processes.contains_key(&process_id) {
            return Err(AppError::FfmpegStart(
                "同じ参加者のSRT受信が既に起動しています".to_string(),
            ));
        }
    }

    let preview_path = relay_preview_path(&request.participant_id)?;
    let args = ffmpeg::build_srt_relay_args(&request, &preview_path)?;
    state.push_log(format!(
        "SRT受信/OBS再出力を開始: id={}, listen={}, remote={}, output={}, args={}個",
        request.participant_id,
        request.listen_port,
        request.remote_input_url.is_some(),
        request.output_port,
        args.len()
    ));

    let child = spawn_ffmpeg_child(&process_id, &args).await?;
    state.processes.lock().insert(process_id.clone(), child);

    let input_url = request.remote_input_url.clone().unwrap_or_else(|| {
        ffmpeg::srt_url(
            "0.0.0.0",
            request.listen_port,
            "listener",
            request.latency_ms,
            request.passphrase.as_deref(),
            request.pbkeylen,
        )
    });

    Ok(SrtRelaySession {
        process_id,
        input_url,
        obs_url: ffmpeg::srt_url(
            "127.0.0.1",
            request.output_port,
            "caller",
            request.latency_ms,
            request.passphrase.as_deref(),
            request.pbkeylen,
        ),
        preview_path: preview_path.to_string_lossy().into_owned(),
    })
}

pub async fn start_obs_ingest_forward(
    state: State<'_, AppState>,
    request: ObsIngestForwardRequest,
) -> AppResult<ObsIngestForwardSession> {
    let process_id = "participant-obs-ingest-forward".to_string();
    {
        let processes = state.processes.lock();
        if processes.contains_key(&process_id) {
            return Err(AppError::FfmpegStart(
                "OBS入力転送が既に起動しています".to_string(),
            ));
        }
    }

    let args = ffmpeg::build_obs_ingest_forward_args(&request)?;
    state.push_log(format!(
        "OBS入力SRT転送を開始: listen={}, args={}個",
        request.listen_port,
        args.len()
    ));

    let child = spawn_ffmpeg_child(&process_id, &args).await?;
    state.processes.lock().insert(process_id.clone(), child);

    Ok(ObsIngestForwardSession {
        process_id,
        obs_publish_url: ffmpeg::srt_url(
            "127.0.0.1",
            request.listen_port,
            "caller",
            request.latency_ms,
            request.passphrase.as_deref(),
            request.pbkeylen,
        ),
    })
}

pub async fn stop_process(state: State<'_, AppState>, id: String) -> AppResult<()> {
    let child = state.processes.lock().remove(&id);
    let Some(mut child) = child else {
        return Err(AppError::ProcessNotFound(id));
    };

    if let Some(pid) = child.id() {
        tracing::info!("stopping process {pid}");
    }

    child
        .start_kill()
        .map_err(|error| AppError::FfmpegStart(error.to_string()))?;
    let _ = timeout(Duration::from_secs(3), child.wait()).await;
    state.push_log("FFmpeg停止");
    Ok(())
}

fn relay_preview_path(participant_id: &str) -> AppResult<PathBuf> {
    let safe_id: String = participant_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .collect();
    if safe_id.is_empty() {
        return Err(AppError::InvalidFfmpegRequest(
            "参加者IDが無効です".to_string(),
        ));
    }
    let dir = std::env::temp_dir().join("CollabView").join("previews");
    fs::create_dir_all(&dir).map_err(|error| AppError::FfmpegStart(error.to_string()))?;
    Ok(dir.join(format!("{safe_id}.jpg")))
}

async fn spawn_ffmpeg_child(process_id: &str, args: &[String]) -> AppResult<Child> {
    let ffmpeg_path = sidecar::resolve_sidecar("ffmpeg")?;
    let mut child = Command::new(&ffmpeg_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| AppError::FfmpegStart(format!("{}: {error}", ffmpeg_path.display())))?;

    pipe_process_output(process_id, &mut child);
    sleep(Duration::from_millis(300)).await;
    if let Some(status) = child
        .try_wait()
        .map_err(|error| AppError::FfmpegStart(error.to_string()))?
    {
        return Err(AppError::FfmpegStart(format!(
            "FFmpegが起動直後に終了しました: {status}"
        )));
    }
    Ok(child)
}

fn pipe_process_output(id: &str, child: &mut tokio::process::Child) {
    if let Some(stdout) = child.stdout.take() {
        let id = id.to_string();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::info!("ffmpeg stdout {id}: {}", sanitize_ffmpeg_log(&line));
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let id = id.to_string();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                tracing::info!("ffmpeg stderr {id}: {}", sanitize_ffmpeg_log(&line));
            }
        });
    }
}

fn sanitize_ffmpeg_log(line: &str) -> String {
    line.split('&')
        .map(|part| {
            if part.starts_with("passphrase=") {
                "passphrase=***".to_string()
            } else if let Some((prefix, _)) = part.split_once("passphrase=") {
                format!("{prefix}passphrase=***")
            } else {
                part.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("&")
}
