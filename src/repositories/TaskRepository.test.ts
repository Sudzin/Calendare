import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskRepository, taskRepository, TASK_STORAGE_KEY } from './TaskRepository';
import { Task } from '../types';

class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

const mockStorage = new LocalStorageMock();

// Helper to construct valid test tasks
const createSampleTask = (overrides?: Partial<Task>): Task => ({
  id: 'test-1',
  title: 'Тестовая задача',
  type: 'floating',
  date: '2026-10-07',
  priority: 'medium',
  status: 'todo',
  notes: 'Тестовые заметки',
  pomodoroCount: 0,
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-07T10:00:00.000Z',
  ...overrides,
});

describe('TaskRepository', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    mockStorage.clear();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe('1. Получение задач (getAll)', () => {
    it('возвращает пустой массив, если хранилище пустое', () => {
      const tasks = TaskRepository.getAll();
      expect(tasks).toEqual([]);
    });

    it('возвращает сохранённые задачи', () => {
      const task = createSampleTask();
      TaskRepository.saveAll([task]);

      const tasks = TaskRepository.getAll();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task.id);
      expect(tasks[0].title).toBe(task.title);
    });

    it('возвращает пустой массив при некорректном JSON в хранилище без падения', () => {
      mockStorage.setItem(TASK_STORAGE_KEY, '{invalid-json');
      const tasks = TaskRepository.getAll();
      expect(tasks).toEqual([]);
    });

    it('корректно работает с несколькими задачами', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      const task2 = createSampleTask({ id: 'task-2', title: 'Задача 2', priority: 'high' });
      const task3 = createSampleTask({ id: 'task-3', title: 'Задача 3', status: 'done' });
      TaskRepository.saveAll([task1, task2, task3]);

      const tasks = TaskRepository.getAll();
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.id)).toEqual(['task-1', 'task-2', 'task-3']);
    });
  });

  describe('2. Получение по ID (getById)', () => {
    it('возвращает существующую задачу', () => {
      const task = createSampleTask({ id: 'task-target', title: 'Целевая задача' });
      TaskRepository.saveAll([task]);

      const found = TaskRepository.getById('task-target');
      expect(found).toBeDefined();
      expect(found?.id).toBe('task-target');
      expect(found?.title).toBe('Целевая задача');
    });

    it('возвращает undefined для неизвестного ID', () => {
      const task = createSampleTask({ id: 'task-existing' });
      TaskRepository.saveAll([task]);

      const notFound = TaskRepository.getById('unknown-id-999');
      expect(notFound).toBeUndefined();
    });

    it('возвращает undefined, если хранилище пустое', () => {
      const notFound = TaskRepository.getById('any-id');
      expect(notFound).toBeUndefined();
    });
  });

  describe('3. Создание (create)', () => {
    it('добавляет новую задачу и возвращает её', () => {
      const newTask = TaskRepository.create({
        title: 'Новая задача',
        type: 'floating',
        date: '2026-10-07',
        priority: 'high',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      expect(newTask).toBeDefined();
      expect(newTask.id).toBeDefined();
      expect(newTask.title).toBe('Новая задача');
      expect(newTask.createdAt).toBeDefined();
      expect(newTask.updatedAt).toBeDefined();
    });

    it('после создания задача появляется в getAll()', () => {
      const newTask = TaskRepository.create({
        title: 'Задача для проверки getAll',
        type: 'timed',
        date: '2026-10-07',
        startTime: '10:00',
        endTime: '11:00',
        priority: 'critical',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].id).toBe(newTask.id);
      expect(allTasks[0].title).toBe('Задача для проверки getAll');
    });

    it('существующие задачи не удаляются при создании новой', () => {
      const existingTask1 = createSampleTask({ id: 'task-1', title: 'Существующая 1' });
      const existingTask2 = createSampleTask({ id: 'task-2', title: 'Существующая 2' });
      TaskRepository.saveAll([existingTask1, existingTask2]);

      const created = TaskRepository.create({
        title: 'Новая третья задача',
        type: 'floating',
        date: '2026-10-07',
        priority: 'low',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(3);
      expect(allTasks.some(t => t.id === existingTask1.id)).toBe(true);
      expect(allTasks.some(t => t.id === existingTask2.id)).toBe(true);
      expect(allTasks.some(t => t.id === created.id)).toBe(true);
    });
  });

  describe('4. Обновление (update)', () => {
    it('изменяет существующую задачу', () => {
      const task = createSampleTask({ id: 'task-edit', title: 'До изменения', status: 'todo' });
      TaskRepository.saveAll([task]);

      const updated = TaskRepository.update({
        ...task,
        title: 'После изменения',
        status: 'done',
      });

      expect(updated.title).toBe('После изменения');
      expect(updated.status).toBe('done');

      const found = TaskRepository.getById('task-edit');
      expect(found?.title).toBe('После изменения');
      expect(found?.status).toBe('done');
    });

    it('не создаёт неожиданную дубликатную задачу', () => {
      const task = createSampleTask({ id: 'task-dup-check', title: 'Исходная' });
      TaskRepository.saveAll([task]);

      TaskRepository.update({
        ...task,
        title: 'Обновленная',
      });

      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].id).toBe('task-dup-check');
      expect(allTasks[0].title).toBe('Обновленная');
    });

    it('остальные задачи остаются без изменений', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      const task2 = createSampleTask({ id: 'task-2', title: 'Задача 2', priority: 'low' });
      TaskRepository.saveAll([task1, task2]);

      TaskRepository.update({
        ...task1,
        title: 'Задача 1 изменена',
      });

      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(2);

      const unchangedTask2 = TaskRepository.getById('task-2');
      expect(unchangedTask2).toEqual(task2);
    });
  });

  describe('5. Удаление (delete)', () => {
    it('удаляет нужную задачу', () => {
      const task = createSampleTask({ id: 'task-to-delete' });
      TaskRepository.saveAll([task]);

      TaskRepository.delete('task-to-delete');

      expect(TaskRepository.getById('task-to-delete')).toBeUndefined();
      expect(TaskRepository.getAll()).toEqual([]);
    });

    it('остальные задачи остаются после удаления', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      const task2 = createSampleTask({ id: 'task-2', title: 'Задача 2' });
      const task3 = createSampleTask({ id: 'task-3', title: 'Задача 3' });
      TaskRepository.saveAll([task1, task2, task3]);

      TaskRepository.delete('task-2');

      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(2);
      expect(allTasks.map(t => t.id)).toEqual(['task-1', 'task-3']);
      expect(TaskRepository.getById('task-2')).toBeUndefined();
    });

    it('удаление неизвестного ID не ломает repository', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      TaskRepository.saveAll([task1]);

      expect(() => {
        TaskRepository.delete('non-existent-id');
      }).not.toThrow();

      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].id).toBe('task-1');
    });
  });

  describe('6. Сохранение (localStorage persistence)', () => {
    it('данные действительно записываются в используемый localStorage', () => {
      const task = createSampleTask({ id: 'task-persist', title: 'Сохраняемая задача' });
      TaskRepository.saveAll([task]);

      const raw = mockStorage.getItem(TASK_STORAGE_KEY);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('task-persist');
      expect(parsed[0].title).toBe('Сохраняемая задача');
    });

    it('сохранение пустого массива корректно перезаписывает localStorage', () => {
      const task = createSampleTask();
      TaskRepository.saveAll([task]);
      expect(TaskRepository.getAll()).toHaveLength(1);

      TaskRepository.saveAll([]);
      const raw = mockStorage.getItem(TASK_STORAGE_KEY);
      expect(raw).toBe('[]');
      expect(TaskRepository.getAll()).toEqual([]);
    });
  });

  describe('7. Экземплярные методы (taskRepository instance)', () => {
    it('методы экземпляра дублируют статическое API', () => {
      expect(taskRepository.getAll()).toEqual([]);

      const created = taskRepository.create({
        title: 'Создано через экземпляр',
        type: 'floating',
        date: '2026-10-07',
        priority: 'high',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      expect(taskRepository.getById(created.id)).toBeDefined();
      expect(taskRepository.getAll()).toHaveLength(1);

      taskRepository.update({ ...created, title: 'Обновлено через экземпляр' });
      expect(taskRepository.getById(created.id)?.title).toBe('Обновлено через экземпляр');

      taskRepository.delete(created.id);
      expect(taskRepository.getAll()).toEqual([]);
    });
  });
});
