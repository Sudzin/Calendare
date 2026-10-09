/// Модуль интеграции с Windows Credential Manager
/// Позволяет безопасно кэшировать производный ключ в хранилище учетных данных Windows,
/// чтобы не требовать ввод пароля при каждом перезапуске приложения.

#[cfg(target_os = "windows")]
mod imp {
    use std::ptr;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[repr(C)]
    struct CREDENTIALW {
        flags: u32,
        r#type: u32,
        target_name: *mut u16,
        comment: *mut u16,
        last_written: [u32; 2],
        credential_blob_size: u32,
        credential_blob: *mut u8,
        persist: u32,
        attribute_count: u32,
        attributes: *mut std::ffi::c_void,
        target_alias: *mut u16,
        user_name: *mut u16,
    }

    const CRED_TYPE_GENERIC: u32 = 1;
    const CRED_PERSIST_LOCAL_MACHINE: u32 = 2;

    #[link(name = "advapi32")]
    extern "system" {
        fn CredWriteW(credential: *const CREDENTIALW, flags: u32) -> i32;
        fn CredReadW(target_name: *const u16, r#type: u32, flags: u32, credential: *mut *mut CREDENTIALW) -> i32;
        fn CredDeleteW(target_name: *const u16, r#type: u32, flags: u32) -> i32;
        fn CredFree(buffer: *mut std::ffi::c_void);
    }

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    pub fn save_credential(target: &str, secret: &[u8]) -> Result<(), String> {
        let mut target_wide = to_wide(target);
        let user_name = "ChronosTaskUser\0".encode_utf16().collect::<Vec<u16>>();

        let cred = CREDENTIALW {
            flags: 0,
            r#type: CRED_TYPE_GENERIC,
            target_name: target_wide.as_mut_ptr(),
            comment: ptr::null_mut(),
            last_written: [0, 0],
            credential_blob_size: secret.len() as u32,
            credential_blob: secret.as_ptr() as *mut u8,
            persist: CRED_PERSIST_LOCAL_MACHINE,
            attribute_count: 0,
            attributes: ptr::null_mut(),
            target_alias: ptr::null_mut(),
            user_name: user_name.as_ptr() as *mut u16,
        };

        let res = unsafe { CredWriteW(&cred, 0) };
        if res != 0 {
            Ok(())
        } else {
            Err("Failed to write credential to Windows Credential Manager".to_string())
        }
    }

    pub fn read_credential(target: &str) -> Result<Option<Vec<u8>>, String> {
        let target_wide = to_wide(target);
        let mut cred_ptr: *mut CREDENTIALW = ptr::null_mut();

        let res = unsafe { CredReadW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0, &mut cred_ptr) };
        if res != 0 && !cred_ptr.is_null() {
            let cred = unsafe { &*cred_ptr };
            let blob_len = cred.credential_blob_size as usize;
            let blob_slice = unsafe { std::slice::from_raw_parts(cred.credential_blob, blob_len) };
            let result = blob_slice.to_vec();
            unsafe { CredFree(cred_ptr as *mut std::ffi::c_void) };
            Ok(Some(result))
        } else {
            Ok(None)
        }
    }

    pub fn delete_credential(target: &str) -> Result<(), String> {
        let target_wide = to_wide(target);
        let res = unsafe { CredDeleteW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0) };
        if res != 0 {
            Ok(())
        } else {
            // Если учетных данных не было, удаление считается успешным
            Ok(())
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod imp {
    use std::collections::HashMap;
    use std::sync::Mutex;

    static FALLBACK_STORE: Mutex<Option<HashMap<String, Vec<u8>>>> = Mutex::new(None);

    pub fn save_credential(target: &str, secret: &[u8]) -> Result<(), String> {
        let mut guard = FALLBACK_STORE.lock().map_err(|e| e.to_string())?;
        let store = guard.get_or_insert_with(HashMap::new);
        store.insert(target.to_string(), secret.to_vec());
        Ok(())
    }

    pub fn read_credential(target: &str) -> Result<Option<Vec<u8>>, String> {
        let mut guard = FALLBACK_STORE.lock().map_err(|e| e.to_string())?;
        let store = guard.get_or_insert_with(HashMap::new);
        Ok(store.get(target).cloned())
    }

    pub fn delete_credential(target: &str) -> Result<(), String> {
        let mut guard = FALLBACK_STORE.lock().map_err(|e| e.to_string())?;
        if let Some(store) = guard.as_mut() {
            store.remove(target);
        }
        Ok(())
    }
}

pub use imp::*;
