import { Task } from '../types';
import { getCurrentTimestamp } from '../utils/date';

export interface CorruptedTaskFileInfo {
  filename: string;
  reason: string;
  timestamp: string;
  corruptPath: string;
  originalContent?: string;
}

export interface FileStorageReadResult {
  tasks: Task[];
  corruptedFiles: CorruptedTaskFileInfo[];
  dataDir: string;
}

export interface FileStorageImportSummary {
  importedCount: number;
  skippedCount: number;
}

/**
 * Абстрактный интерфейс драйвера файловой системы для работы на диске или в тестах.
 */
export interface FileSystemDriver {
  readDir(dirPath: string): Promise<string[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  removeFile(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  createDirAll(dirPath: string): Promise<void>;
}

/**
 * In-memory реализация FileSystemDriver для тестов и симуляции сбоев
 */
export class MemoryFileSystemDriver implements FileSystemDriver {
  private files = new Map<string, string>();
  private directories = new Set<string>();
  public failNextWrite = false;
  public failDuringAtomicRename = false;

  constructor() {
    this.directories.add('/');
  }

  private normalize(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  async createDirAll(dirPath: string): Promise<void> {
    const normalized = this.normalize(dirPath);
    const parts = normalized.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      this.directories.add(current);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    const normalized = this.normalize(filePath);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  async readDir(dirPath: string): Promise<string[]> {
    const normalized = this.normalize(dirPath);
    const prefix = normalized.endsWith('/') ? normalized : normalized + '/';
    const result = new Set<string>();

    for (const file of this.files.keys()) {
      if (file.startsWith(prefix)) {
        const rest = file.slice(prefix.length);
        const name = rest.split('/')[0];
        if (name) result.add(name);
      }
    }

    return Array.from(result);
  }

  async readFile(filePath: string): Promise<string> {
    const normalized = this.normalize(filePath);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new Error(`File not found: ${filePath}`);
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('Simulated write failure (e.g. disk full or process crash)');
    }
    const normalized = this.normalize(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash > 0) {
      await this.createDirAll(normalized.slice(0, lastSlash));
    }
    this.files.set(normalized, content);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (this.failDuringAtomicRename) {
      this.failDuringAtomicRename = false;
      throw new Error('Simulated atomic rename failure');
    }
    const normalizedOld = this.normalize(oldPath);
    const normalizedNew = this.normalize(newPath);
    const content = this.files.get(normalizedOld);
    if (content === undefined) {
      throw new Error(`Cannot rename: source file not found: ${oldPath}`);
    }
    this.files.delete(normalizedOld);
    this.files.set(normalizedNew, content);
  }

  async removeFile(filePath: string): Promise<void> {
    const normalized = this.normalize(filePath);
    this.files.delete(normalized);
  }

  dumpFiles(): Record<string, string> {
    return Object.fromEntries(this.files.entries());
  }
}

/**
 * Менеджер файлового хранилища задач:
 * - Атомарная запись через временный файл в той же папке
 * - Изоляция и перенос битых/невалидных файлов в corrupt/
 * - Надгробия (tombstone) при удалении
 * - Идемпотентный импорт из localStorage
 */
export class TaskFileManager {
  private fs: FileSystemDriver;
  private dataDir: string;

  constructor(dataDir: string, fsDriver: FileSystemDriver) {
    this.dataDir = dataDir.replace(/\\/g, '/').replace(/\/+$/, '');
    this.fs = fsDriver;
  }

  get tasksDir(): string {
    return `${this.dataDir}/tasks`;
  }

  get corruptDir(): string {
    return `${this.dataDir}/corrupt`;
  }

  async ensureDirectories(): Promise<void> {
    await this.fs.createDirAll(this.tasksDir);
    await this.fs.createDirAll(this.corruptDir);
  }

  /**
   * Атомарная запись файла:
   * 1. Запись во временный файл `<target>.tmp.<unique>` в той же папке.
   * 2. Переименование (atomic rename) временного файла в целевой.
   * При сбое целевой файл остаётся нетронутым!
   */
  async atomicWrite(targetPath: string, content: string): Promise<void> {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const tmpPath = `${targetPath}.tmp.${unique}`;

    try {
      await this.fs.writeFile(tmpPath, content);
      await this.fs.rename(tmpPath, targetPath);
    } catch (err) {
      // Пытаемся подчистить временный файл при сбое, если он был создан
      try {
        if (await this.fs.exists(tmpPath)) {
          await this.fs.removeFile(tmpPath);
        }
      } catch {
        // Игнорируем ошибку очистки временного файла
      }
      throw err;
    }
  }

  /**
   * Проверка минимальной корректности задачи
   */
  isValidTask(candidate: unknown): candidate is Task {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return false;
    }
    const t = candidate as Record<string, unknown>;
    return (
      typeof t.id === 'string' &&
      t.id.trim() !== '' &&
      typeof t.title === 'string' &&
      typeof t.date === 'string' &&
      t.date.trim() !== '' &&
      typeof t.status === 'string' &&
      t.status.trim() !== '' &&
      typeof t.priority === 'string' &&
      t.priority.trim() !== ''
    );
  }

  /**
   * Чтение всех задач с изоляцией битых файлов
   */
  async readAllTasks(): Promise<FileStorageReadResult> {
    await this.ensureDirectories();

    const filenames = await this.fs.readDir(this.tasksDir);
    const tasks: Task[] = [];
    const corruptedFiles: CorruptedTaskFileInfo[] = [];

    for (const filename of filenames) {
      // Игнорируем временные файлы
      if (filename.includes('.tmp.')) {
        continue;
      }

      if (!filename.endsWith('.json')) {
        continue;
      }

      const filePath = `${this.tasksDir}/${filename}`;
      let rawContent = '';

      try {
        rawContent = await this.fs.readFile(filePath);
      } catch (readErr: any) {
        // Ошибка чтения — переносим в corrupt
        const timestamp = getCurrentTimestamp().replace(/[:.]/g, '-');
        const corruptFilename = `${filename}.${timestamp}.corrupt`;
        const corruptPath = `${this.corruptDir}/${corruptFilename}`;
        try {
          await this.fs.rename(filePath, corruptPath);
        } catch {
          // Игнорируем ошибку перемещения
        }

        corruptedFiles.push({
          filename,
          reason: `Read error: ${readErr?.message || String(readErr)}`,
          timestamp,
          corruptPath,
        });
        continue;
      }

      try {
        const parsed = JSON.parse(rawContent);

        if (!this.isValidTask(parsed)) {
          // Невалидная структура полей Task — перемещаем в corrupt/
          const timestamp = getCurrentTimestamp().replace(/[:.]/g, '-');
          const corruptFilename = `${filename}.${timestamp}.corrupt`;
          const corruptPath = `${this.corruptDir}/${corruptFilename}`;
          await this.fs.rename(filePath, corruptPath);

          corruptedFiles.push({
            filename,
            reason: 'Task missing required fields (id, title, date, status, priority)',
            timestamp,
            corruptPath,
            originalContent: rawContent,
          });
          continue;
        }

        // Проверяем признак надгробия (tombstone)
        const isDeleted = typeof (parsed as any).deletedAt === 'string' && (parsed as any).deletedAt.trim() !== '';
        if (!isDeleted) {
          tasks.push(parsed);
        }
      } catch (parseErr: any) {
        // Синтаксическая ошибка JSON — переносим в corrupt/
        const timestamp = getCurrentTimestamp().replace(/[:.]/g, '-');
        const corruptFilename = `${filename}.${timestamp}.corrupt`;
        const corruptPath = `${this.corruptDir}/${corruptFilename}`;
        await this.fs.rename(filePath, corruptPath);

        corruptedFiles.push({
          filename,
          reason: `JSON parse error: ${parseErr?.message || String(parseErr)}`,
          timestamp,
          corruptPath,
          originalContent: rawContent,
        });
      }
    }

    return {
      tasks,
      corruptedFiles,
      dataDir: this.dataDir,
    };
  }

  /**
   * Запись одной задачи атомарно
   */
  async writeTask(task: Task): Promise<void> {
    await this.ensureDirectories();
    if (!task.id || task.id.trim() === '') {
      throw new Error('Task id is required');
    }
    const filePath = `${this.tasksDir}/${task.id}.json`;
    const serialized = JSON.stringify(task, null, 2);
    await this.atomicWrite(filePath, serialized);
  }

  /**
   * Пометка задачи удалённой (tombstone)
   */
  async deleteTask(id: string, deletedAt = getCurrentTimestamp()): Promise<void> {
    await this.ensureDirectories();
    const filePath = `${this.tasksDir}/${id}.json`;

    let taskData: any = { id };
    if (await this.fs.exists(filePath)) {
      try {
        const raw = await this.fs.readFile(filePath);
        taskData = JSON.parse(raw);
      } catch {
        taskData = { id };
      }
    }

    taskData.deletedAt = deletedAt;
    taskData.updatedAt = deletedAt;

    const serialized = JSON.stringify(taskData, null, 2);
    await this.atomicWrite(filePath, serialized);
  }

  /**
   * Пакетный импорт задач (например из localStorage) с идемпотентностью по id и updatedAt
   */
  async importTasks(tasks: Task[]): Promise<FileStorageImportSummary> {
    await this.ensureDirectories();
    let importedCount = 0;
    let skippedCount = 0;

    for (const task of tasks) {
      if (!task.id || task.id.trim() === '') {
        skippedCount++;
        continue;
      }

      const filePath = `${this.tasksDir}/${task.id}.json`;

      // Проверяем существующую версию для обеспечения идемпотентности
      if (await this.fs.exists(filePath)) {
        try {
          const raw = await this.fs.readFile(filePath);
          const existing = JSON.parse(raw);
          const existingUpdated = typeof existing.updatedAt === 'string' ? existing.updatedAt : '';
          const currentUpdated = typeof task.updatedAt === 'string' ? task.updatedAt : '';

          if (existingUpdated && existingUpdated >= currentUpdated) {
            skippedCount++;
            continue;
          }
        } catch {
          // Если существующий файл поврежден, перезаписываем валидным
        }
      }

      await this.writeTask(task);
      importedCount++;
    }

    return {
      importedCount,
      skippedCount,
    };
  }
}
