use crate::error::{AppError, AppResult};

const SERVICE: &str = "app.collabview.desktop";
const ACCOUNT: &str = "obs-websocket-password";

pub fn save_obs_password(password: &str) -> AppResult<()> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT)
        .map_err(|error| AppError::KeychainWrite(error.to_string()))?;
    entry
        .set_password(password)
        .map_err(|error| AppError::KeychainWrite(error.to_string()))
}

pub fn load_obs_password() -> AppResult<Option<String>> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT)
        .map_err(|error| AppError::KeychainRead(error.to_string()))?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AppError::KeychainRead(error.to_string())),
    }
}
