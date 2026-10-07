import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskRepository, TASK_STORAGE_KEY } from './TaskRepository';
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

    it('контракт жизненного цикла: пустое хранилище возвращает [], create не пишет в хранилище сам, saveAll сохраняет', () => {
      // 1. При первом запуске (storage пустой) возвращается [] без автоматических demo-задач
      expect(TaskRepository.getAll()).toEqual([]);

      // 2. create() создаёт объект задачи, но репозиторий не пишет в хранилище сам
      const created = TaskRepository.create({
        title: 'Первая задача пользователя',
        type: 'floating',
        date: '2026-10-07',
        priority: 'medium',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      expect(TaskRepository.getAll()).toEqual([]);

      // 3. После явного saveAll задача появляется в хранилище
      TaskRepository.saveAll([created]);
      const tasksAfterSave = TaskRepository.getAll();
      expect(tasksAfterSave).toHaveLength(1);
      expect(tasksAfterSave[0].id).toBe(created.id);
      expect(tasksAfterSave[0].title).toBe('Первая задача пользователя');

      // 4. После сохранения пустого массива хранилище снова возвращает []
      TaskRepository.saveAll([]);
      expect(TaskRepository.getAll()).toEqual([]);
    });

    it('возвращает сохранённые задачи', () => {
      const task = createSampleTask();
      TaskRepository.saveAll([task]);

      const tasks = TaskRepository.getAll();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task.id);
      expect(tasks[0].title).toBe(task.title);
    });

    it('при синтаксической ошибке JSON сохраняет сырую строку в chronos_tasks_corrupt_<ISO> и возвращает []', () => {
      const corruptRaw = '{invalid-json, not closed';
      mockStorage.setItem(TASK_STORAGE_KEY, corruptRaw);

      const tasks = TaskRepository.getAll();
      expect(tasks).toEqual([]);

      // Проверяем, что в localStorage появился ключ с префиксом chronos_tasks_corrupt_
      const allKeys = Array.from({ length: mockStorage.length }, (_, i) => mockStorage.key(i)!);
      const corruptKey = allKeys.find(k => k.startsWith('chronos_tasks_corrupt_'));
      expect(corruptKey).toBeDefined();
      expect(mockStorage.getItem(corruptKey!)).toBe(corruptRaw);
    });

    it('при валидном JSON, но не-массиве сохраняет сырую строку в chronos_tasks_corrupt_<ISO> и возвращает []', () => {
      const notAnArrayRaw = JSON.stringify({ error: 'not an array', count: 42 });
      mockStorage.setItem(TASK_STORAGE_KEY, notAnArrayRaw);

      const tasks = TaskRepository.getAll();
      expect(tasks).toEqual([]);

      const allKeys = Array.from({ length: mockStorage.length }, (_, i) => mockStorage.key(i)!);
      const corruptKey = allKeys.find(k => k.startsWith('chronos_tasks_corrupt_'));
      expect(corruptKey).toBeDefined();
      expect(mockStorage.getItem(corruptKey!)).toBe(notAnArrayRaw);
    });

    it('фильтрует элементы массива, не прошедшие базовую проверку (id, title, date, status, priority)', () => {
      const validTask1 = createSampleTask({ id: 'valid-1', title: 'Задача 1' });
      const validTask2 = createSampleTask({ id: 'valid-2', title: 'Задача 2' });

      const mixedData = [
        validTask1,
        null,
        'строка вместо задачи',
        12345,
        {},
        { id: '', title: 'Нет ID', date: '2026-10-07', status: 'todo', priority: 'low' },
        { id: 'bad-1', date: '2026-10-07', status: 'todo', priority: 'low' }, // нет title
        { id: 'bad-2', title: 'Нет даты', status: 'todo', priority: 'low' }, // нет date
        { id: 'bad-3', title: 'Нет статуса', date: '2026-10-07', priority: 'low' }, // нет status
        { id: 'bad-4', title: 'Нет приоритета', date: '2026-10-07', status: 'todo' }, // нет priority
        validTask2,
      ];

      mockStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(mixedData));

      const tasks = TaskRepository.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.id)).toEqual(['valid-1', 'valid-2']);
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
      expect(typeof newTask.id).toBe('string');
      expect(newTask.id.length).toBeGreaterThan(0);
      expect(newTask.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(newTask.title).toBe('Новая задача');
      expect(newTask.createdAt).toBeDefined();
      expect(newTask.updatedAt).toBeDefined();
    });

    it('устанавливает валидные ISO timestamp для createdAt и updatedAt при создании', () => {
      const task = TaskRepository.create({
        title: 'Задача с временными метками',
        type: 'floating',
        date: '2026-10-07',
        priority: 'medium',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(task.createdAt).toMatch(isoRegex);
      expect(task.updatedAt).toMatch(isoRegex);
      expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(task.updatedAt))).toBe(false);
    });

    it('два последовательно созданных объекта получают разные ID', () => {
      const task1 = TaskRepository.create({
        title: 'Первая задача',
        type: 'floating',
        date: '2026-10-07',
        priority: 'medium',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      const task2 = TaskRepository.create({
        title: 'Вторая задача',
        type: 'floating',
        date: '2026-10-07',
        priority: 'medium',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      expect(task1.id).toBeDefined();
      expect(task2.id).toBeDefined();
      expect(task1.id).not.toBe(task2.id);
    });

    it('ID не зависит от времени выполнения (уникальность при фиксированном системном времени)', () => {
      const fixedTimestamp = 1700000000000;
      const originalDateNow = Date.now;

      try {
        // Замораживаем Date.now на фиксированном миллисекундном значении
        Date.now = () => fixedTimestamp;

        const taskA = TaskRepository.create({
          title: 'Задача в фиксированное время A',
          type: 'floating',
          date: '2026-10-07',
          priority: 'low',
          status: 'todo',
          notes: '',
          pomodoroCount: 0,
        });

        const taskB = TaskRepository.create({
          title: 'Задача в фиксированное время B',
          type: 'floating',
          date: '2026-10-07',
          priority: 'low',
          status: 'todo',
          notes: '',
          pomodoroCount: 0,
        });

        // Даже если системное время зафиксировано, ID генерируются через crypto.randomUUID()
        expect(taskA.id).not.toBe(taskB.id);
        expect(taskA.id).not.toContain(String(fixedTimestamp));
        expect(taskB.id).not.toContain(String(fixedTimestamp));
        expect(taskA.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(taskB.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('TaskRepository.generateId генерирует валидные и уникальные UUID', () => {
      const id1 = TaskRepository.generateId();
      const id2 = TaskRepository.generateId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(id1).toMatch(uuidRegex);
      expect(id2).toMatch(uuidRegex);
      expect(id1).not.toBe(id2);
    });

    it('create не пишет в хранилище сам (getAll остаётся пустым)', () => {
      const newTask = TaskRepository.create({
        title: 'Задача для проверки create',
        type: 'timed',
        date: '2026-10-07',
        startTime: '10:00',
        endTime: '11:00',
        priority: 'critical',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
      });

      expect(newTask.id).toBeDefined();
      expect(TaskRepository.getAll()).toEqual([]);
    });

    it('существующие задачи в хранилище не затрагиваются при create', () => {
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

      expect(created.id).toBeDefined();
      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(2);
      expect(allTasks.map(t => t.id)).toEqual(['task-1', 'task-2']);
    });
  });

  describe('4. Обновление (update)', () => {
    it('изменяет существующую задачу и не пишет в хранилище сам', () => {
      const task = createSampleTask({ id: 'task-edit', title: 'До изменения', status: 'todo' });
      TaskRepository.saveAll([task]);

      const updated = TaskRepository.update({
        ...task,
        title: 'После изменения',
        status: 'done',
      });

      expect(updated.title).toBe('После изменения');
      expect(updated.status).toBe('done');

      // Репозиторий не пишет в хранилище сам — в хранилище остаётся прежнее состояние
      const found = TaskRepository.getById('task-edit');
      expect(found?.title).toBe('До изменения');
      expect(found?.status).toBe('todo');
    });

    it('возвращает обновленный объект с тем же ID', () => {
      const task = createSampleTask({ id: 'task-dup-check', title: 'Исходная' });
      TaskRepository.saveAll([task]);

      const updated = TaskRepository.update({
        ...task,
        title: 'Обновленная',
      });

      expect(updated.id).toBe('task-dup-check');
      expect(updated.title).toBe('Обновленная');
    });

    it('остальные задачи остаются без изменений', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      const task2 = createSampleTask({ id: 'task-2', title: 'Задача 2', priority: 'low' });
      TaskRepository.saveAll([task1, task2]);

      const updated = TaskRepository.update({
        ...task1,
        title: 'Задача 1 изменена',
      });

      expect(updated.title).toBe('Задача 1 изменена');
      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(2);

      const unchangedTask2 = TaskRepository.getById('task-2');
      expect(unchangedTask2).toEqual(task2);
    });

    it('автоматически обновляет updatedAt при вызове update, даже если передано старое значение', () => {
      const oldUpdatedAt = '2020-01-01T00:00:00.000Z';
      const task = createSampleTask({ id: 'task-time-check', updatedAt: oldUpdatedAt });
      TaskRepository.saveAll([task]);

      // Вызывающий код передаёт старый updatedAt
      const updated = TaskRepository.update({
        ...task,
        title: 'Обновленный заголовок',
        updatedAt: oldUpdatedAt,
      });

      expect(updated.updatedAt).not.toBe(oldUpdatedAt);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(oldUpdatedAt).getTime());
    });

    it('не требует передачи updatedAt от вызывающего кода (updatedAt обновляется автоматически)', () => {
      const originalTime = '2025-05-01T12:00:00.000Z';
      const task = createSampleTask({ id: 'task-no-updated-at', updatedAt: originalTime });
      TaskRepository.saveAll([task]);

      // Удаляем updatedAt из переданного объекта (проверка типов TypeScript и runtime)
      const { updatedAt: _removed, ...taskWithoutUpdatedAt } = task;

      const updated = TaskRepository.update({
        ...taskWithoutUpdatedAt,
        title: 'Задача без ручного updatedAt',
      });

      expect(updated.updatedAt).toBeDefined();
      expect(typeof updated.updatedAt).toBe('string');
      expect(updated.updatedAt).not.toBe(originalTime);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(originalTime).getTime());
    });

    it('поддерживает частичное обновление по ID с автоматической установкой updatedAt', () => {
      const task = createSampleTask({ id: 'task-partial', title: 'Старый заголовок', status: 'todo' });
      TaskRepository.saveAll([task]);

      const updated = TaskRepository.update({
        id: 'task-partial',
        status: 'done',
      });

      expect(updated.id).toBe('task-partial');
      expect(updated.title).toBe('Старый заголовок'); // сохранил прежнее поле
      expect(updated.status).toBe('done');
      expect(updated.updatedAt).toBeDefined();
    });

    it('игнорирует поля со значением undefined при слиянии', () => {
      const task = createSampleTask({
        id: 'task-undefined-check',
        title: 'Исходный заголовок',
        notes: 'Исходные заметки',
        priority: 'high',
        status: 'todo',
        startTime: '10:00',
        endTime: '11:00',
      });
      TaskRepository.saveAll([task]);

      const updated = TaskRepository.update({
        id: 'task-undefined-check',
        title: 'Обновленный заголовок',
        notes: undefined,
        startTime: undefined,
        status: undefined,
      });

      expect(updated.id).toBe('task-undefined-check');
      expect(updated.title).toBe('Обновленный заголовок');
      // Поля со значением undefined были проигнорированы и сохранили исходные значения
      expect(updated.notes).toBe('Исходные заметки');
      expect(updated.startTime).toBe('10:00');
      expect(updated.endTime).toBe('11:00');
      expect(updated.status).toBe('todo');
      expect(updated.priority).toBe('high');
    });

    it('выбрасывает ошибку при попытке обновить несуществующую задачу и не меняет хранилище', () => {
      const existingTask = createSampleTask({ id: 'task-existing-1', title: 'Существующая задача' });
      TaskRepository.saveAll([existingTask]);

      expect(() => {
        TaskRepository.update({
          id: 'non-existent-id-999',
          title: 'Попытка обновления несуществующей задачи',
        });
      }).toThrow('Task not found: non-existent-id-999');

      // Проверяем, что количество задач и существующая задача не изменились
      const allTasks = TaskRepository.getAll();
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0]).toEqual(existingTask);
      expect(TaskRepository.getById('task-existing-1')).toEqual(existingTask);
      expect(TaskRepository.getById('non-existent-id-999')).toBeUndefined();
    });
  });

  describe('5. Удаление (delete)', () => {
    it('удаляет нужную задачу из списка', () => {
      const task1 = createSampleTask({ id: 'task-to-delete' });
      const task2 = createSampleTask({ id: 'task-keep' });

      const filtered = TaskRepository.delete('task-to-delete', [task1, task2]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('task-keep');
    });

    it('остальные задачи остаются после удаления', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      const task2 = createSampleTask({ id: 'task-2', title: 'Задача 2' });
      const task3 = createSampleTask({ id: 'task-3', title: 'Задача 3' });

      const filtered = TaskRepository.delete('task-2', [task1, task2, task3]);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(t => t.id)).toEqual(['task-1', 'task-3']);
    });

    it('удаление неизвестного ID не ломает список', () => {
      const task1 = createSampleTask({ id: 'task-1', title: 'Задача 1' });
      const filtered = TaskRepository.delete('non-existent-id', [task1]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('task-1');
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
});
