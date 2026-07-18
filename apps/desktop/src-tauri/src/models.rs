use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsConnectionConfig {
    pub host: String,
    pub port: u16,
    pub password_configured: bool,
    pub auto_connect: bool,
    pub auto_reconnect: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub display_name: String,
    pub obs: ObsConnectionConfig,
    pub selected_quality_id: String,
    pub host_address: String,
    pub host_port: u16,
    pub auto_quality: bool,
    pub audio_mode: String,
    #[serde(default = "ShortcutSettings::default")]
    pub shortcuts: ShortcutSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            display_name: String::new(),
            obs: ObsConnectionConfig {
                host: "127.0.0.1".to_string(),
                port: 4455,
                password_configured: false,
                auto_connect: false,
                auto_reconnect: true,
            },
            selected_quality_id: "standard".to_string(),
            host_address: "127.0.0.1".to_string(),
            host_port: 12000,
            auto_quality: true,
            audio_mode: "none".to_string(),
            shortcuts: ShortcutSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutSettings {
    pub self_view: String,
    pub player1: String,
    pub player2: String,
    pub player3: String,
    pub split2: String,
    pub split4: String,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        Self {
            self_view: "Command+1".to_string(),
            player1: "Command+2".to_string(),
            player2: "Command+3".to_string(),
            player3: "Command+4".to_string(),
            split2: "Command+5".to_string(),
            split4: "Command+6".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityPreset {
    pub id: String,
    pub label: String,
    pub width: u16,
    pub height: u16,
    pub fps: u16,
    pub bitrate_kbps: u32,
    pub keyframe_seconds: u16,
    pub latency_ms: u32,
    pub codec: String,
    pub encoder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegArgsRequest {
    pub role: FfmpegRole,
    pub source_id: Option<String>,
    pub destination_host: Option<String>,
    pub destination_port: u16,
    pub quality: QualityPreset,
    pub passphrase: Option<String>,
    pub pbkeylen: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProcessRequest {
    pub id: String,
    pub args: FfmpegArgsRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SrtRelayRequest {
    pub participant_id: String,
    pub listen_port: u16,
    pub output_port: u16,
    pub latency_ms: u32,
    pub passphrase: Option<String>,
    pub pbkeylen: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SrtRelaySession {
    pub process_id: String,
    pub input_url: String,
    pub obs_url: String,
    pub preview_path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FfmpegRole {
    Sender,
    Receiver,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    pub id: String,
    pub name: String,
    pub kind: CaptureSourceKind,
    pub width: u32,
    pub height: u32,
    pub app_name: Option<String>,
    pub bundle_identifier: Option<String>,
    pub process_id: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureSourceKind {
    Display,
    Window,
    Application,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureFrameRequest {
    pub source_id: String,
    pub width: u32,
    pub height: u32,
    pub fps: u16,
    pub shows_cursor: bool,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureFrameResult {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub timestamp_ns: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticInfo {
    pub app_version: String,
    pub platform: String,
    pub arch: String,
    pub obs_version: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub encoder: String,
    pub quality: String,
    pub recent_errors: Vec<String>,
}
