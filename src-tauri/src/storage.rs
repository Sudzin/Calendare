use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::crypto::{
    decrypt_aes_gcm, encrypt_aes_gcm, sha256_digest, MasterKey,
};
use crate::manifest::{IntegrityWarning, Manifest};
use crate::vault;

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
    #[serde(default)]
    pub integrity_warnings: Vec<IntegrityWarning>,
    pub data_dir: String,
    #[serde(default)]
    pub is_vault_locked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurgeSummary {
    pub purged_count: usize,
    pub kept_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportSummary {
    pub imported_count: usize,
    pub skipped_count: usize,
}

/// Получение текущей метки времени в формате строки для имен файлов
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

/// Атомарная запись текстового файла: запись во временный файл, сброс буферов на диск и fs::rename
pub fn atomic_write_file(target_path: &Path, content: &str) -> std::io::Result<()> {
    atomic_write_bytes(target_path, content.as_bytes())
}

/// Атомарная запись бинарных данных: запись во временный файл, сброс буферов на диск и fs::rename
pub fn atomic_write_bytes(target_path: &Path, content: &[u8]) -> std::io::Result<()> {
    let parent = target_path
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Parent directory not found"))?;

    let file_stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let tmp_filename = format!("{}.tmp.{}.{}", file_stem, current_timestamp_str(), random_suffix());
    let tmp_path = parent.join(tmp_filename);

    {
        let mut file = File::create(&tmp_path)?;
        file.write_all(content)?;
        file.flush()?;
        file.sync_all()?;
    }

    if let Err(err) = fs::rename(&tmp_path, target_path) {
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

/// Детерминированный выбор между двумя версиями одной задачи.
/// 1. Выигрывает более свежий updatedAt.
/// 2. При равенстве updatedAt — лексикографическое сравнение сериализованной строки JSON.
pub fn choose_winning_task(a: Value, b: Value) -> Value {
    let time_a = a.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
    let time_b = b.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");

    if time_a > time_b {
        a
    } else if time_b > time_a {
        b
    } else {
        let str_a = serde_json::to_string(&a).unwrap_or_default();
        let str_b = serde_json::to_string(&b).unwrap_or_default();
        if str_a >= str_b {
            a
        } else {
            b
        }
    }
}

/// Чтение всех задач с поддержкой зашифрованного хранилища, манифеста и целостности
pub fn read_all_tasks(data_dir: &Path, master_key: Option<&MasterKey>) -> Result<ReadTasksResult, String> {
    ensure_directories(data_dir)?;

    let is_vault = vault::is_vault_initialized(data_dir);
    if is_vault && master_key.is_none() {
        return Ok(ReadTasksResult {
            tasks: Vec::new(),
            corrupted_files: Vec::new(),
            integrity_warnings: Vec::new(),
            data_dir: data_dir.to_string_lossy().to_string(),
            is_vault_locked: true,
        });
    }

    let tasks_dir = data_dir.join("tasks");
    let corrupt_dir = data_dir.join("corrupt");

    let entries = fs::read_dir(&tasks_dir)
        .map_err(|e| format!("Failed to read tasks directory: {e}"))?;

    let mut merged_map: std::collections::BTreeMap<String, Value> = std::collections::BTreeMap::new();
    let mut corrupted_files = Vec::new();
    let mut integrity_warnings = Vec::new();

    // Загрузка манифеста при активном хранилище
    let manifest = if let Some(key) = master_key {
        match Manifest::load(data_dir, key) {
            Ok(m) => {
                // 1. Проверка пропавших файлов: файл есть в манифесте, но отсутствует на диске
                // Предупреждение «файл пропал», восстановление недоступно автоматически, ничего не затирать
                let missing = m.check_missing_files(&tasks_dir);
                integrity_warnings.extend(missing);
                Some(m)
            }
            Err(e) => {
                // Ошибка расшифровки манифеста
                corrupted_files.push(CorruptedFileInfo {
                    filename: "manifest.enc".to_string(),
                    reason: format!("Manifest decryption error: {e}"),
                    timestamp: current_timestamp_str(),
                    backup_path: data_dir.join("manifest.enc").to_string_lossy().to_string(),
                });
                None
            }
        }
    } else {
        None
    };

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

        if file_name.contains(".tmp.") {
            continue;
        }

        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");

        // 1. Обработка зашифрованных задач (.enc)
        if ext == "enc" {
            if let Some(key) = master_key {
                let file_bytes = match fs::read(&path) {
                    Ok(b) => b,
                    Err(e) => {
                        let timestamp = current_timestamp_str();
                        let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                        let corrupt_path = corrupt_dir.join(&corrupt_filename);
                        let _ = fs::rename(&path, &corrupt_path);

                        corrupted_files.push(CorruptedFileInfo {
                            filename: file_name,
                            reason: format!("Read error: {e}"),
                            timestamp,
                            backup_path: corrupt_path.to_string_lossy().to_string(),
                        });
                        continue;
                    }
                };

                let file_sha256 = sha256_digest(&file_bytes);

                if file_bytes.len() < 12 + 16 {
                    let timestamp = current_timestamp_str();
                    let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                    let corrupt_path = corrupt_dir.join(&corrupt_filename);
                    let _ = fs::rename(&path, &corrupt_path);

                    corrupted_files.push(CorruptedFileInfo {
                        filename: file_name,
                        reason: "Encrypted file too short".to_string(),
                        timestamp,
                        backup_path: corrupt_path.to_string_lossy().to_string(),
                    });
                    continue;
                }

                let mut nonce = [0u8; 12];
                nonce.copy_from_slice(&file_bytes[0..12]);
                let ciphertext = &file_bytes[12..];

                // Расшифровка через AES-256-GCM
                let decrypted = decrypt_aes_gcm(key.as_bytes(), &nonce, ciphertext);
                match decrypted {
                    Ok(plain_bytes) => {
                        let parsed: Result<Value, _> = serde_json::from_slice(&plain_bytes);
                        match parsed {
                            Ok(val) => {
                                if let Some(id) = val.get("id").and_then(|v| v.as_str()) {
                                    if is_safe_id(id) {
                                        // Проверка соответствия манифесту:
                                        // Если хеш файла не совпадает с манифестом, а GCM проходит →
                                        // предупреждение «откат или подмена версии»
                                        if let Some(m) = &manifest {
                                            if let Some(entry) = m.find_entry(id) {
                                                if entry.sha256 != file_sha256 {
                                                    integrity_warnings.push(IntegrityWarning {
                                                        task_id: id.to_string(),
                                                        kind: "version_mismatch".to_string(),
                                                        message: format!("Откат или подмена версии для задачи {id}"),
                                                        filename: file_name.clone(),
                                                    });
                                                }
                                            }
                                        }

                                        let id_str = id.to_string();
                                        if let Some(existing) = merged_map.remove(&id_str) {
                                            let winner = choose_winning_task(existing, val);
                                            merged_map.insert(id_str, winner);
                                        } else {
                                            merged_map.insert(id_str, val);
                                        }
                                        continue;
                                    }
                                }

                                // Невалидный ID
                                let timestamp = current_timestamp_str();
                                let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                                let corrupt_path = corrupt_dir.join(&corrupt_filename);
                                let _ = fs::rename(&path, &corrupt_path);

                                corrupted_files.push(CorruptedFileInfo {
                                    filename: file_name,
                                    reason: "Decrypted task has invalid or unsafe ID".to_string(),
                                    timestamp,
                                    backup_path: corrupt_path.to_string_lossy().to_string(),
                                });
                            }
                            Err(e) => {
                                let timestamp = current_timestamp_str();
                                let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                                let corrupt_path = corrupt_dir.join(&corrupt_filename);
                                let _ = fs::rename(&path, &corrupt_path);

                                corrupted_files.push(CorruptedFileInfo {
                                    filename: file_name,
                                    reason: format!("Decrypted JSON parse error: {e}"),
                                    timestamp,
                                    backup_path: corrupt_path.to_string_lossy().to_string(),
                                });
                            }
                        }
                    }
                    Err(gcm_err) => {
                        // Требование ТЗ: GCM не проходит → файл переносится в corrupt/, пользователь уведомляется
                        let timestamp = current_timestamp_str();
                        let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                        let corrupt_path = corrupt_dir.join(&corrupt_filename);
                        let _ = fs::rename(&path, &corrupt_path);

                        corrupted_files.push(CorruptedFileInfo {
                            filename: file_name,
                            reason: format!("GCM auth/decryption failed: {gcm_err}"),
                            timestamp,
                            backup_path: corrupt_path.to_string_lossy().to_string(),
                        });
                    }
                }
            }
            continue;
        }

        // 2. Обработка обычных файлов .json (незашифрованный режим / обратная совместимость)
        if ext == "json" {
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(e) => {
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

            let parsed_val: Result<Value, _> = serde_json::from_str(&content);
            match parsed_val {
                Ok(val) => {
                    let maybe_id = val.get("id").and_then(|v| v.as_str());
                    if let Some(id) = maybe_id {
                        if is_safe_id(id) {
                            let id_str = id.to_string();
                            if let Some(existing) = merged_map.remove(&id_str) {
                                let winner = choose_winning_task(existing, val);
                                merged_map.insert(id_str, winner);
                            } else {
                                merged_map.insert(id_str, val);
                            }
                            continue;
                        }
                    }

                    let timestamp = current_timestamp_str();
                    let corrupt_filename = format!("{}.{}.corrupt", file_name, timestamp);
                    let corrupt_path = corrupt_dir.join(&corrupt_filename);
                    let _ = fs::rename(&path, &corrupt_path);

                    corrupted_files.push(CorruptedFileInfo {
                        filename: file_name,
                        reason: "Missing or unsafe Task id".to_string(),
                        timestamp,
                        backup_path: corrupt_path.to_string_lossy().to_string(),
                    });
                }
                Err(parse_err) => {
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
    }

    let mut tasks = Vec::new();

    for (_id, val) in merged_map {
        let is_deleted = val
            .as_object()
            .and_then(|o| o.get("deletedAt"))
            .and_then(|v| v.as_str())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

        if is_deleted {
            continue;
        }

        if is_valid_task(&val) {
            tasks.push(val);
        }
    }

    Ok(ReadTasksResult {
        tasks,
        corrupted_files,
        integrity_warnings,
        data_dir: data_dir.to_string_lossy().to_string(),
        is_vault_locked: false,
    })
}

/// Запись одной задачи (зашифрованная с уникальным nonce или обычная)
pub fn write_single_task(
    data_dir: &Path,
    task: Value,
    master_key: Option<&MasterKey>,
) -> Result<(), String> {
    ensure_directories(data_dir)?;

    let id = task
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Task id is required".to_string())?;

    if !is_safe_id(id) {
        return Err(format!("Unsafe or invalid task id: {id}"));
    }

    let updated_at = task
        .get("updatedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let deleted_at = task
        .get("deletedAt")
        .and_then(|v| v.as_str());

    let is_vault = vault::is_vault_initialized(data_dir);

    if is_vault {
        let key = master_key.ok_or_else(|| "Хранилище заблокировано".to_string())?;

        // Каждая задача шифруется отдельно с УНИКАЛЬНЫМ nonce на каждую запись
        let serialized = serde_json::to_vec(&task)
            .map_err(|e| format!("Failed to serialize task: {e}"))?;

        let (ciphertext, nonce) = encrypt_aes_gcm(key.as_bytes(), &serialized)?;

        let mut payload = Vec::with_capacity(12 + ciphertext.len());
        payload.extend_from_slice(&nonce);
        payload.extend_from_slice(&ciphertext);

        let file_sha256 = sha256_digest(&payload);
        let file_path = data_dir.join("tasks").join(format!("{}.enc", id));

        atomic_write_bytes(&file_path, &payload)
            .map_err(|e| format!("Failed to atomically write encrypted task {id}: {e}"))?;

        // Обновление зашифрованного манифеста
        let mut manifest = Manifest::load(data_dir, key).unwrap_or_default();
        manifest.upsert_entry(id, updated_at, deleted_at, &file_sha256);
        manifest.save(data_dir, key)?;
    } else {
        let serialized = serde_json::to_string_pretty(&task)
            .map_err(|e| format!("Failed to serialize task: {e}"))?;

        let file_path = data_dir.join("tasks").join(format!("{}.json", id));

        atomic_write_file(&file_path, &serialized)
            .map_err(|e| format!("Failed to atomically write task {id}: {e}"))?;
    }

    Ok(())
}

/// Пометка задачи как удаленной (tombstone)
pub fn delete_single_task(
    data_dir: &Path,
    id: &str,
    deleted_at: &str,
    master_key: Option<&MasterKey>,
) -> Result<(), String> {
    ensure_directories(data_dir)?;

    if !is_safe_id(id) {
        return Err(format!("Unsafe or invalid task id: {id}"));
    }

    let is_vault = vault::is_vault_initialized(data_dir);

    if is_vault {
        let key = master_key.ok_or_else(|| "Хранилище заблокировано".to_string())?;
        let file_path = data_dir.join("tasks").join(format!("{}.enc", id));

        if !file_path.exists() {
            return Ok(());
        }

        let raw_bytes = fs::read(&file_path)
            .map_err(|e| format!("Failed to read encrypted task: {e}"))?;

        if raw_bytes.len() < 12 + 16 {
            return Err("Encrypted file too short for tombstone".to_string());
        }

        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&raw_bytes[0..12]);
        let ciphertext = &raw_bytes[12..];

        let decrypted = decrypt_aes_gcm(key.as_bytes(), &nonce, ciphertext)
            .map_err(|e| format!("Failed to decrypt task for deletion: {e}"))?;

        let mut task_obj = serde_json::from_slice::<Value>(&decrypted)
            .unwrap_or_else(|_| serde_json::json!({ "id": id }));

        if let Some(obj) = task_obj.as_object_mut() {
            obj.insert("deletedAt".to_string(), Value::String(deleted_at.to_string()));
            obj.insert("updatedAt".to_string(), Value::String(deleted_at.to_string()));
        }

        let serialized = serde_json::to_vec(&task_obj)
            .map_err(|e| format!("Failed to serialize deleted task: {e}"))?;

        let (new_ciphertext, new_nonce) = encrypt_aes_gcm(key.as_bytes(), &serialized)?;
        let mut payload = Vec::with_capacity(12 + new_ciphertext.len());
        payload.extend_from_slice(&new_nonce);
        payload.extend_from_slice(&new_ciphertext);

        let file_sha256 = sha256_digest(&payload);
        atomic_write_bytes(&file_path, &payload)
            .map_err(|e| format!("Failed to atomically write encrypted tombstone {id}: {e}"))?;

        let mut manifest = Manifest::load(data_dir, key).unwrap_or_default();
        manifest.upsert_entry(id, deleted_at, Some(deleted_at), &file_sha256);
        manifest.save(data_dir, key)?;
    } else {
        let file_path = data_dir.join("tasks").join(format!("{}.json", id));

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
    }

    Ok(())
}

/// Пакетный импорт задач
pub fn import_task_list(
    data_dir: &Path,
    tasks: Vec<Value>,
    master_key: Option<&MasterKey>,
) -> Result<ImportSummary, String> {
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

        if write_single_task(data_dir, task, master_key).is_ok() {
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

/// Физическая очистка файлов-надгробий старше older_than_days
pub fn purge_old_tombstones(
    data_dir: &Path,
    older_than_days: u64,
    master_key: Option<&MasterKey>,
) -> Result<PurgeSummary, String> {
    ensure_directories(data_dir)?;
    let tasks_dir = data_dir.join("tasks");
    let entries = fs::read_dir(&tasks_dir)
        .map_err(|e| format!("Failed to read tasks directory: {e}"))?;

    let now = SystemTime::now();
    let max_age_duration = std::time::Duration::from_secs(older_than_days * 86400);

    let mut purged_count = 0;
    let mut kept_count = 0;
    let mut purged_ids = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

        let mut is_deleted = false;

        if ext == "enc" {
            if let Some(key) = master_key {
                if let Ok(raw_bytes) = fs::read(&path) {
                    if raw_bytes.len() >= 12 + 16 {
                        let mut nonce = [0u8; 12];
                        nonce.copy_from_slice(&raw_bytes[0..12]);
                        let ciphertext = &raw_bytes[12..];
                        if let Ok(plain) = decrypt_aes_gcm(key.as_bytes(), &nonce, ciphertext) {
                            if let Ok(val) = serde_json::from_slice::<Value>(&plain) {
                                is_deleted = val
                                    .as_object()
                                    .and_then(|o| o.get("deletedAt"))
                                    .and_then(|v| v.as_str())
                                    .map(|s| !s.trim().is_empty())
                                    .unwrap_or(false);
                            }
                        }
                    }
                }
            }
        } else if ext == "json" {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<Value>(&content) {
                    is_deleted = val
                        .as_object()
                        .and_then(|o| o.get("deletedAt"))
                        .and_then(|v| v.as_str())
                        .map(|s| !s.trim().is_empty())
                        .unwrap_or(false);
                }
            }
        }

        if is_deleted {
            let is_old = if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    now.duration_since(modified).unwrap_or_default() >= max_age_duration
                } else {
                    false
                }
            } else {
                false
            };

            if is_old {
                if fs::remove_file(&path).is_ok() {
                    purged_count += 1;
                    purged_ids.push(file_stem.to_string());
                } else {
                    kept_count += 1;
                }
            } else {
                kept_count += 1;
            }
        }
    }

    // Если хранилище зашифровано, удаляем очищенные надгробия из манифеста
    if let Some(key) = master_key {
        if let Ok(mut manifest) = Manifest::load(data_dir, key) {
            manifest.entries.retain(|e| !purged_ids.contains(&e.id));
            let _ = manifest.save(data_dir, key);
        }
    }

    Ok(PurgeSummary {
        purged_count,
        kept_count,
    })
}

/// Миграция существующих незашифрованных задач (.json) в зашифрованные (.enc) при создании vault
pub fn migrate_existing_tasks_to_vault(
    data_dir: &Path,
    master_key: &MasterKey,
) -> Result<(), String> {
    let tasks_dir = data_dir.join("tasks");
    if !tasks_dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(&tasks_dir)
        .map_err(|e| format!("Failed to read tasks dir: {e}"))?;

    let mut manifest = Manifest::default();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<Value>(&content) {
                    if let Some(id) = val.get("id").and_then(|v| v.as_str()) {
                        if is_safe_id(id) {
                            let updated_at = val.get("updatedAt").and_then(|v| v.as_str()).unwrap_or("");
                            let deleted_at = val.get("deletedAt").and_then(|v| v.as_str());

                            let serialized = serde_json::to_vec(&val)
                                .map_err(|e| format!("Serialization error: {e}"))?;

                            let (ciphertext, nonce) = encrypt_aes_gcm(master_key.as_bytes(), &serialized)?;
                            let mut payload = Vec::with_capacity(12 + ciphertext.len());
                            payload.extend_from_slice(&nonce);
                            payload.extend_from_slice(&ciphertext);

                            let enc_sha256 = sha256_digest(&payload);
                            let enc_path = tasks_dir.join(format!("{}.enc", id));

                            atomic_write_bytes(&enc_path, &payload)
                                .map_err(|e| format!("Failed to write {id}.enc: {e}"))?;

                            manifest.upsert_entry(id, updated_at, deleted_at, &enc_sha256);

                            // Удаляем исходный незашифрованный JSON
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
            }
        }
    }

    manifest.save(data_dir, master_key)?;
    Ok(())
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
    fn test_unencrypted_write_and_read() {
        let dir = create_temp_data_dir();
        let task = json!({
            "id": "task-1",
            "title": "Тестовая задача",
            "date": "2026-10-09",
            "status": "todo",
            "priority": "medium"
        });

        assert!(write_single_task(&dir, task, None).is_ok());

        let res = read_all_tasks(&dir, None).expect("read failed");
        assert_eq!(res.tasks.len(), 1);
        assert_eq!(res.tasks[0]["id"], "task-1");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_vault_create_encrypt_and_read() {
        let dir = create_temp_data_dir();
        let (master_key, recovery_key) = vault::create_vault(&dir, "SecurePassword123!", false)
            .expect("create vault failed");

        assert!(recovery_key.len() > 16);
        assert!(vault::is_vault_initialized(&dir));

        let task = json!({
            "id": "task-secret-1",
            "title": "Секретная задача",
            "date": "2026-10-09",
            "status": "todo",
            "priority": "high",
            "updatedAt": "2026-10-09T10:00:00Z"
        });

        assert!(write_single_task(&dir, task, Some(&master_key)).is_ok());

        // Файл на диске зашифрован (.enc)
        let enc_path = dir.join("tasks").join("task-secret-1.enc");
        assert!(enc_path.exists());

        // Чтение в заблокированном состоянии не выдает задачи
        let locked_res = read_all_tasks(&dir, None).unwrap();
        assert!(locked_res.is_vault_locked);
        assert!(locked_res.tasks.is_empty());

        // Чтение с ключом расшифровывает
        let unlocked_res = read_all_tasks(&dir, Some(&master_key)).unwrap();
        assert_eq!(unlocked_res.tasks.len(), 1);
        assert_eq!(unlocked_res.tasks[0]["id"], "task-secret-1");
        assert_eq!(unlocked_res.tasks[0]["title"], "Секретная задача");
        assert!(unlocked_res.integrity_warnings.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_vault_unlock_with_recovery_key() {
        let dir = create_temp_data_dir();
        let (_key, recovery_key) = vault::create_vault(&dir, "Password123!", false).unwrap();

        let unlocked_key = vault::unlock_vault_with_recovery_key(&dir, &recovery_key).unwrap();
        assert_eq!(unlocked_key.as_bytes().len(), 32);

        // Неверный ключ дает ошибку
        assert!(vault::unlock_vault_with_recovery_key(&dir, "WRONG-KEY").is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_manifest_detects_missing_file() {
        let dir = create_temp_data_dir();
        let (master_key, _) = vault::create_vault(&dir, "Password123!", false).unwrap();

        let task = json!({
            "id": "task-to-disappear",
            "title": "Пропадающая задача",
            "date": "2026-10-09",
            "status": "todo",
            "priority": "medium",
            "updatedAt": "2026-10-09T10:00:00Z"
        });
        write_single_task(&dir, task, Some(&master_key)).unwrap();

        // Физически удаляем файл с диска
        let enc_path = dir.join("tasks").join("task-to-disappear.enc");
        fs::remove_file(enc_path).unwrap();

        // Проверяем: файл есть в манифесте, но отсутствует на диске -> предупреждение «файл пропал»
        let res = read_all_tasks(&dir, Some(&master_key)).unwrap();
        assert_eq!(res.integrity_warnings.len(), 1);
        assert_eq!(res.integrity_warnings[0].kind, "missing_file");
        assert!(res.integrity_warnings[0].message.contains("пропал"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_manifest_detects_version_rollback() {
        let dir = create_temp_data_dir();
        let (master_key, _) = vault::create_vault(&dir, "Password123!", false).unwrap();

        let task_v1 = json!({
            "id": "task-versioned",
            "title": "Версия 1",
            "date": "2026-10-09",
            "status": "todo",
            "priority": "low",
            "updatedAt": "2026-10-09T08:00:00Z"
        });
        write_single_task(&dir, task_v1, Some(&master_key)).unwrap();

        // Сохраняем копию v1
        let enc_path = dir.join("tasks").join("task-versioned.enc");
        let v1_bytes = fs::read(&enc_path).unwrap();

        // Записываем v2 (манифест обновится с новым sha256)
        let task_v2 = json!({
            "id": "task-versioned",
            "title": "Версия 2",
            "date": "2026-10-09",
            "status": "done",
            "priority": "high",
            "updatedAt": "2026-10-09T12:00:00Z"
        });
        write_single_task(&dir, task_v2, Some(&master_key)).unwrap();

        // Откатываем файл на диске до v1_bytes без обновления манифеста
        fs::write(&enc_path, &v1_bytes).unwrap();

        // Хеш файла не совпадает с манифестом, а GCM проходит → предупреждение «откат или подмена версии»
        let res = read_all_tasks(&dir, Some(&master_key)).unwrap();
        assert_eq!(res.integrity_warnings.len(), 1);
        assert_eq!(res.integrity_warnings[0].kind, "version_mismatch");
        assert!(res.integrity_warnings[0].message.contains("Откат или подмена версии"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_corrupt_encrypted_file_moved_to_corrupt_folder() {
        let dir = create_temp_data_dir();
        let (master_key, _) = vault::create_vault(&dir, "Password123!", false).unwrap();

        // Создаем битый .enc файл (случайные байты, GCM упадет)
        let bad_path = dir.join("tasks").join("bad-task.enc");
        fs::write(&bad_path, &[0u8; 40]).unwrap();

        let res = read_all_tasks(&dir, Some(&master_key)).unwrap();
        assert_eq!(res.corrupted_files.len(), 1);
        assert_eq!(res.corrupted_files[0].filename, "bad-task.enc");
        assert!(!bad_path.exists());

        // Проверяем, что файл перемещен в corrupt/
        let corrupt_entries = fs::read_dir(dir.join("corrupt")).unwrap().count();
        assert_eq!(corrupt_entries, 1);

        let _ = fs::remove_dir_all(&dir);
    }
}
