/**
 * Tauri Bridge & Platform Detection
 * Обеспечивает безопасное взаимодействие с Tauri 2 API
 * с автоматическим fallback при запуске в веб-браузере.
 */

export interface CorruptedFileInfo {
  filename: string;
  reason: string;
  timestamp: string;
  backup_path: string;
}

export interface IntegrityWarning {
  taskId: string;
  kind: 'missing_file' | 'version_mismatch';
  message: string;
  filename: string;
}

export interface ReadTasksResult {
  tasks: any[];
  corrupted_files: CorruptedFileInfo[];
  integrity_warnings?: IntegrityWarning[];
  data_dir: string;
  is_vault_locked?: boolean;
}

export interface ImportSummary {
  imported_count: number;
  skipped_count: number;
}

export interface PurgeSummary {
  purged_count: number;
  kept_count: number;
}

export interface CreateVaultResponse {
  recovery_key: string;
}

export interface VaultStatusResponse {
  is_initialized: boolean;
  is_unlocked: boolean;
  cache_in_credential_manager: boolean;
}

/**
 * Проверка, запущено ли приложение внутри среды Tauri
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || ('__TAURI__' in window);
}

/**
 * Вызов команды Tauri с безопасным fallback
 */
export async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (err) {
    console.error(`Tauri invoke error [${command}]:`, err);
    throw err;
  }
}

export const tauriApi = {
  isTauri,

  async getDataDir(): Promise<string | null> {
    return invokeTauri<string>('get_data_dir');
  },

  async setDataDir(path: string): Promise<string | null> {
    return invokeTauri<string>('set_data_dir', { path });
  },

  async readTasks(): Promise<ReadTasksResult | null> {
    return invokeTauri<ReadTasksResult>('read_tasks');
  },

  async writeTask(task: any): Promise<void> {
    await invokeTauri<void>('write_task', { task });
  },

  async deleteTask(id: string, deletedAt: string): Promise<void> {
    await invokeTauri<void>('delete_task', { id, deletedAt });
  },

  async importTasks(tasks: any[]): Promise<ImportSummary | null> {
    return invokeTauri<ImportSummary>('import_tasks', { tasks });
  },

  async purgeTombstones(maxAgeDays = 30): Promise<PurgeSummary | null> {
    return invokeTauri<PurgeSummary>('purge_tombstones', { maxAgeDays });
  },

  async listenToTaskChanges(callback: () => void): Promise<(() => void) | null> {
    if (!isTauri()) return null;
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen('tasks-changed', () => {
        callback();
      });
      return unlisten;
    } catch (err) {
      console.warn('Failed to register tasks-changed listener:', err);
      return null;
    }
  },

  // ---------------- Vault & Encryption APIs ----------------

  async isVaultInitialized(): Promise<boolean> {
    const res = await invokeTauri<boolean>('is_vault_initialized');
    return res ?? false;
  },

  async isVaultUnlocked(): Promise<boolean> {
    const res = await invokeTauri<boolean>('is_vault_unlocked');
    return res ?? true;
  },

  async getVaultStatus(): Promise<VaultStatusResponse | null> {
    return invokeTauri<VaultStatusResponse>('get_vault_status');
  },

  async createVault(password: string, cacheInCredMgr = true): Promise<CreateVaultResponse | null> {
    return invokeTauri<CreateVaultResponse>('create_vault', {
      password,
      cacheInCredMgr,
    });
  },

  async unlockVault(password: string): Promise<void> {
    await invokeTauri<void>('unlock_vault', { password });
  },

  async unlockVaultWithRecoveryKey(recoveryKey: string): Promise<void> {
    await invokeTauri<void>('unlock_vault_with_recovery_key', { recoveryKey });
  },

  async lockVault(): Promise<void> {
    await invokeTauri<void>('lock_vault');
  },

  async setCredentialCaching(enabled: boolean): Promise<void> {
    await invokeTauri<void>('set_credential_caching', { enabled });
  },
};
