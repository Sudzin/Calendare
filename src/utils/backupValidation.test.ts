import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateBackup, validateTask } from './backupValidation';
import { TaskRepository, TASK_STORAGE_KEY } from '../repositories/TaskRepository';
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

const createValidTask = (overrides?: Partial<Task>): Task => ({
  id: 'valid-task-1',
  title: 'Корректная задача',
  type: 'floating',
  date: '2026-10-07',
  priority: 'high',
  status: 'todo',
  notes: 'Заметки',
  createdAt: '2026-10-07T10:00:00.000Z',
  updatedAt: '2026-10-07T10:00:00.000Z',
  ...overrides,
});

describe('Валидация резервной копии (backupValidation)', () => {
  describe('1. Корректный backup', () => {
    it('успешно валидирует корректный backup со всеми обязательными и опциональными полями', () => {
      const validTask1 = createValidTask({ id: 'task-1', title: 'Задача 1' });
      const validTask2 = createValidTask({
        id: 'task-2',
        title: 'Задача 2 с таймингом',
        type: 'timed',
        startTime: '10:00',
        endTime: '11:00',
        priority: 'critical',
        status: 'in_progress',
        isEscalated: true,
        escalationReason: 'Перенос со вчера',
        rolloverCount: 1,
        pomodoroCount: 3,
      });

      const backup = {
        version: '2.0',
        exportedAt: '2026-10-07T12:00:00.000Z',
        settings: { soundEnabled: true },
        tasks: [validTask1, validTask2],
      };

      const result = validateBackup(backup);
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('task-1');
      expect(result.tasks[1].id).toBe('task-2');
      expect(result.tasks[1].startTime).toBe('10:00');
      expect(result.tasks[1].isEscalated).toBe(true);
      expect(result.tasks[1].pomodoroCount).toBe(3);
    });

    it('успешно валидирует минимальный backup с пустым массивом задач', () => {
      const backup = { tasks: [] };
      const result = validateBackup(backup);
      expect(result.tasks).toEqual([]);
    });
  });

  describe('2. Отсутствующий или некорректный массив задач', () => {
    it('отклоняет данные, если они не являются объектом (null, строка, примитив)', () => {
      expect(() => validateBackup(null)).toThrow('данные должны быть объектом');
      expect(() => validateBackup('invalid string')).toThrow('данные должны быть объектом');
      expect(() => validateBackup(12345)).toThrow('данные должны быть объектом');
      expect(() => validateBackup([createValidTask()])).toThrow('данные должны быть объектом');
    });

    it('отклоняет backup без поля tasks', () => {
      const backupWithoutTasks = {
        version: '2.0',
        exportedAt: '2026-10-07T12:00:00.000Z',
      };
      expect(() => validateBackup(backupWithoutTasks)).toThrow('отсутствует массив задач "tasks"');
    });

    it('отклоняет backup, где tasks не является массивом', () => {
      const backupWithInvalidTasks = {
        tasks: 'not an array',
      };
      expect(() => validateBackup(backupWithInvalidTasks)).toThrow('отсутствует массив задач "tasks"');
    });
  });

  describe('3. Задача без обязательного id', () => {
    it('отклоняет задачу, у которой отсутствует id', () => {
      const { id: _, ...taskWithoutId } = createValidTask();
      const backup = { tasks: [taskWithoutId] };

      expect(() => validateBackup(backup)).toThrow('отсутствует или некорректно обязательное поле "id"');
    });

    it('отклоняет задачу с пустым id', () => {
      const taskWithEmptyId = createValidTask({ id: '   ' });
      const backup = { tasks: [taskWithEmptyId] };

      expect(() => validateBackup(backup)).toThrow('отсутствует или некорректно обязательное поле "id"');
    });
  });

  describe('4. Задача с неправильным типом поля', () => {
    it('отклоняет задачу с нестроковым title', () => {
      const invalidTask = { ...createValidTask(), title: 12345 };
      const backup = { tasks: [invalidTask] };

      expect(() => validateBackup(backup)).toThrow('обязательное поле "title" (ожидается строка)');
    });

    it('отклоняет задачу с невалидным статусом', () => {
      const invalidTask = { ...createValidTask(), status: 'unknown_status' };
      const backup = { tasks: [invalidTask] };

      expect(() => validateBackup(backup)).toThrow('некорректное поле "status"');
    });

    it('отклоняет задачу с невалидным приоритетом', () => {
      const invalidTask = { ...createValidTask(), priority: 'super_high' };
      const backup = { tasks: [invalidTask] };

      expect(() => validateBackup(backup)).toThrow('некорректное поле "priority"');
    });

    it('отклоняет задачу с невалидным типом задачи (type)', () => {
      const invalidTask = { ...createValidTask(), type: 'unsupported_type' };
      const backup = { tasks: [invalidTask] };

      expect(() => validateBackup(backup)).toThrow('некорректное поле "type"');
    });

    it('отклоняет задачу с неправильным типом опционального поля (например, число вместо boolean в isEscalated)', () => {
      const invalidTask = { ...createValidTask(), isEscalated: 'not-a-boolean' };
      const backup = { tasks: [invalidTask] };

      expect(() => validateBackup(backup)).toThrow('некорректный тип опционального поля "isEscalated" (ожидается boolean)');
    });

    it('отклоняет элемент массива задач, если он не является объектом', () => {
      const backup = { tasks: ['string-instead-of-task-object'] };
      expect(() => validateBackup(backup)).toThrow('данные должны быть объектом');
    });
  });

  describe('5. Гарантия сохранения существующих данных при ошибке импорта', () => {
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

    it('при ошибке импорта существующие данные в хранилище НЕ изменяются', () => {
      const existingTask = createValidTask({ id: 'existing-task-1', title: 'Существующая пользовательская задача' });
      TaskRepository.saveAll([existingTask]);

      expect(TaskRepository.getAll()).toHaveLength(1);
      expect(TaskRepository.getById('existing-task-1')).toEqual(existingTask);

      // Битый backup: задача с некорректным полем
      const brokenBackup = {
        tasks: [
          createValidTask({ id: 'new-valid-task' }),
          { ...createValidTask({ id: 'broken-task' }), priority: 'invalid_priority' },
        ],
      };

      expect(() => {
        TaskRepository.importFromBackup(brokenBackup);
      }).toThrow('некорректное поле "priority"');

      // Данные в хранилище должны остаться в точности прежними
      const tasksAfterFailedImport = TaskRepository.getAll();
      expect(tasksAfterFailedImport).toHaveLength(1);
      expect(tasksAfterFailedImport[0]).toEqual(existingTask);
      expect(TaskRepository.getById('new-valid-task')).toBeUndefined();
      expect(TaskRepository.getById('broken-task')).toBeUndefined();
    });

    it('при успешном импорте данные корректно перезаписываются', () => {
      const initialTask = createValidTask({ id: 'old-task', title: 'Старая задача' });
      TaskRepository.saveAll([initialTask]);

      const importedTask = createValidTask({ id: 'imported-task', title: 'Импортированная задача' });
      const validBackup = { tasks: [importedTask] };

      const result = TaskRepository.importFromBackup(validBackup);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('imported-task');

      const allInStore = TaskRepository.getAll();
      expect(allInStore).toHaveLength(1);
      expect(allInStore[0].id).toBe('imported-task');
      expect(TaskRepository.getById('old-task')).toBeUndefined();
    });
  });
});
