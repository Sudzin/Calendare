import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as React from 'react';
import { useTasks } from './useTasks';
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
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }
}

const mockStorage = new LocalStorageMock();

function renderHook<T>(hookFn: () => T) {
  let hookIndex = 0;
  const stateList: any[] = [];
  const refList: any[] = [];
  const effectCallbacks: { fn: () => void | (() => void); deps?: unknown[]; prevDeps?: unknown[] }[] = [];
  const cleanups: (() => void)[] = [];
  let isMounted = true;
  const result = { current: undefined as unknown as T };

  const dispatcher = {
    useState: <S>(initial: S | (() => S)) => {
      const idx = hookIndex++;
      if (idx >= stateList.length) {
        stateList[idx] = typeof initial === 'function' ? (initial as () => S)() : initial;
      }
      const setState = (val: S | ((prev: S) => S)) => {
        stateList[idx] = typeof val === 'function' ? (val as (prev: S) => S)(stateList[idx]) : val;
        // Trigger re-render synchronously for tests
        execute();
      };
      return [stateList[idx], setState];
    },
    useRef: <V>(initial: V) => {
      const idx = hookIndex++;
      if (idx >= refList.length) {
        refList[idx] = { current: initial };
      }
      return refList[idx];
    },
    useCallback: <F extends Function>(fn: F) => fn,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      const idx = hookIndex++;
      if (!isMounted) return;
      const prevEntry = effectCallbacks[idx];
      let hasChanged = true;
      if (prevEntry && prevEntry.deps && deps) {
        hasChanged = deps.some((d, i) => !Object.is(d, prevEntry.deps![i]));
      }
      if (hasChanged) {
        if (cleanups[idx]) {
          cleanups[idx]();
        }
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups[idx] = cleanup;
        }
      }
      effectCallbacks[idx] = { fn: effect, deps };
    },
  };

  const execute = () => {
    hookIndex = 0;
    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const prevDispatcher = internals?.H;
    internals.H = dispatcher;
    try {
      result.current = hookFn();
    } finally {
      internals.H = prevDispatcher;
    }
  };

  execute();

  return {
    result,
    rerender: () => {
      if (!isMounted) return;
      execute();
    },
    unmount: () => {
      isMounted = false;
      for (const cleanup of cleanups) {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      }
    },
  };
}

describe('useTasks hook', () => {
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

  it('инициализирует список задач из TaskRepository.getAll() и синхронизирует в localStorage через useEffect', () => {
    const initialTask: Task = {
      id: 'task-init',
      title: 'Начальная задача',
      type: 'floating',
      date: '2026-10-07',
      priority: 'high',
      status: 'todo',
      notes: '',
      pomodoroCount: 0,
      createdAt: '2026-10-07T10:00:00.000Z',
      updatedAt: '2026-10-07T10:00:00.000Z',
    };
    mockStorage.setItem(TASK_STORAGE_KEY, JSON.stringify([initialTask]));

    const { result } = renderHook(() => useTasks());

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe('task-init');

    // useEffect синхронизировал в localStorage
    const stored = JSON.parse(mockStorage.getItem(TASK_STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('task-init');
  });

  it('не вызывает TaskRepository.saveAll при первичном монтировании', () => {
    const saveAllSpy = vi.spyOn(TaskRepository, 'saveAll');
    renderHook(() => useTasks());
    expect(saveAllSpy).not.toHaveBeenCalled();
    saveAllSpy.mockRestore();
  });

  it('addTask добавляет задачу и сохраняет через useEffect', () => {
    const saveAllSpy = vi.spyOn(TaskRepository, 'saveAll');
    const { result } = renderHook(() => useTasks());

    // Начальный вызов эффекта при монтировании не производит запись в localStorage
    expect(saveAllSpy).not.toHaveBeenCalled();

    const newTask = result.current.addTask({
      title: 'Новая задача',
      type: 'floating',
      date: '2026-10-07',
      priority: 'medium',
      status: 'todo',
      notes: '',
      pomodoroCount: 0,
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe(newTask.id);
    expect(result.current.tasks[0].title).toBe('Новая задача');

    // useEffect сработал после изменения tasks
    expect(saveAllSpy).toHaveBeenCalledTimes(1);
    expect(saveAllSpy).toHaveBeenLastCalledWith(result.current.tasks);

    saveAllSpy.mockRestore();
  });

  it('updateTask обновляет задачу и сохраняет через useEffect', () => {
    const { result } = renderHook(() => useTasks());

    const task = result.current.addTask({
      title: 'До изменения',
      type: 'floating',
      date: '2026-10-07',
      priority: 'medium',
      status: 'todo',
      notes: '',
      pomodoroCount: 0,
    });

    const updated = result.current.updateTask({
      id: task.id,
      title: 'После изменения',
      status: 'done',
    });

    expect(updated.title).toBe('После изменения');
    expect(result.current.tasks[0].title).toBe('После изменения');
    expect(result.current.tasks[0].status).toBe('done');

    const stored = JSON.parse(mockStorage.getItem(TASK_STORAGE_KEY)!);
    expect(stored[0].title).toBe('После изменения');
  });

  it('updateTask возвращает актуальный объект задачи и поддерживает последовательные обновления', () => {
    const { result } = renderHook(() => useTasks());

    const task = result.current.addTask({
      title: 'Задача для проверки обновления',
      type: 'floating',
      date: '2026-10-07',
      priority: 'low',
      status: 'todo',
      notes: '',
      pomodoroCount: 0,
    });

    const firstUpdate = result.current.updateTask({
      id: task.id,
      title: 'Заголовок изменен',
      priority: 'high',
    });

    expect(firstUpdate).toBeDefined();
    expect(firstUpdate.id).toBe(task.id);
    expect(firstUpdate.title).toBe('Заголовок изменен');
    expect(firstUpdate.priority).toBe('high');
    expect(result.current.tasks[0].title).toBe('Заголовок изменен');

    const secondUpdate = result.current.updateTask({
      id: task.id,
      status: 'done',
    });

    expect(secondUpdate).toBeDefined();
    expect(secondUpdate.status).toBe('done');
    expect(secondUpdate.title).toBe('Заголовок изменен');
    expect(result.current.tasks[0].status).toBe('done');
  });

  it('deleteTask удаляет задачу через TaskRepository.delete и сохраняет через useEffect', () => {
    const deleteSpy = vi.spyOn(TaskRepository, 'delete');
    const { result } = renderHook(() => useTasks());

    const task = result.current.addTask({
      title: 'Удаляемая задача',
      type: 'floating',
      date: '2026-10-07',
      priority: 'low',
      status: 'todo',
      notes: '',
      pomodoroCount: 0,
    });

    expect(result.current.tasks).toHaveLength(1);

    result.current.deleteTask(task.id);

    expect(deleteSpy).toHaveBeenCalledWith(task.id, expect.any(Array));
    expect(result.current.tasks).toHaveLength(0);
    const stored = JSON.parse(mockStorage.getItem(TASK_STORAGE_KEY)!);
    expect(stored).toEqual([]);

    deleteSpy.mockRestore();
  });

  it('setAllTasks заменяет все задачи и сохраняет через useEffect', () => {
    const { result } = renderHook(() => useTasks());

    const taskList: Task[] = [
      {
        id: 't-1',
        title: 'Задача 1',
        type: 'floating',
        date: '2026-10-07',
        priority: 'low',
        status: 'todo',
        notes: '',
        pomodoroCount: 0,
        createdAt: '2026-10-07T10:00:00.000Z',
        updatedAt: '2026-10-07T10:00:00.000Z',
      },
      {
        id: 't-2',
        title: 'Задача 2',
        type: 'floating',
        date: '2026-10-07',
        priority: 'high',
        status: 'done',
        notes: '',
        pomodoroCount: 0,
        createdAt: '2026-10-07T10:00:00.000Z',
        updatedAt: '2026-10-07T10:00:00.000Z',
      },
    ];

    result.current.setAllTasks(taskList);

    expect(result.current.tasks).toHaveLength(2);
    const stored = JSON.parse(mockStorage.getItem(TASK_STORAGE_KEY)!);
    expect(stored).toHaveLength(2);
    expect(stored.map((t: Task) => t.id)).toEqual(['t-1', 't-2']);
  });
});
