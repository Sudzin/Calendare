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

/// Генерация уникального случайного суффикса для временного файла
fn random_suffix() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let pid = std::process::id();
    let seed = now.as_nanos() ^ ((pid as u128) << 32) ^ (count as u128);
    format!("{:08x}", (seed & 0xFFFF_FFFF) as u32)
}

/// Атомарная запись файла: запись во временный файл в той же папке со случайным суффиксом, сброс буферов на диск и fs::rename
pub fn atomic_write_file(target_path: &Path, content: &str) -> std::io::Result<()> {
    let parent = target_path
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Parent directory not found"))?;

    let file_stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let tmp_filename = format!("{}.tmp.{}.{}", file_stem, current_timestamp_str(), random_suffix());
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

pub const WINDOWS_RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Проверка безопасности идентификатора задачи:
/// - длина от 1 до 128 символов
/// - только символы [A-Za-z0-9_-]
/// - запрещены системные служебные имена Windows (CON, PRN, AUX и т.д.)
pub fn is_safe_id(id: &str) -> bool {
    let len = id.len();
    if !(1..=128).contains(&len) {
        return false;
    }

    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return false;
    }

    let upper = id.to_ascii_uppercase();
    if WINDOWS_RESERVED.contains(&upper.as_str()) {
        return false;
    }

    true
}

/// Проверка валидности структуры задачи
pub fn is_valid_task(val: &Value) -> bool {
    if let Some(obj) = val.as_object() {
        let has_safe_id = obj.get("id").and_then(|v| v.as_str()).map(is_safe_id).unwrap_or(false);
        let has_title = obj.get("title").and_then(|v| v.as_str()).is_some();
        let has_date = obj.get("date").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_status = obj.get("status").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
        let has_priority = obj.get("priority").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);

        has_safe_id && has_title && has_date && has_status && has_priority
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
                // 1. Сначала проверяем признак удаления (deletedAt):
                // Файлы с tombstone НЕ считаются повреждёнными и просто не попадают в список активных задач.
                let is_deleted = val
                    .as_object()
                    .and_then(|o| o.get("deletedAt"))
                    .and_then(|v| v.as_str())
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false);

                if is_deleted {
                    continue;
                }

                // 2. Затем проверяем валидность активной задачи
                if is_valid_task(&val) {
                    tasks.push(val);
                } else {
                    // Невалидная структура активной задачи — переносим в corrupt/
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

    if !is_safe_id(id) {
        return Err(format!("Unsafe or invalid task id: {id}"));
    }

    let serialized = serde_json::to_string_pretty(&task)
        .map_err(|e| format!("Failed to serialize task: {e}"))?;

    let file_path = data_dir.join("tasks").join(format!("{}.json", id));

    atomic_write_file(&file_path, &serialized)
        .map_err(|e| format!("Failed to atomically write task {id}: {e}"))?;

    Ok(())
}

/// Пометка задачи как удаленной (Tombstone: deletedAt).
/// Если файл задачи не существует на диске — файл НЕ создается.
pub fn delete_single_task(data_dir: &Path, id: &str, deleted_at: &str) -> Result<(), String> {
    ensure_directories(data_dir)?;

    if !is_safe_id(id) {
        return Err(format!("Unsafe or invalid task id: {id}"));
    }

    let file_path = data_dir.join("tasks").join(format!("{}.json", id));

    // Если файла нет на диске, ничего не создаём
    if !file_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read existing task: {e}"))?;
    let mut task_obj = serde_json::from_str::<Value>(&content)
        .unwrap_or_else(|_| serde_json::json!({ "id": id }));

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
            Some(id) if is_safe_id(id) => id,
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    fn create_temp_data_dir() -> PathBuf {
        let n = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!("calendare_test_{}_{}", std::process::id(), n));
        let _ = fs::remove_dir_all(&dir);
        let _ = ensure_directories(&dir);
        dir
    }

    #[test]
    fn test_write_and_read_tasks() {
        let dir = create_temp_data_dir();
        let task = json!({
            "id": "task-1",
            "title": "Тестовая задача",
            "date": "2026-10-09",
            "status": "todo",
            "priority": "medium"
        });

        assert!(write_single_task(&dir, task).is_ok());

        let res = read_all_tasks(&dir).expect("read failed");
        assert_eq!(res.tasks.len(), 1);
        assert_eq!(res.tasks[0]["id"], "task-1");
        assert_eq!(res.tasks[0]["title"], "Тестовая задача");
        assert!(res.corrupted_files.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_atomic_write_no_tmp_leftover() {
        let dir = create_temp_data_dir();
        let target = dir.join("tasks").join("test_atomic.json");

        assert!(atomic_write_file(&target, "{\"hello\":\"world\"}").is_ok());
        assert!(target.exists());

        // Проверяем, что в папке tasks нет оставшихся .tmp файлов
        let entries = fs::read_dir(dir.join("tasks")).unwrap();
        for entry in entries {
            let name = entry.unwrap().file_name().to_string_lossy().to_string();
            assert!(!name.contains(".tmp."));
        }

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_corrupt_json_moved_to_corrupt() {
        let dir = create_temp_data_dir();
        let bad_file = dir.join("tasks").join("broken.json");
        fs::write(&bad_file, "{ broken json: ,").unwrap();

        let res = read_all_tasks(&dir).expect("read failed");
        assert_eq!(res.tasks.len(), 0);
        assert_eq!(res.corrupted_files.len(), 1);
        assert_eq!(res.corrupted_files[0].filename, "broken.json");
        assert!(!bad_file.exists());

        // Проверяем, что файл перемещен в corrupt/
        let corrupt_entries = fs::read_dir(dir.join("corrupt")).unwrap().count();
        assert_eq!(corrupt_entries, 1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_tombstone_hides_task_and_no_ghost_on_missing() {
        let dir = create_temp_data_dir();

        // 1. Удаление несуществующей задачи не создает файл
        assert!(delete_single_task(&dir, "missing-task", "2026-10-09T10:00:00Z").is_ok());
        assert!(!dir.join("tasks").join("missing-task.json").exists());

        // 2. Создаем задачу и затем удаляем через tombstone
        let task = json!({
            "id": "task-to-delete",
            "title": "Удаляемая задача",
            "date": "2026-10-09",
            "status": "todo",
            "priority": "low"
        });
        assert!(write_single_task(&dir, task).is_ok());

        assert!(delete_single_task(&dir, "task-to-delete", "2026-10-09T10:05:00Z").is_ok());

        let res = read_all_tasks(&dir).expect("read failed");
        assert_eq!(res.tasks.len(), 0);
        assert!(res.corrupted_files.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_import_is_idempotent() {
        let dir = create_temp_data_dir();

        let tasks = vec![
            json!({
                "id": "t1",
                "title": "T1",
                "date": "2026-10-09",
                "status": "todo",
                "priority": "high",
                "updatedAt": "2026-10-09T10:00:00Z"
            }),
            json!({
                "id": "t2",
                "title": "T2",
                "date": "2026-10-09",
                "status": "todo",
                "priority": "medium",
                "updatedAt": "2026-10-09T10:00:00Z"
            }),
        ];

        let summary1 = import_task_list(&dir, tasks.clone()).unwrap();
        assert_eq!(summary1.imported_count, 2);
        assert_eq!(summary1.skipped_count, 0);

        // Повторный импорт тех же задач не дублирует и пропускает
        let summary2 = import_task_list(&dir, tasks).unwrap();
        assert_eq!(summary2.imported_count, 0);
        assert_eq!(summary2.skipped_count, 2);

        let res = read_all_tasks(&dir).unwrap();
        assert_eq!(res.tasks.len(), 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_unsafe_id_rejected() {
        let dir = create_temp_data_dir();

        let unsafe_ids = vec!["../x", "a/b", "a\\b", "CON", "con", "", "   ", "AUX"];
        for bad_id in unsafe_ids {
            assert!(!is_safe_id(bad_id), "id should be unsafe: {bad_id}");

            let bad_task = json!({
                "id": bad_id,
                "title": "Bad ID",
                "date": "2026-10-09",
                "status": "todo",
                "priority": "low"
            });

            assert!(write_single_task(&dir, bad_task).is_err());
            assert!(delete_single_task(&dir, bad_id, "2026-10-09T10:00:00Z").is_err());
        }

        let _ = fs::remove_dir_all(&dir);
    }
}
