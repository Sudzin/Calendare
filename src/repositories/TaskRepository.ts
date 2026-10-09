import { Task } from '../types';
import { validateBackup, isSafeId } from '../utils/backupValidation';
import { getCurrentTimestamp } from '../utils/date';
import { isTauri, tauriApi } from '../services/tauriBridge';
import { mergeTaskLists, mergeTaskVersions } from '../utils/taskMerge';

export const TASK_STORAGE_KEY = 'chronos_tasks';
export const TASK_MIGRATION_FLAG_KEY = 'chronos_tasks_migrated_to_files';

export interface CorruptedNotice {
  filename: string;
  reason: string;
  timestamp: string;
  corruptPath: string;
}

/**
 * Входные данные для обновления задачи.
 * Поле `updatedAt` не обязательно передавать — оно автоматически устанавливается в текущее время.
 */
export type UpdateTaskInput = (Omit<Task, 'updatedAt'> & Partial<Pick<Task, 'updatedAt'>>) | (Partial<Task> & { id: string });

export interface TaskStorageBackend {
  readonly type: 'localStorage' | 'file';
  getAll(): Task[] | Promise<Task[]>;
  saveAll(tasks: Task[]): void | Promise<void>;
  saveTask?(task: Task): Promise<void> | void;
  deleteTask?(id: string, deletedAt: string): Promise<void> | void;
  importTasks?(tasks: Task[]): Promise<{ importedCount: number; skippedCount: number }>;
  purgeTombstones?(days?: number): Promise<{ purgedCount: number; keptCount: number }>;
}

/**
 * Стандартный бэкенд на базе localStorage (используется в веб-версии и тестах по умолчанию)
 */
export class LocalStorageBackend implements TaskStorageBackend {
  readonly type = 'localStorage' as const;

  getAll(): Task[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }
      const raw = localStorage.getItem(TASK_STORAGE_KEY);
      if (raw !== null) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid: Task[] = [];
            const invalid: unknown[] = [];
            for (const item of parsed) {
              if (TaskRepository.isValidBasicTask(item)) {
                valid.push(item);
              } else {
                invalid.push(item);
              }
            }

            // Исправление: невалидные задачи НЕ отбрасываются молча, а изолируются в corrupt-ключ с timestamp
            if (invalid.length > 0) {
              const timestamp = getCurrentTimestamp().replace(/[:.]/g, '-');
              const corruptKey = `chronos_tasks_corrupt_${timestamp}`;
              try {
                localStorage.setItem(corruptKey, JSON.stringify(invalid));
                TaskRepository.recordCorruptedNotice({
                  filename: corruptKey,
                  reason: `Found ${invalid.length} invalid tasks in stored array`,
                  timestamp,
                  corruptPath: corruptKey,
                });
              } catch (e) {
                console.error('Failed to preserve corrupted items in localStorage:', e);
              }
            }

            return mergeTaskLists(valid);
          }
          // Не-массив — сохраняем поврежденные сырые данные с меткой времени
          const timestamp = getCurrentTimestamp().replace(/[:.]/g, '-');
          const corruptKey = `chronos_tasks_corrupt_${timestamp}`;
          localStorage.setItem(corruptKey, raw);
          TaskRepository.recordCorruptedNotice({
            filename: TASK_STORAGE_KEY,
            reason: 'Stored tasks value is not an array',
            timestamp,
            corruptPath: corruptKey,
          });
          return [];
        } catch (e) {
          console.error('Failed to parse stored tasks:', e);
          const timestamp = getCurrentTimestamp().replace(/[:.]/g, '-');
          const corruptKey = `chronos_tasks_corrupt_${timestamp}`;
          localStorage.setItem(corruptKey, raw);
          TaskRepository.recordCorruptedNotice({
            filename: TASK_STORAGE_KEY,
            reason: `JSON parse error: ${e}`,
            timestamp,
            corruptPath: corruptKey,
          });
          return [];
        }
      }
    } catch (e) {
      console.error('Failed to access stored tasks:', e);
    }
    return [];
  }

  saveAll(tasks: Task[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
      }
    } catch (e) {
      console.error('Failed to store tasks:', e);
    }
  }

  saveTask(task: Task): void {
    const current = this.getAll();
    const index = current.findIndex(t => t.id === task.id);
    if (index >= 0) {
      current[index] = task;
    } else {
      current.push(task);
    }
    this.saveAll(current);
  }

  deleteTask(id: string): void {
    const current = this.getAll().filter(t => t.id !== id);
    this.saveAll(current);
  }

  async importTasks(tasks: Task[]): Promise<{ importedCount: number; skippedCount: number }> {
    const current = this.getAll();
    const map = new Map(current.map(t => [t.id, t]));
    let importedCount = 0;
    let skippedCount = 0;

    for (const t of tasks) {
      const existing = map.get(t.id);
      if (existing) {
        if (existing.updatedAt && t.updatedAt && existing.updatedAt >= t.updatedAt) {
          skippedCount++;
          continue;
        }
      }
      map.set(t.id, t);
      importedCount++;
    }

    this.saveAll(Array.from(map.values()));
    return { importedCount, skippedCount };
  }

  async purgeTombstones(days = 30): Promise<{ purgedCount: number; keptCount: number }> {
    try {
      if (typeof localStorage === 'undefined') return { purgedCount: 0, keptCount: 0 };
      const raw = localStorage.getItem(TASK_STORAGE_KEY);
      if (!raw) return { purgedCount: 0, keptCount: 0 };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return { purgedCount: 0, keptCount: 0 };

      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      let purgedCount = 0;
      let keptCount = 0;

      const filtered = parsed.filter(t => {
        if (t && t.deletedAt) {
          const deletedTime = new Date(t.deletedAt).getTime();
          if (!Number.isNaN(deletedTime) && deletedTime < cutoffMs) {
            purgedCount++;
            return false;
          }
          keptCount++;
        }
        return true;
      });

      this.saveAll(filtered);
      return { purgedCount, keptCount };
    } catch {
      return { purgedCount: 0, keptCount: 0 };
    }
  }
}

/**
 * Бэкенд на базе файлового слоя Tauri 2 (вызывает команды Rust через invoke)
 */
export class TauriFileBackend implements TaskStorageBackend {
  readonly type = 'file' as const;
  private memoryCache: Task[] = [];
  private isLoaded = false;

  async loadFromDisk(): Promise<Task[]> {
    try {
      const result = await tauriApi.readTasks();
      if (result) {
        this.memoryCache = mergeTaskLists(result.tasks.filter(TaskRepository.isValidBasicTask));
        this.isLoaded = true;

        if (result.corrupted_files && result.corrupted_files.length > 0) {
          for (const c of result.corrupted_files) {
            TaskRepository.recordCorruptedNotice({
              filename: c.filename,
              reason: c.reason,
              timestamp: c.timestamp,
              corruptPath: c.backup_path,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to read tasks from Tauri file storage:', err);
    }
    return this.memoryCache;
  }

  getAll(): Task[] {
    return this.memoryCache;
  }

  async saveAll(tasks: Task[]): Promise<void> {
    this.memoryCache = tasks;
    for (const task of tasks) {
      await this.saveTask(task);
    }
  }

  async saveTask(task: Task): Promise<void> {
    const index = this.memoryCache.findIndex(t => t.id === task.id);
    if (index >= 0) {
      this.memoryCache[index] = task;
    } else {
      this.memoryCache.unshift(task);
    }
    try {
      await tauriApi.writeTask(task);
    } catch (err) {
      console.error(`Failed to write task ${task.id} via Tauri:`, err);
      throw err;
    }
  }

  async deleteTask(id: string, deletedAt = getCurrentTimestamp()): Promise<void> {
    this.memoryCache = this.memoryCache.filter(t => t.id !== id);
    try {
      await tauriApi.deleteTask(id, deletedAt);
    } catch (err) {
      console.error(`Failed to delete task ${id} via Tauri:`, err);
      throw err;
    }
  }

  async importTasks(tasks: Task[]): Promise<{ importedCount: number; skippedCount: number }> {
    try {
      const res = await tauriApi.importTasks(tasks);
      await this.loadFromDisk();
      if (res) {
        return { importedCount: res.imported_count, skippedCount: res.skipped_count };
      }
    } catch (err) {
      console.error('Failed to import tasks via Tauri:', err);
    }
    return { importedCount: 0, skippedCount: 0 };
  }

  async purgeTombstones(days = 30): Promise<{ purgedCount: number; keptCount: number }> {
    try {
      const res = await tauriApi.purgeTombstones(days);
      await this.loadFromDisk();
      if (res) {
        return { purgedCount: res.purged_count, keptCount: res.kept_count };
      }
    } catch (err) {
      console.error('Failed to purge tombstones via Tauri:', err);
    }
    return { purgedCount: 0, keptCount: 0 };
  }
}

export class TaskRepository {
  static readonly STORAGE_KEY = TASK_STORAGE_KEY;
  static readonly MIGRATION_FLAG_KEY = TASK_MIGRATION_FLAG_KEY;

  private static currentBackend: TaskStorageBackend = isTauri()
    ? new TauriFileBackend()
    : new LocalStorageBackend();

  private static corruptedNotices: CorruptedNotice[] = [];
  private static listeners = new Set<(notices: CorruptedNotice[]) => void>();
  private static errorListeners = new Set<(message: string) => void>();
  private static externalChangeListeners = new Set<() => void>();
  private static isWatcherInitialized = false;

  static onExternalChange(listener: () => void): () => void {
    TaskRepository.initWatcher();
    TaskRepository.externalChangeListeners.add(listener);
    return () => {
      TaskRepository.externalChangeListeners.delete(listener);
    };
  }

  static notifyExternalChange(): void {
    for (const listener of TaskRepository.externalChangeListeners) {
      listener();
    }
  }

  private static initWatcher(): void {
    if (TaskRepository.isWatcherInitialized) return;
    TaskRepository.isWatcherInitialized = true;

    if (isTauri()) {
      tauriApi.listenToTaskChanges(() => {
        TaskRepository.notifyExternalChange();
      });
    } else if (typeof window !== 'undefined') {
      // Кросс-вкладочное слежение за изменениями в браузере
      window.addEventListener('storage', e => {
        if (e.key === TASK_STORAGE_KEY) {
          TaskRepository.notifyExternalChange();
        }
      });
    }
  }

  static onStorageError(listener: (message: string) => void): () => void {
    TaskRepository.errorListeners.add(listener);
    return () => {
      TaskRepository.errorListeners.delete(listener);
    };
  }

  static notifyStorageError(message: string): void {
    for (const listener of TaskRepository.errorListeners) {
      listener(message);
    }
  }

  static getBackend(): TaskStorageBackend {
    return TaskRepository.currentBackend;
  }

  static setBackend(backend: TaskStorageBackend): void {
    TaskRepository.currentBackend = backend;
  }

  static recordCorruptedNotice(notice: CorruptedNotice): void {
    TaskRepository.corruptedNotices.push(notice);
    for (const listener of TaskRepository.listeners) {
      listener([...TaskRepository.corruptedNotices]);
    }
  }

  static getCorruptedNotices(): CorruptedNotice[] {
    return [...TaskRepository.corruptedNotices];
  }

  static clearCorruptedNotices(): void {
    TaskRepository.corruptedNotices = [];
  }

  static onCorruptedData(listener: (notices: CorruptedNotice[]) => void): () => void {
    TaskRepository.listeners.add(listener);
    if (TaskRepository.corruptedNotices.length > 0) {
      listener([...TaskRepository.corruptedNotices]);
    }
    return () => {
      TaskRepository.listeners.delete(listener);
    };
  }

  /**
   * Проверка: требуется ли предложить пользователю однократную миграцию из localStorage в файл
   */
  static hasPendingMigration(): boolean {
    if (!isTauri()) return false;
    if (typeof localStorage === 'undefined') return false;
    const isMigrated = localStorage.getItem(TaskRepository.MIGRATION_FLAG_KEY) === 'true';
    if (isMigrated) return false;

    const raw = localStorage.getItem(TaskRepository.STORAGE_KEY);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Выполнение миграции из localStorage в текущее активное хранилище (Tauri или кастомный backend).
   * ВАЖНО: данные из localStorage НЕ удаляются!
   */
  static async migrateFromLocalStorage(): Promise<{ imported: number; skipped: number }> {
    if (typeof localStorage === 'undefined') {
      return { imported: 0, skipped: 0 };
    }
    const raw = localStorage.getItem(TaskRepository.STORAGE_KEY);
    if (!raw) {
      return { imported: 0, skipped: 0 };
    }

    let tasksToMigrate: Task[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        tasksToMigrate = parsed.filter(TaskRepository.isValidBasicTask);
      }
    } catch {
      return { imported: 0, skipped: 0 };
    }

    const backend = TaskRepository.getBackend();
    let imported = 0;
    let skipped = 0;

    if (backend.importTasks) {
      const res = await backend.importTasks(tasksToMigrate);
      imported = res.importedCount;
      skipped = res.skippedCount;
    } else {
      for (const t of tasksToMigrate) {
        if (backend.saveTask) {
          await backend.saveTask(t);
          imported++;
        }
      }
    }

    // Фиксируем флаг выполненной миграции, НЕ удаляя chronos_tasks
    localStorage.setItem(TaskRepository.MIGRATION_FLAG_KEY, 'true');

    return { imported, skipped };
  }

  /**
   * Базовая валидация структуры задачи для фильтрации повреждённых элементов в хранилище.
   */
  static isValidBasicTask(item: unknown): item is Task {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    return (
      isSafeId(candidate.id) &&
      typeof candidate.title === 'string' &&
      typeof candidate.date === 'string' &&
      candidate.date.trim() !== '' &&
      typeof candidate.status === 'string' &&
      candidate.status.trim() !== '' &&
      typeof candidate.priority === 'string' &&
      candidate.priority.trim() !== ''
    );
  }

  /**
   * Генерация уникального идентификатора задачи с использованием standard Web Crypto API.
   */
  static generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Получение всех задач из текущего бэкенда (или пустой массив, если хранилище пусто).
   */
  static getAll(): Task[] {
    const res = TaskRepository.currentBackend.getAll();
    if (Array.isArray(res)) {
      return res;
    }
    return [];
  }

  /**
   * Асинхронная инициализация / загрузка задач (особенно важна для Tauri при старте)
   */
  static async loadAsync(): Promise<Task[]> {
    if (TaskRepository.currentBackend instanceof TauriFileBackend) {
      return await TaskRepository.currentBackend.loadFromDisk();
    }
    const res = await TaskRepository.currentBackend.getAll();
    return Array.isArray(res) ? res : [];
  }

  /**
   * Получение задачи по ID из текущего хранилища.
   */
  static getById(id: string): Task | undefined {
    return TaskRepository.getAll().find(t => t.id === id);
  }

  /**
   * Создание новой задачи (без самостоятельной записи в хранилище).
   */
  static create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task {
    const id = taskData.id ?? TaskRepository.generateId();
    const now = getCurrentTimestamp();
    const newTask: Task = {
      ...taskData,
      id,
      createdAt: taskData.createdAt ?? now,
      updatedAt: taskData.updatedAt ?? now,
    } as Task;

    return newTask;
  }

  /**
   * Обновление задачи (без самостоятельной записи в хранилище).
   * Поле `updatedAt` автоматически устанавливается в текущее время (ISO-строка).
   */
  static update(updated: UpdateTaskInput, existing?: Task): Task {
    const existingTask = existing ?? TaskRepository.getById(updated.id);

    if (!existingTask) {
      throw new Error(`Task not found: ${updated.id}`);
    }

    const now = getCurrentTimestamp();

    // Игнорируем поля со значением undefined при слиянии
    const definedUpdates = Object.fromEntries(
      Object.entries(updated).filter(([_, value]) => value !== undefined)
    );

    const updatedTaskResult: Task = {
      ...existingTask,
      ...definedUpdates,
      id: existingTask.id,
      createdAt: existingTask.createdAt,
      updatedAt: now,
    } as Task;

    return updatedTaskResult;
  }

  /**
   * Удаление задачи по ID из списка (без самостоятельной записи в хранилище).
   */
  static delete(taskId: string, tasks?: Task[]): Task[] {
    const currentTasks = tasks ?? TaskRepository.getAll();
    return currentTasks.filter(t => t.id !== taskId);
  }

  /**
   * Сохранение полного списка задач в хранилище.
   */
  static saveAll(tasks: Task[]): void {
    TaskRepository.currentBackend.saveAll(tasks);
  }

  /**
   * Сохранение одной задачи (атомарная запись на диск в Tauri)
   */
  static async saveTask(task: Task): Promise<void> {
    try {
      if (TaskRepository.currentBackend.saveTask) {
        await TaskRepository.currentBackend.saveTask(task);
      } else {
        TaskRepository.saveAll([task, ...TaskRepository.getAll().filter(t => t.id !== task.id)]);
      }
    } catch (err) {
      console.error(`Failed to save task ${task.id}:`, err);
      TaskRepository.notifyStorageError('Не удалось сохранить задачу на диск');
      throw err;
    }
  }

  /**
   * Удаление задачи (с установкой tombstone deletedAt на диске)
   */
  static async deleteTask(id: string): Promise<void> {
    try {
      if (TaskRepository.currentBackend.deleteTask) {
        await TaskRepository.currentBackend.deleteTask(id, getCurrentTimestamp());
      } else {
        TaskRepository.saveAll(TaskRepository.delete(id));
      }
    } catch (err) {
      console.error(`Failed to delete task ${id}:`, err);
      TaskRepository.notifyStorageError('Не удалось сохранить задачу на диск');
      throw err;
    }
  }

  /**
   * Безопасный импорт задач из объекта резервной копии (валидация без самостоятельной записи в хранилище).
   */
  static importFromBackup(data: unknown): Task[] {
    const validated = validateBackup(data);
    return validated.tasks;
  }

  /**
   * Очистка устаревших надгробий (старше days дней, по умолчанию 30 дней)
   */
  static async purgeOldTombstones(days = 30): Promise<{ purgedCount: number; keptCount: number }> {
    if (TaskRepository.currentBackend.purgeTombstones) {
      return await TaskRepository.currentBackend.purgeTombstones(days);
    }
    return { purgedCount: 0, keptCount: 0 };
  }
}

export default TaskRepository;
