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
    let names = sidecar_file_names(base_name, triple);
    let mut candidates = Vec::new();

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            for name in &names {
                candidates.push(exe_dir.join(name));
            }
            if let Some(contents_dir) = exe_dir.parent() {
                for name in &names {
                    candidates.push(contents_dir.join("Resources").join(name));
                }
            }
        }
    }

    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let binaries = Path::new(&manifest_dir).join("binaries");
        for name in &names {
            candidates.push(binaries.join(name));
        }
    }

    candidates
}

fn sidecar_file_names(base_name: &str, triple: &str) -> Vec<String> {
    let suffixed = format!("{base_name}-{triple}");
    if env::consts::OS == "windows" {
        vec![
            format!("{suffixed}.exe"),
            suffixed,
            format!("{base_name}.exe"),
            base_name.to_string(),
        ]
    } else {
        vec![suffixed, base_name.to_string()]
    }
}

fn current_target_triple() -> String {
    match (env::consts::OS, env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin".to_string(),
        ("macos", "x86_64") => "x86_64-apple-darwin".to_string(),
        ("windows", "x86_64") => "x86_64-pc-windows-msvc".to_string(),
        ("windows", "aarch64") => "aarch64-pc-windows-msvc".to_string(),
        _ => format!("{}-{}", env::consts::ARCH, env::consts::OS),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_current_macos_triple() {
        let triple = current_target_triple();
        assert!(
            triple.ends_with("apple-darwin")
                || triple.ends_with("pc-windows-msvc")
                || triple.contains(env::consts::OS)
        );
    }

    #[test]
    fn adds_windows_exe_candidates() {
        let names = sidecar_file_names("ffmpeg", "x86_64-pc-windows-msvc");
        if env::consts::OS == "windows" {
            assert!(names.contains(&"ffmpeg-x86_64-pc-windows-msvc.exe".to_string()));
        } else {
            assert!(names.contains(&"ffmpeg-x86_64-pc-windows-msvc".to_string()));
        }
    }
}
