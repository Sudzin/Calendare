pub mod storage;

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use serde_json::Value;

pub struct AppState {
    pub data_dir: Mutex<PathBuf>,
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

    // По умолчанию: <app_data_dir>/CalendareData или локальная ./CalendareData
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

    {
        let mut dir = state.data_dir.lock().map_err(|e| e.to_string())?;
        *dir = new_path.clone();
    }

    save_persisted_data_dir(&app, &new_path);
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_tasks(state: State<'_, AppState>) -> Result<storage::ReadTasksResult, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    storage::read_all_tasks(&dir)
}

#[tauri::command]
pub fn write_task(state: State<'_, AppState>, task: Value) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    storage::write_single_task(&dir, task)
}

#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, id: String, deleted_at: String) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    storage::delete_single_task(&dir, &id, &deleted_at)
}

#[tauri::command]
pub fn import_tasks(state: State<'_, AppState>, tasks: Vec<Value>) -> Result<storage::ImportSummary, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    storage::import_task_list(&dir, tasks)
}

#[tauri::command]
pub fn purge_tombstones(state: State<'_, AppState>, max_age_days: Option<u64>) -> Result<storage::PurgeSummary, String> {
    let dir = state.data_dir.lock().map_err(|e| e.to_string())?;
    let days = max_age_days.unwrap_or(30);
    storage::purge_old_tombstones(&dir, days)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let initial_data_dir = resolve_default_data_dir(&app.handle());
            let _ = storage::ensure_directories(&initial_data_dir);

            app.manage(AppState {
                data_dir: Mutex::new(initial_data_dir),
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
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
