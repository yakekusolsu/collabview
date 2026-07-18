use crate::error::{AppError, AppResult};
use std::{
    env,
    path::{Path, PathBuf},
};

pub fn resolve_sidecar(base_name: &str) -> AppResult<PathBuf> {
    let triple = current_target_triple();
    candidate_paths(base_name, &triple)
        .into_iter()
        .find(|path| path.is_file())
        .ok_or_else(|| AppError::SidecarNotFound(format!("{base_name}-{triple}")))
}

fn candidate_paths(base_name: &str, triple: &str) -> Vec<PathBuf> {
    let suffixed = format!("{base_name}-{triple}");
    let mut candidates = Vec::new();

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join(&suffixed));
            candidates.push(exe_dir.join(base_name));
            if let Some(contents_dir) = exe_dir.parent() {
                candidates.push(contents_dir.join("Resources").join(&suffixed));
                candidates.push(contents_dir.join("Resources").join(base_name));
            }
        }
    }

    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let binaries = Path::new(&manifest_dir).join("binaries");
        candidates.push(binaries.join(&suffixed));
        candidates.push(binaries.join(base_name));
    }

    candidates
}

fn current_target_triple() -> String {
    match (env::consts::OS, env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin".to_string(),
        ("macos", "x86_64") => "x86_64-apple-darwin".to_string(),
        _ => format!("{}-{}", env::consts::ARCH, env::consts::OS),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_current_macos_triple() {
        let triple = current_target_triple();
        assert!(triple.ends_with("apple-darwin") || triple.contains(env::consts::OS));
    }
}
