use std::process::Command;

#[cfg(target_os = "windows")]
pub fn set_autostart_windows(enabled: bool) -> Result<(), String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_path = current_exe.to_string_lossy().to_string();

    if enabled {
        let status = Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "Calendare",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe_path),
                "/f",
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err("Не удалось добавить запись автозапуска в реестр Windows".into());
        }
    } else {
        let _ = Command::new("reg")
            .args([
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "Calendare",
                "/f",
            ])
            .status();
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn is_autostart_enabled_windows() -> Result<bool, String> {
    let output = Command::new("reg")
        .args([
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            "/v",
            "Calendare",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    Ok(output.status.success())
}

#[cfg(not(target_os = "windows"))]
pub fn set_autostart_windows(_enabled: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn is_autostart_enabled_windows() -> Result<bool, String> {
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_autostart_noop_non_windows() {
        let res = set_autostart_windows(false);
        assert!(res.is_ok());
    }
}
