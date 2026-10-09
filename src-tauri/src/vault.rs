use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};

use crate::crypto::{
    decrypt_aes_gcm, derive_argon2_key, encrypt_aes_gcm, from_hex, generate_recovery_key,
    generate_salt, normalize_recovery_key, sha256_digest, to_hex, MasterKey,
    DEFAULT_ARGON2_M_COST, DEFAULT_ARGON2_P_COST, DEFAULT_ARGON2_T_COST,
    KEY_CHECK_PLAINTEXT,
};
use crate::credential_manager;
use crate::storage::atomic_write_file;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Argon2Config {
    #[serde(rename = "mCost")]
    pub m_cost: u32,
    #[serde(rename = "tCost")]
    pub t_cost: u32,
    #[serde(rename = "pCost")]
    pub p_cost: u32,
    #[serde(rename = "saltHex")]
    pub salt_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyWrapper {
    #[serde(rename = "nonceHex")]
    pub nonce_hex: String,
    #[serde(rename = "ciphertextHex")]
    pub ciphertext_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryWrapper {
    #[serde(rename = "saltHex")]
    pub salt_hex: String,
    #[serde(rename = "nonceHex")]
    pub nonce_hex: String,
    #[serde(rename = "ciphertextHex")]
    pub ciphertext_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyCheckConfig {
    #[serde(rename = "nonceHex")]
    pub nonce_hex: String,
    #[serde(rename = "ciphertextHex")]
    pub ciphertext_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub version: u32,
    pub argon2: Argon2Config,
    #[serde(rename = "masterKeyWrapper")]
    pub master_key_wrapper: KeyWrapper,
    #[serde(rename = "recoveryWrapper")]
    pub recovery_wrapper: RecoveryWrapper,
    #[serde(rename = "keyCheck")]
    pub key_check: KeyCheckConfig,
    #[serde(rename = "cacheInCredentialManager")]
    pub cache_in_credential_manager: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

fn vault_config_path(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("vault.json")
}

pub fn cred_target_name(data_dir: &Path) -> String {
    let hash = sha256_digest(data_dir.to_string_lossy().as_bytes());
    format!("ChronosTask_Vault_{}", &hash[0..16])
}

pub fn is_vault_initialized(data_dir: &Path) -> bool {
    vault_config_path(data_dir).exists()
}

pub fn load_vault_config(data_dir: &Path) -> Result<VaultConfig, String> {
    let path = vault_config_path(data_dir);
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read vault.json: {e}"))?;
    serde_json::from_str::<VaultConfig>(&content)
        .map_err(|e| format!("Failed to parse vault.json: {e}"))
}

pub fn verify_key_check(config: &VaultConfig, master_key: &MasterKey) -> bool {
    let nonce = match from_hex(&config.key_check.nonce_hex) {
        Ok(n) if n.len() == 12 => {
            let mut arr = [0u8; 12];
            arr.copy_from_slice(&n);
            arr
        }
        _ => return false,
    };

    let ciphertext = match from_hex(&config.key_check.ciphertext_hex) {
        Ok(c) => c,
        _ => return false,
    };

    match decrypt_aes_gcm(master_key.as_bytes(), &nonce, &ciphertext) {
        Ok(pt) => pt == KEY_CHECK_PLAINTEXT,
        Err(_) => false,
    }
}

/// Создание нового зашифрованного хранилища:
/// - пользователь задает пароль
/// - генерируется vault.json с солью и параметрами Argon2id
/// - создается keyCheck
/// - генерируется ключ восстановления достаточной энтропии (вторая обёртка главного ключа)
/// - по умолчанию производный ключ кэшируется в Windows Credential Manager
pub fn create_vault(
    data_dir: &Path,
    password: &str,
    cache_in_cred_mgr: bool,
) -> Result<(MasterKey, String), String> {
    if is_vault_initialized(data_dir) {
        return Err("Зашифрованное хранилище уже существует".to_string());
    }

    if password.trim().is_empty() {
        return Err("Пароль не может быть пустым".to_string());
    }

    let master_key = MasterKey::generate();

    // 1. Парольная обёртка через Argon2id
    let salt = generate_salt(16);
    let pwd_kek = derive_argon2_key(
        password,
        &salt,
        DEFAULT_ARGON2_M_COST,
        DEFAULT_ARGON2_T_COST,
        DEFAULT_ARGON2_P_COST,
    )?;

    let (master_ciphertext, master_nonce) = encrypt_aes_gcm(&pwd_kek, master_key.as_bytes())?;

    // 2. Ключ восстановления и его обёртка
    let recovery_key = generate_recovery_key();
    let norm_rec = normalize_recovery_key(&recovery_key);
    let rec_salt = generate_salt(16);
    let rec_kek = derive_argon2_key(
        &norm_rec,
        &rec_salt,
        DEFAULT_ARGON2_M_COST,
        DEFAULT_ARGON2_T_COST,
        DEFAULT_ARGON2_P_COST,
    )?;

    let (rec_ciphertext, rec_nonce) = encrypt_aes_gcm(&rec_kek, master_key.as_bytes())?;

    // 3. KeyCheck для быстрой и надежной верификации корректности ключа
    let (kc_ciphertext, kc_nonce) = encrypt_aes_gcm(master_key.as_bytes(), KEY_CHECK_PLAINTEXT)?;

    let now_str = crate::storage::current_timestamp_str();
    let config = VaultConfig {
        version: 1,
        argon2: Argon2Config {
            m_cost: DEFAULT_ARGON2_M_COST,
            t_cost: DEFAULT_ARGON2_T_COST,
            p_cost: DEFAULT_ARGON2_P_COST,
            salt_hex: to_hex(&salt),
        },
        master_key_wrapper: KeyWrapper {
            nonce_hex: to_hex(&master_nonce),
            ciphertext_hex: to_hex(&master_ciphertext),
        },
        recovery_wrapper: RecoveryWrapper {
            salt_hex: to_hex(&rec_salt),
            nonce_hex: to_hex(&rec_nonce),
            ciphertext_hex: to_hex(&rec_ciphertext),
        },
        key_check: KeyCheckConfig {
            nonce_hex: to_hex(&kc_nonce),
            ciphertext_hex: to_hex(&kc_ciphertext),
        },
        cache_in_credential_manager: cache_in_cred_mgr,
        created_at: now_str,
    };

    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize vault.json: {e}"))?;

    let path = vault_config_path(data_dir);
    atomic_write_file(&path, &serialized)
        .map_err(|e| format!("Failed to atomically write vault.json: {e}"))?;

    // Кэширование в Windows Credential Manager
    if cache_in_cred_mgr {
        let target = cred_target_name(data_dir);
        let _ = credential_manager::save_credential(&target, master_key.as_bytes());
    }

    Ok((master_key, recovery_key))
}

/// Разблокировка хранилища по паролю
pub fn unlock_vault_with_password(data_dir: &Path, password: &str) -> Result<MasterKey, String> {
    let config = load_vault_config(data_dir)?;

    let salt = from_hex(&config.argon2.salt_hex)?;
    let pwd_kek = derive_argon2_key(
        password,
        &salt,
        config.argon2.m_cost,
        config.argon2.t_cost,
        config.argon2.p_cost,
    )?;

    let nonce_bytes = from_hex(&config.master_key_wrapper.nonce_hex)?;
    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length in vault.json".to_string());
    }
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&nonce_bytes);

    let ciphertext = from_hex(&config.master_key_wrapper.ciphertext_hex)?;

    let decrypted = decrypt_aes_gcm(&pwd_kek, &nonce, &ciphertext)
        .map_err(|_| "Неверный пароль".to_string())?;

    if decrypted.len() != 32 {
        return Err("Invalid decrypted master key length".to_string());
    }

    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&decrypted);
    let master_key = MasterKey::new(key_bytes);

    if !verify_key_check(&config, &master_key) {
        return Err("Неверный пароль (keyCheck failed)".to_string());
    }

    if config.cache_in_credential_manager {
        let target = cred_target_name(data_dir);
        let _ = credential_manager::save_credential(&target, master_key.as_bytes());
    }

    Ok(master_key)
}

/// Разблокировка хранилища по ключу восстановления
pub fn unlock_vault_with_recovery_key(data_dir: &Path, recovery_key: &str) -> Result<MasterKey, String> {
    let config = load_vault_config(data_dir)?;
    let norm_rec = normalize_recovery_key(recovery_key);

    let salt = from_hex(&config.recovery_wrapper.salt_hex)?;
    let rec_kek = derive_argon2_key(
        &norm_rec,
        &salt,
        config.argon2.m_cost,
        config.argon2.t_cost,
        config.argon2.p_cost,
    )?;

    let nonce_bytes = from_hex(&config.recovery_wrapper.nonce_hex)?;
    if nonce_bytes.len() != 12 {
        return Err("Invalid recovery nonce length in vault.json".to_string());
    }
    let mut nonce = [0u8; 12];
    nonce.copy_from_slice(&nonce_bytes);

    let ciphertext = from_hex(&config.recovery_wrapper.ciphertext_hex)?;

    let decrypted = decrypt_aes_gcm(&rec_kek, &nonce, &ciphertext)
        .map_err(|_| "Неверный ключ восстановления".to_string())?;

    if decrypted.len() != 32 {
        return Err("Invalid decrypted master key length".to_string());
    }

    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&decrypted);
    let master_key = MasterKey::new(key_bytes);

    if !verify_key_check(&config, &master_key) {
        return Err("Неверный ключ восстановления (keyCheck failed)".to_string());
    }

    if config.cache_in_credential_manager {
        let target = cred_target_name(data_dir);
        let _ = credential_manager::save_credential(&target, master_key.as_bytes());
    }

    Ok(master_key)
}

/// Попытка автоматической разблокировки через Windows Credential Manager
pub fn try_auto_unlock_from_credential_manager(data_dir: &Path) -> Result<Option<MasterKey>, String> {
    if !is_vault_initialized(data_dir) {
        return Ok(None);
    }

    let config = load_vault_config(data_dir)?;
    if !config.cache_in_credential_manager {
        return Ok(None);
    }

    let target = cred_target_name(data_dir);
    if let Ok(Some(secret)) = credential_manager::read_credential(&target) {
        if secret.len() == 32 {
            let mut key_bytes = [0u8; 32];
            key_bytes.copy_from_slice(&secret);
            let master_key = MasterKey::new(key_bytes);

            if verify_key_check(&config, &master_key) {
                return Ok(Some(master_key));
            }
        }
    }

    Ok(None)
}

/// Переключение настройки кэширования в Windows Credential Manager
pub fn update_credential_caching(
    data_dir: &Path,
    enabled: bool,
    master_key: Option<&MasterKey>,
) -> Result<(), String> {
    let mut config = load_vault_config(data_dir)?;
    config.cache_in_credential_manager = enabled;

    let serialized = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize vault.json: {e}"))?;

    let path = vault_config_path(data_dir);
    atomic_write_file(&path, &serialized)
        .map_err(|e| format!("Failed to write vault.json: {e}"))?;

    let target = cred_target_name(data_dir);
    if enabled {
        if let Some(key) = master_key {
            let _ = credential_manager::save_credential(&target, key.as_bytes());
        }
    } else {
        let _ = credential_manager::delete_credential(&target);
    }

    Ok(())
}
