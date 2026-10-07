import { Task } from '../types';
import { validateBackup } from '../utils/backupValidation';
import { getCurrentTimestamp } from '../utils/date';

export const TASK_STORAGE_KEY = 'chronos_tasks';

/**
 * Входные данные для обновления задачи.
 * Поле `updatedAt` не обязательно передавать — оно автоматически устанавливается в текущее время.
 */
export type UpdateTaskInput = (Omit<Task, 'updatedAt'> & Partial<Pick<Task, 'updatedAt'>>) | (Partial<Task> & { id: string });

export class TaskRepository {
  static readonly STORAGE_KEY = TASK_STORAGE_KEY;

  /**
   * Базовая валидация структуры задачи для фильтрации повреждённых элементов в хранилище.
   */
  static isValidBasicTask(item: unknown): item is Task {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.id === 'string' &&
      candidate.id.trim() !== '' &&
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
   * Получение всех задач из хранилища (или пустой массив, если хранилище пусто).
   */
  static getAll(): Task[] {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }
      const raw = localStorage.getItem(TaskRepository.STORAGE_KEY);
      if (raw !== null) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter(TaskRepository.isValidBasicTask);
          }
          // Не-массив — сохраняем поврежденные сырые данные с меткой времени
          const corruptKey = `chronos_tasks_corrupt_${getCurrentTimestamp()}`;
          localStorage.setItem(corruptKey, raw);
          return [];
        } catch (e) {
          console.error('Failed to parse stored tasks:', e);
          const corruptKey = `chronos_tasks_corrupt_${getCurrentTimestamp()}`;
          localStorage.setItem(corruptKey, raw);
          return [];
        }
      }
    } catch (e) {
      console.error('Failed to access stored tasks:', e);
    }
    return [];
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
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TaskRepository.STORAGE_KEY, JSON.stringify(tasks));
      }
    } catch (e) {
      console.error('Failed to store tasks:', e);
    }
  }

  /**
   * Безопасный импорт задач из объекта резервной копии (валидация без самостоятельной записи в хранилище).
   */
  static importFromBackup(data: unknown): Task[] {
    const validated = validateBackup(data);
    return validated.tasks;
  }
}

export default TaskRepository;
