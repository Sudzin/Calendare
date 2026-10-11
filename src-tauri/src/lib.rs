pub mod autostart;
pub mod crypto;
pub mod credential_manager;
pub mod manifest;
pub mod storage;
pub mod vault;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::crypto::MasterKey;

pub struct AppState {
    pub data_dir: Mutex<PathBuf>,
    pub master_key: Mutex<Option<MasterKey>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVaultResponse {
    pub recovery_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultStatusResponse {
    pub is_initialized: bool,
    pub is_unlocked: bool,
    pub cache_in_credential_manager: bool,
}

fn get_config_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|p| p.join("config.json"))
}

fn load_persisted_data_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Some(config_path) = get_config_file_path(app) {
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(dir_str) = json.get("dataDir").and_then(|v| v.as_str()) {
                        let path = PathBuf::from(dir_str);
                        if !dir_str.trim().is_empty() {
                            return Some(path);
                        }
                    }
                }
            }
        }
    }
    None
}

fn save_persisted_data_dir(app: &AppHandle, data_dir: &PathBuf) {
    if let Some(config_path) = get_config_file_path(app) {
        if let Some(parent) = config_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let config = serde_json::json!({
            "dataDir": data_dir.to_string_lossy().to_string()
        });
        if let Ok(serialized) = serde_json::to_string_pretty(&config) {
            let _ = fs::write(config_path, serialized);
        }
    }
}

fn resolve_default_data_dir(app: &AppHandle) -> PathBuf {
    if let Some(saved) = load_persisted_data_dir(app) {
        return saved;
    }

    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("CalendareData")
}

#[tauri::command]
pub fn get_data_dir(state: State<'_, AppState>) -> Result<String, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_data_dir(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<String, String> {
    let new_path = PathBuf::from(&path);
    storage::ensure_directories(&new_path)?;

    // Попытка авто-разблокировки из Credential Manager для новой папки
    let auto_key = vault::try_auto_unlock_from_credential_manager(&new_path).unwrap_or(None);

    {
        let mut dir = state.data_dir.lock().map_err(|e| e.to_string())?;
        *dir = new_path.clone();

        let mut key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
        *key_guard = auto_key;
    }

    save_persisted_data_dir(&app, &new_path);
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_tasks(state: State<'_, AppState>) -> Result<storage::ReadTasksResult, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    storage::read_all_tasks(&dir, key_guard.as_ref())
}

#[tauri::command]
pub fn write_task(state: State<'_, AppState>, task: Value) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    storage::write_single_task(&dir, task, key_guard.as_ref())
}

#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, id: String, deleted_at: String) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    storage::delete_single_task(&dir, &id, &deleted_at, key_guard.as_ref())
}

#[tauri::command]
pub fn import_tasks(state: State<'_, AppState>, tasks: Vec<Value>) -> Result<storage::ImportSummary, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    storage::import_task_list(&dir, tasks, key_guard.as_ref())
}

#[tauri::command]
pub fn purge_tombstones(state: State<'_, AppState>, max_age_days: Option<u64>) -> Result<storage::PurgeSummary, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    let days = max_age_days.unwrap_or(30);
    storage::purge_old_tombstones(&dir, days, key_guard.as_ref())
}

// ---------------- Vault & Encryption Commands ----------------

#[tauri::command]
pub fn is_vault_initialized(state: State<'_, AppState>) -> Result<bool, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    Ok(vault::is_vault_initialized(&dir))
}

#[tauri::command]
pub fn is_vault_unlocked(state: State<'_, AppState>) -> Result<bool, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    if !vault::is_vault_initialized(&dir) {
        return Ok(true); // Если хранилище не зашифровано, оно открыто
    }
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    Ok(key_guard.is_some())
}

#[tauri::command]
pub fn get_vault_status(state: State<'_, AppState>) -> Result<VaultStatusResponse, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let is_init = vault::is_vault_initialized(&dir);
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    let is_unlocked = if is_init { key_guard.is_some() } else { true };
    let cache_enabled = if is_init {
        vault::load_vault_config(&dir).map(|c| c.cache_in_credential_manager).unwrap_or(true)
    } else {
        true
    };

    Ok(VaultStatusResponse {
        is_initialized: is_init,
        is_unlocked,
        cache_in_credential_manager: cache_enabled,
    })
}

#[tauri::command]
pub fn create_vault(
    state: State<'_, AppState>,
    password: String,
    cache_in_cred_mgr: Option<bool>,
) -> Result<CreateVaultResponse, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let use_cred_mgr = cache_in_cred_mgr.unwrap_or(true);

    let (master_key, recovery_key) = vault::create_vault(&dir, &password, use_cred_mgr)?;

    // Миграция существующих незашифрованных задач в зашифрованные
    let _ = storage::migrate_existing_tasks_to_vault(&dir, &master_key);

    {
        let mut key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
        *key_guard = Some(master_key);
    }

    Ok(CreateVaultResponse { recovery_key })
}

#[tauri::command]
pub fn unlock_vault(state: State<'_, AppState>, password: String) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let master_key = vault::unlock_vault_with_password(&dir, &password)?;

    {
        let mut key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
        *key_guard = Some(master_key);
    }

    Ok(())
}

#[tauri::command]
pub fn unlock_vault_with_recovery_key(state: State<'_, AppState>, recovery_key: String) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let master_key = vault::unlock_vault_with_recovery_key(&dir, &recovery_key)?;

    {
        let mut key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
        *key_guard = Some(master_key);
    }

    Ok(())
}

#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    let mut key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    *key_guard = None; // zeroize on drop
    Ok(())
}

#[tauri::command]
pub fn set_credential_caching(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let key_guard = state.master_key.lock().map_err(|e| e.to_string())?;
    vault::update_credential_caching(&dir, enabled, key_guard.as_ref())
}

#[tauri::command]
pub fn show_native_notification(
    _app: AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let body_str = body.unwrap_or_default();
        let safe_title = title.replace('`', "``").replace('"', "`\"");
        let safe_body = body_str.replace('`', "``").replace('"', "`\"");

        let script = format!(
            r#"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$textNodes = $template.GetElementsByTagName("text")
$textNodes.Item(0).AppendChild($template.CreateTextNode("{}")) > $null
$textNodes.Item(1).AppendChild($template.CreateTextNode("{}")) > $null
$toast = [Windows.UI.Notifications.ToastNotification]::new($template)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Calendare").Show($toast)"#,
            safe_title, safe_body
        );

        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .spawn();

        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (title, body);
        Ok(())
    }
}

#[tauri::command]
pub fn is_autostart_enabled() -> Result<bool, String> {
    autostart::is_autostart_enabled_windows()
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    autostart::set_autostart_windows(enabled)
}

#[tauri::command]
pub fn pick_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Выберите папку для данных Calendare"
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}
"#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| e.to_string())?;

        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if text.is_empty() {
            Ok(None)
        } else {
            Ok(Some(text))
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
pub fn exit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Закрытие окна сворачивает приложение в трей, планировщик продолжает работать
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Настройка системного трея
            let show_item = MenuItemBuilder::with_id("show", "Открыть Calendare").build(app)?;
            let exit_item = MenuItemBuilder::with_id("quit", "Выход").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&exit_item)
                .build()?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Calendare")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder.build(app);

            let initial_data_dir = resolve_default_data_dir(&app.handle());
            let _ = storage::ensure_directories(&initial_data_dir);

            // Попытка авто-разблокировки из Windows Credential Manager
            let auto_key = vault::try_auto_unlock_from_credential_manager(&initial_data_dir).unwrap_or(None);

            app.manage(AppState {
                data_dir: Mutex::new(initial_data_dir),
                master_key: Mutex::new(auto_key),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_data_dir,
            set_data_dir,
            read_tasks,
            write_task,
            delete_task,
            import_tasks,
            purge_tombstones,
            is_vault_initialized,
            is_vault_unlocked,
            get_vault_status,
            create_vault,
            unlock_vault,
            unlock_vault_with_recovery_key,
            lock_vault,
            set_credential_caching,
            show_native_notification,
            is_autostart_enabled,
            set_autostart,
            pick_folder,
            exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
