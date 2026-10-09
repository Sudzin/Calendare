use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

use crate::crypto::{
    decrypt_aes_gcm, encrypt_aes_gcm, sha256_digest, MasterKey,
};
use crate::storage::atomic_write_bytes;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub id: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u32,
    pub entries: Vec<ManifestEntry>,
}

impl Default for Manifest {
    fn default() -> Self {
        Self {
            version: 1,
            entries: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrityWarning {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub kind: String, // "missing_file" | "version_mismatch"
    pub message: String,
    pub filename: String,
}

impl Manifest {
    /// Загрузка и расшифровка манифеста из <data_dir>/manifest.enc
    pub fn load(data_dir: &Path, master_key: &MasterKey) -> Result<Self, String> {
        let manifest_path = data_dir.join("manifest.enc");
        if !manifest_path.exists() {
            return Ok(Manifest::default());
        }

        let raw_bytes = fs::read(&manifest_path)
            .map_err(|e| format!("Failed to read manifest.enc: {e}"))?;

        if raw_bytes.len() < 12 + 16 {
            return Err("Corrupted manifest.enc: file is too short".to_string());
        }

        let mut nonce = [0u8; 12];
        nonce.copy_from_slice(&raw_bytes[0..12]);
        let ciphertext = &raw_bytes[12..];

        let decrypted_bytes = decrypt_aes_gcm(master_key.as_bytes(), &nonce, ciphertext)
            .map_err(|e| format!("Failed to decrypt manifest: {e}"))?;

        let manifest: Manifest = serde_json::from_slice(&decrypted_bytes)
            .map_err(|e| format!("Failed to parse manifest JSON: {e}"))?;

        Ok(manifest)
    }

    /// Шифрование и атомарное сохранение манифеста в <data_dir>/manifest.enc
    pub fn save(&self, data_dir: &Path, master_key: &MasterKey) -> Result<(), String> {
        let serialized = serde_json::to_vec(self)
            .map_err(|e| format!("Failed to serialize manifest: {e}"))?;

        let (ciphertext, nonce) = encrypt_aes_gcm(master_key.as_bytes(), &serialized)?;

        let mut payload = Vec::with_capacity(12 + ciphertext.len());
        payload.extend_from_slice(&nonce);
        payload.extend_from_slice(&ciphertext);

        let manifest_path = data_dir.join("manifest.enc");
        atomic_write_bytes(&manifest_path, &payload)
            .map_err(|e| format!("Failed to atomically write manifest.enc: {e}"))?;

        Ok(())
    }

    /// Добавление или обновление записи задачи в манифесте
    pub fn upsert_entry(
        &mut self,
        id: &str,
        updated_at: &str,
        deleted_at: Option<&str>,
        sha256: &str,
    ) {
        if let Some(existing) = self.entries.iter_mut().find(|e| e.id == id) {
            existing.updated_at = updated_at.to_string();
            existing.deleted_at = deleted_at.map(|s| s.to_string());
            existing.sha256 = sha256.to_string();
        } else {
            self.entries.push(ManifestEntry {
                id: id.to_string(),
                updated_at: updated_at.to_string(),
                deleted_at: deleted_at.map(|s| s.to_string()),
                sha256: sha256.to_string(),
            });
        }
    }

    /// Поиск записи по ID задачи
    pub fn find_entry(&self, id: &str) -> Option<&ManifestEntry> {
        self.entries.iter().find(|e| e.id == id)
    }

    /// Проверка отсутствующих на диске файлов (файл есть в манифесте, но отсутствует на диске)
    /// Реакция по ТЗ: предупреждение «файл пропал», восстановление недоступно автоматически, ничего не затирать.
    pub fn check_missing_files(&self, tasks_dir: &Path) -> Vec<IntegrityWarning> {
        let mut warnings = Vec::new();

        for entry in &self.entries {
            let enc_path = tasks_dir.join(format!("{}.enc", entry.id));
            if !enc_path.exists() {
                warnings.push(IntegrityWarning {
                    task_id: entry.id.clone(),
                    kind: "missing_file".to_string(),
                    message: format!("Файл задачи {} пропал", entry.id),
                    filename: format!("{}.enc", entry.id),
                });
            }
        }

        warnings
    }
}
