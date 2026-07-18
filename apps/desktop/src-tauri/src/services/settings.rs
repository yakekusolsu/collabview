use crate::{
    error::{AppError, AppResult},
    models::AppSettings,
};
use directories::ProjectDirs;
use std::{fs, path::PathBuf};

fn config_path() -> AppResult<PathBuf> {
    let project_dirs = ProjectDirs::from("app", "CollabView", "CollabView").ok_or_else(|| {
        AppError::ConfigDirectory("Application Supportを解決できません".to_string())
    })?;
    let dir = project_dirs.config_dir();
    fs::create_dir_all(dir).map_err(|error| AppError::ConfigDirectory(error.to_string()))?;
    Ok(dir.join("settings.json"))
}

pub fn load_settings() -> AppResult<AppSettings> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content =
        fs::read_to_string(path).map_err(|error| AppError::SettingsRead(error.to_string()))?;
    serde_json::from_str(&content).map_err(|error| AppError::SettingsRead(error.to_string()))
}

pub fn save_settings(settings: &AppSettings) -> AppResult<()> {
    let path = config_path()?;
    let content = serde_json::to_string_pretty(settings)
        .map_err(|error| AppError::SettingsWrite(error.to_string()))?;
    fs::write(path, content).map_err(|error| AppError::SettingsWrite(error.to_string()))
}
