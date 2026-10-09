use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const DEFAULT_ARGON2_M_COST: u32 = 65536; // 64 MB
pub const DEFAULT_ARGON2_T_COST: u32 = 3;     // 3 iterations
pub const DEFAULT_ARGON2_P_COST: u32 = 1;     // 1 parallelism
pub const KEY_CHECK_PLAINTEXT: &[u8] = b"CHRONOS_VAULT_KEY_VALID_V1";

/// Безопасная обёртка над главным 256-битным ключом с автоматическим затиранием памяти (zeroize)
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct MasterKey(pub [u8; 32]);

impl MasterKey {
    pub fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut bytes);
        Self(bytes)
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

/// Вывод hex-строки из байтов
pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Декодирование hex-строки в байты
pub fn from_hex(hex: &str) -> Result<Vec<u8>, String> {
    let s = hex.trim();
    if s.len() % 2 != 0 {
        return Err("Hex string has odd length".to_string());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&s[i..i + 2], 16)
                .map_err(|e| format!("Hex parse error: {e}"))
        })
        .collect()
}

/// Генерация криптографически стойкой соли заданной длины
pub fn generate_salt(len: usize) -> Vec<u8> {
    let mut salt = vec![0u8; len];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    salt
}

/// Вычисление производного ключа KEK через Argon2id
pub fn derive_argon2_key(
    password: &str,
    salt: &[u8],
    m_cost: u32,
    t_cost: u32,
    p_cost: u32,
) -> Result<[u8; 32], String> {
    let params = Params::new(m_cost, t_cost, p_cost, Some(32))
        .map_err(|e| format!("Invalid Argon2 params: {e}"))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Argon2 derivation failed: {e}"))?;
    Ok(key)
}

/// Шифрование данных алгоритмом AES-256-GCM со случайным 96-битным (12 байт) nonce
pub fn encrypt_aes_gcm(key: &[u8; 32], plaintext: &[u8]) -> Result<(Vec<u8>, [u8; 12]), String> {
    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);

    let cipher_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(cipher_key);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("AES-GCM encryption error: {e}"))?;

    Ok((ciphertext, nonce_bytes))
}

/// Расшифровка данных алгоритмом AES-256-GCM
pub fn decrypt_aes_gcm(
    key: &[u8; 32],
    nonce_bytes: &[u8; 12],
    ciphertext: &[u8],
) -> Result<Vec<u8>, String> {
    let cipher_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(cipher_key);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("AES-GCM decryption/authentication failed: {e}"))
}

/// Вычисление контрольного хеша SHA-256
pub fn sha256_digest(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    to_hex(&hasher.finalize())
}

/// Генерация ключа восстановления достаточной длины и энтропии
/// Формат: 4 блока по 6 символов безопасного Base32 (без путаницы 0/O, 1/I)
pub fn generate_recovery_key() -> String {
    const CHARSET: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let mut rng = rand::rngs::OsRng;
    let mut random_bytes = [0u8; 24];
    rng.fill_bytes(&mut random_bytes);

    let mut chars = Vec::with_capacity(24);
    for b in random_bytes {
        chars.push(CHARSET[(b as usize) % CHARSET.len()] as char);
    }

    format!(
        "{}-{}-{}-{}",
        chars[0..6].iter().collect::<String>(),
        chars[6..12].iter().collect::<String>(),
        chars[12..18].iter().collect::<String>(),
        chars[18..24].iter().collect::<String>()
    )
}

/// Нормализация ключа восстановления (удаление дефисов и пробелов, перевод в верхний регистр)
pub fn normalize_recovery_key(key: &str) -> String {
    key.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_uppercase()
}
