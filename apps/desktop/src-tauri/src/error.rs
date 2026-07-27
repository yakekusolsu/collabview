use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("設定ディレクトリを作成できませんでした: {0}")]
    ConfigDirectory(String),
    #[error("設定を読み込めませんでした: {0}")]
    SettingsRead(String),
    #[error("設定を保存できませんでした: {0}")]
    SettingsWrite(String),
    #[error("OBSパスワードをキーチェーンへ保存できませんでした: {0}")]
    KeychainWrite(String),
    #[error("OBSパスワードをキーチェーンから読み込めませんでした: {0}")]
    KeychainRead(String),
    #[error("FFmpeg引数が無効です: {0}")]
    InvalidFfmpegRequest(String),
    #[error("FFmpegを起動できませんでした: {0}")]
    FfmpegStart(String),
    #[error("同梱sidecarが見つかりません: {0}")]
    SidecarNotFound(String),
    #[error("ScreenCaptureKit helperを起動できませんでした: {0}")]
    CaptureHelperStart(String),
    #[error("ScreenCaptureKit helperの応答を解析できませんでした: {0}")]
    CaptureHelperResponse(String),
    #[error("フレーム取得に失敗しました: {0}")]
    CaptureFrame(String),
    #[error("プロセスが見つかりません: {0}")]
    ProcessNotFound(String),
    #[error("シグナリングサーバーへ接続できませんでした: {0}")]
    Signaling(String),
}

pub type AppResult<T> = Result<T, AppError>;
