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

export interface ReadTasksResult {
  tasks: any[];
  corrupted_files: CorruptedFileInfo[];
  data_dir: string;
}

export interface ImportSummary {
  imported_count: number;
  skipped_count: number;
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
};
