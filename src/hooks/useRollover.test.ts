import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { useRollover } from './useRollover';
import { Task } from '../types';

function createSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-1',
    title: 'Тестовая задача',
    type: 'floating',
    date: '2026-10-06',
    priority: 'low',
    status: 'todo',
    notes: '',
    pomodoroCount: 0,
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * Легковесный тестовый раннер для хуков React в среде Node без необходимости в DOM / JSDOM.
 * Симулирует монтирование, эффекты (useEffect) и размонтирование (cleanup).
 */
function renderHook<T>(hookFn: () => T) {
  let hookIndex = 0;
  const stateList: any[] = [];
  const refList: any[] = [];
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
    useEffect: (effect: () => void | (() => void)) => {
      const idx = hookIndex++;
      if (!isMounted) return;
      if (cleanups[idx] === undefined) {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups[idx] = cleanup;
        }
      }
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

describe('useRollover hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. rollover выполняется при первоначальном запуске при наличии просроченных задач', () => {
    // 7 октября 2026 года, 15:00:00
    vi.setSystemTime(new Date(2026, 9, 7, 15, 0, 0, 0));

    const onTasksUpdated = vi.fn();
    const pushNotification = vi.fn();
    const overdueTask = createSampleTask({ id: 'overdue-1', date: '2026-10-06' });

    renderHook(() =>
      useRollover([overdueTask], onTasksUpdated, pushNotification, false, true)
    );

    expect(onTasksUpdated).toHaveBeenCalledTimes(1);
    expect(onTasksUpdated).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'overdue-1',
          date: '2026-10-07',
          priority: 'medium',
          isEscalated: true,
        }),
      ])
    );
    expect(pushNotification).toHaveBeenCalledWith('Перенос долгов', expect.any(String));
  });

  it('2. rollover выполняется после перехода на следующий локальный день (полночь)', () => {
    // 7 октября 2026 года, 23:50:00 (10 минут до полуночи)
    vi.setSystemTime(new Date(2026, 9, 7, 23, 50, 0, 0));

    const onTasksUpdated = vi.fn();
    const pushNotification = vi.fn();
    const todayTask = createSampleTask({ id: 'today-task', date: '2026-10-07' });

    renderHook(() =>
      useRollover([todayTask], onTasksUpdated, pushNotification, false, true)
    );

    // До полуночи задача на сегодня не просрочена
    expect(onTasksUpdated).not.toHaveBeenCalled();

    // Перематываем таймеры через полночь (10 минут и 1 секунда)
    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

    // Теперь задача со вчерашнего дня должна быть перенесена на 8 октября
    expect(onTasksUpdated).toHaveBeenCalledTimes(1);
    expect(onTasksUpdated).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'today-task',
          date: '2026-10-08',
          priority: 'medium',
          isEscalated: true,
        }),
      ])
    );
  });

  it('3. rollover не выполняется дважды для одного перехода дня', () => {
    // 7 октября 2026 года, 23:55:00
    vi.setSystemTime(new Date(2026, 9, 7, 23, 55, 0, 0));

    const onTasksUpdated = vi.fn();
    const pushNotification = vi.fn();
    const todayTask = createSampleTask({ id: 'task-1', date: '2026-10-07' });

    renderHook(() =>
      useRollover([todayTask], onTasksUpdated, pushNotification, false, true)
    );

    expect(onTasksUpdated).not.toHaveBeenCalled();

    // Переходим через полночь (5 минут и 1 секунда)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    expect(onTasksUpdated).toHaveBeenCalledTimes(1);

    // Продвигаем время еще дальше в рамках того же дня (на 4 часа)
    vi.advanceTimersByTime(4 * 60 * 60 * 1000);

    // Повторного вызова быть не должно
    expect(onTasksUpdated).toHaveBeenCalledTimes(1);
  });

  it('4. после unmount таймер не вызывает rollover', () => {
    // 7 октября 2026 года, 23:55:00
    vi.setSystemTime(new Date(2026, 9, 7, 23, 55, 0, 0));

    const onTasksUpdated = vi.fn();
    const pushNotification = vi.fn();
    const todayTask = createSampleTask({ id: 'task-unmount', date: '2026-10-07' });

    const harness = renderHook(() =>
      useRollover([todayTask], onTasksUpdated, pushNotification, false, true)
    );

    // Размонтируем хук до наступления полуночи
    harness.unmount();

    // Перематываем время через полночь
    vi.advanceTimersByTime(10 * 60 * 1000);

    // Callback не должен был вызваться
    expect(onTasksUpdated).not.toHaveBeenCalled();
  });

  it('5. тесты не зависят от реальной текущей даты (произвольная дата в будущем)', () => {
    // 15 марта 2030 года, 23:59:00
    vi.setSystemTime(new Date(2030, 2, 15, 23, 59, 0, 0));

    const onTasksUpdated = vi.fn();
    const pushNotification = vi.fn();
    const task2030 = createSampleTask({ id: 'task-2030', date: '2030-03-15' });

    renderHook(() =>
      useRollover([task2030], onTasksUpdated, pushNotification, false, true)
    );

    expect(onTasksUpdated).not.toHaveBeenCalled();

    // Переход через полночь на 16 марта 2030
    vi.advanceTimersByTime(65 * 1000);

    expect(onTasksUpdated).toHaveBeenCalledTimes(1);
    expect(onTasksUpdated).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'task-2030',
          date: '2030-03-16',
        }),
      ])
    );
  });
});
