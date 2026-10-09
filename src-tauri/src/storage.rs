use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct CorruptedFileInfo {
    pub filename: String,
    pub reason: String,
    pub timestamp: String,
    pub backup_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReadTasksResult {
    pub tasks: Vec<Value>,
    pub corrupted_files: Vec<CorruptedFileInfo>,
    pub data_dir: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportSummary {
    pub imported_count: usize,
    pub skipped_count: usize,
}

/// Получение текущей метки времени в формате ISO-8601-подобной строки для имен файлов
pub fn current_timestamp_str() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}_{}", now.as_secs(), now.subsec_millis())
}

/// Создание структуры папок хранилища: <data_dir>/tasks и <data_dir>/corrupt
pub fn ensure_directories(data_dir: &Path) -> Result<(), String> {
    let tasks_dir = data_dir.join("tasks");
    let corrupt_dir = data_dir.join("corrupt");

    fs::create_dir_all(&tasks_dir).map_err(|e| format!("Failed to create tasks directory: {e}"))?;
    fs::create_dir_all(&corrupt_dir).map_err(|e| format!("Failed to create corrupt directory: {e}"))?;

    Ok(())
}

/// Атомарная запись файла: запись во временный файл в той же папке, сброс буферов на диск и fs::rename
pub fn atomic_write_file(target_path: &Path, content: &str) -> std::io::Result<()> {
    let parent = target_path
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Parent directory not found"))?;

    let file_stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let tmp_filename = format!("{}.tmp.{}", file_stem, current_timestamp_str());
    let tmp_path = parent.join(tmp_filename);

    // 1. Создаем временный файл
    {
        let mut file = File::create(&tmp_path)?;
        file.write_all(content.as_bytes())?;
        file.flush()?;
        file.sync_all()?;
    }

    // 2. Атомарно переименовываем во временный файл
    if let Err(err) = fs::rename(&tmp_path, target_path) {
        // Очищаем временный файл при ошибке
        let _ = fs::remove_file(&tmp_path);
        return Err(err);
    }

    Ok(())
}

/// Проверка валидности структуры задачи
pub fn is_valid_task(val: &Value) -> bool {
    if let Some(obj) = val.as_object() {
        let has_id = obj.get("id").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_title = obj.get("title").and_then(|v| v.as_str()).is_some();
        let has_date = obj.get("date").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_status = obj.get("status").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_priority = obj.get("priority").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);

        has_id && has_title && has_date && has_status && has_priority
    } else {
        false
    }
}

/// Чтение всех задач из папки данных
pub fn read_all_tasks(data_dir: &Path) -> Result<ReadTasksResult, String> {
    ensure_directories(data_dir)?;

    let tasks_dir = data_dir.join("tasks");
    let corrupt_dir = data_dir.join("corrupt");

    let entries = fs::read_dir(&tasks_dir)
        .map_err(|e| format!("Failed to read tasks directory: {e}"))?;

    let mut tasks = Vec::new();
    let mut corrupted_files = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Пропускаем временные файлы
        if file_name.contains(".tmp.") {
            continue;
        }

        // Обрабатываем файлы .json
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                // Ошибка чтения — перемещаем в corrupt
                let timestamp = current_timestamp_str();
                let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                let corrupt_path = corrupt_dir.join(&corrupt_filename);
                let _ = fs::rename(&path, &corrupt_path);

                corrupted_files.push(CorruptedFileInfo {
                    filename: file_name,
                    reason: format!("File read error: {e}"),
                    timestamp,
                    backup_path: corrupt_path.to_string_lossy().to_string(),
                });
                continue;
            }
        };

        // Парсинг JSON
        let parsed_val: Result<Value, _> = serde_json::from_str(&content);
        match parsed_val {
            Ok(val) => {
                if is_valid_task(&val) {
                    // Проверяем, не является ли задача удаленной (tombstone: deletedAt)
                    let is_deleted = val
                        .as_object()
                        .and_then(|o| o.get("deletedAt"))
                        .and_then(|v| v.as_str())
                        .map(|s| !s.trim().is_empty())
                        .unwrap_or(false);

                    if !is_deleted {
                        tasks.push(val);
                    }
                } else {
                    // Невалидная структура — переносим в corrupt/
                    let timestamp = current_timestamp_str();
                    let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                    let corrupt_path = corrupt_dir.join(&corrupt_filename);
                    let _ = fs::rename(&path, &corrupt_path);

                    corrupted_files.push(CorruptedFileInfo {
                        filename: file_name,
                        reason: "Missing required Task fields (id, title, date, status, priority)".to_string(),
                        timestamp,
                        backup_path: corrupt_path.to_string_lossy().to_string(),
                    });
                }
            }
            Err(parse_err) => {
                // Синтаксическая ошибка JSON — переносим в corrupt/
                let timestamp = current_timestamp_str();
                let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                let corrupt_path = corrupt_dir.join(&corrupt_filename);
                let _ = fs::rename(&path, &corrupt_path);

                corrupted_files.push(CorruptedFileInfo {
                    filename: file_name,
                    reason: format!("JSON parse error: {parse_err}"),
                    timestamp,
                    backup_path: corrupt_path.to_string_lossy().to_string(),
                });
            }
        }
    }

    Ok(ReadTasksResult {
        tasks,
        corrupted_files,
        data_dir: data_dir.to_string_lossy().to_string(),
    })
}

/// Запись одной задачи
pub fn write_single_task(data_dir: &Path, task: Value) -> Result<(), String> {
    ensure_directories(data_dir)?;

    let id = task
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Task id is required".to_string())?;

    if id.trim().is_empty() {
        return Err("Task id cannot be empty".to_string());
    }

    let serialized = serde_json::to_string_pretty(&task)
        .map_err(|e| format!("Failed to serialize task: {e}"))?;

    let file_path = data_dir.join("tasks").join(format!("{}.json", id));

    atomic_write_file(&file_path, &serialized)
        .map_err(|e| format!("Failed to atomically write task {id}: {e}"))?;

    Ok(())
}

/// Пометка задачи как удаленной (Tombstone: deletedAt)
pub fn delete_single_task(data_dir: &Path, id: &str, deleted_at: &str) -> Result<(), String> {
    ensure_directories(data_dir)?;

    let file_path = data_dir.join("tasks").join(format!("{}.json", id));

    let mut task_obj = if file_path.exists() {
        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read existing task: {e}"))?;
        serde_json::from_str::<Value>(&content).unwrap_or_else(|_| serde_json::json!({ "id": id }))
    } else {
        serde_json::json!({ "id": id })
    };

    if let Some(obj) = task_obj.as_object_mut() {
        obj.insert("deletedAt".to_string(), Value::String(deleted_at.to_string()));
        obj.insert("updatedAt".to_string(), Value::String(deleted_at.to_string()));
    }

    let serialized = serde_json::to_string_pretty(&task_obj)
        .map_err(|e| format!("Failed to serialize deleted task: {e}"))?;

    atomic_write_file(&file_path, &serialized)
        .map_err(|e| format!("Failed to atomically write tombstone for {id}: {e}"))?;

    Ok(())
}

/// Пакетный импорт задач (например, из localStorage) с идемпотентностью по id и updatedAt
pub fn import_task_list(data_dir: &Path, tasks: Vec<Value>) -> Result<ImportSummary, String> {
    ensure_directories(data_dir)?;

    let mut imported = 0;
    let mut skipped = 0;

    for task in tasks {
        let id = match task.get("id").and_then(|v| v.as_str()) {
            Some(id) if !id.trim().is_empty() => id,
            _ => {
                skipped += 1;
                continue;
            }
        };

        let file_path = data_dir.join("tasks").join(format!("{}.json", id));

        // Если файл уже существует, проверяем updatedAt для идемпотентности
        if file_path.exists() {
            if let Ok(existing_content) = fs::read_to_string(&file_path) {
                if let Ok(existing_val) = serde_json::from_str::<Value>(&existing_content) {
                    let existing_updated = existing_val.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
                    let import_updated = task.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");

                    // Если существующая задача новее или такая же — пропускаем
                    if !existing_updated.is_empty() && existing_updated >= import_updated {
                        skipped += 1;
                        continue;
                    }
                }
            }
        }

        // Записываем атомарно
        if write_single_task(data_dir, task).is_ok() {
            imported += 1;
        } else {
            skipped += 1;
        }
    }

    Ok(ImportSummary {
        imported_count: imported,
        skipped_count: skipped,
    })
}
