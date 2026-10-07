import { Task } from '../types';

export const TASK_STORAGE_KEY = 'chronos_tasks';

export class TaskRepository {
  static readonly STORAGE_KEY = TASK_STORAGE_KEY;

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
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse stored tasks:', e);
    }
    return [];
  }

  /**
   * Получение задачи по ID.
   */
  static getById(id: string): Task | undefined {
    return TaskRepository.getAll().find(t => t.id === id);
  }

  /**
   * Создание новой задачи и сохранение в хранилище.
   */
  static create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task {
    const id = taskData.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'task-' + Date.now());
    const now = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id,
      createdAt: taskData.createdAt ?? now,
      updatedAt: taskData.updatedAt ?? now,
    } as Task;

    const currentTasks = TaskRepository.getAll();
    const updatedTasks = [newTask, ...currentTasks.filter(t => t.id !== id)];
    TaskRepository.saveAll(updatedTasks);
    return newTask;
  }

  /**
   * Обновление существующей задачи в хранилище.
   */
  static update(updated: Task): Task {
    const withUpdatedTime: Task = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    const currentTasks = TaskRepository.getAll();
    const updatedTasks = currentTasks.map(t => (t.id === updated.id ? withUpdatedTime : t));
    TaskRepository.saveAll(updatedTasks);
    return withUpdatedTime;
  }

  /**
   * Удаление задачи по ID из хранилища.
   */
  static delete(taskId: string): void {
    const currentTasks = TaskRepository.getAll();
    const updatedTasks = currentTasks.filter(t => t.id !== taskId);
    TaskRepository.saveAll(updatedTasks);
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

  // Алиасы для расширенной совместимости
  static getAllTasks(): Task[] { return TaskRepository.getAll(); }
  static getTaskById(id: string): Task | undefined { return TaskRepository.getById(id); }
  static createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task { return TaskRepository.create(taskData); }
  static updateTask(task: Task): Task { return TaskRepository.update(task); }
  static deleteTask(taskId: string): void { TaskRepository.delete(taskId); }
  static saveTasks(tasks: Task[]): void { TaskRepository.saveAll(tasks); }

  // Экземплярные методы для работы через объект
  getAll(): Task[] { return TaskRepository.getAll(); }
  getAllTasks(): Task[] { return TaskRepository.getAll(); }
  getById(id: string): Task | undefined { return TaskRepository.getById(id); }
  getTaskById(id: string): Task | undefined { return TaskRepository.getById(id); }
  create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task { return TaskRepository.create(taskData); }
  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Task, 'id' | 'createdAt' | 'updatedAt'>>): Task { return TaskRepository.create(taskData); }
  update(task: Task): Task { return TaskRepository.update(task); }
  updateTask(task: Task): Task { return TaskRepository.update(task); }
  delete(taskId: string): void { TaskRepository.delete(taskId); }
  deleteTask(taskId: string): void { TaskRepository.delete(taskId); }
  saveAll(tasks: Task[]): void { TaskRepository.saveAll(tasks); }
  saveTasks(tasks: Task[]): void { TaskRepository.saveAll(tasks); }
}

export const taskRepository = new TaskRepository();
export default TaskRepository;
