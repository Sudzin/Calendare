import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { ReminderScheduler, reminderScheduler } from './reminderScheduler';
import { useReminderScheduler } from '../hooks/useReminderScheduler';
import { Task } from '../types';

function createSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-1',
    title: 'Презентация проекта',
    type: 'timed',
    date: '2026-10-07',
    startTime: '10:00',
    endTime: '11:00',
    priority: 'high',
    status: 'todo',
    notes: '',
    reminderTime: '10:00',
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('Reminder Scheduler Service (src/services/reminderScheduler.ts)', () => {
  let scheduler: ReminderScheduler;
  let originalNotification: typeof Notification | undefined;
  let mockNotificationConstructor: ReturnType<typeof vi.fn<(title: string, options?: NotificationOptions) => void>>;

  // Базовое локальное время: 7 октября 2026 года, 09:30:00
  const BASE_TIME = new Date(2026, 9, 7, 9, 30, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);

    originalNotification = (globalThis as unknown as { Notification?: typeof Notification }).Notification;
    mockNotificationConstructor = vi.fn<(title: string, options?: NotificationOptions) => void>();

    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');
      constructor(title: string, options?: NotificationOptions) {
        mockNotificationConstructor(title, options);
      }
    }

    Object.defineProperty(globalThis, 'Notification', {
      value: MockNotification,
      writable: true,
      configurable: true,
    });

    scheduler = new ReminderScheduler();
  });

  afterEach(() => {
    scheduler.stop();
    if (originalNotification !== undefined) {
      Object.defineProperty(globalThis, 'Notification', {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    } else {
      delete (globalThis as unknown as { Notification?: unknown }).Notification;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. scheduler ставит timeout для ближайшего reminder', () => {
    // Задача 1: 10:00 (через 30 минут)
    const taskNear = createSampleTask({
      id: 'task-near',
      title: 'Ближайшая задача',
      reminderTime: '10:00',
    });
    // Задача 2: 10:30 (через 60 минут)
    const taskFar = createSampleTask({
      id: 'task-far',
      title: 'Дальняя задача',
      reminderTime: '10:30',
    });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    scheduler.start(() => [taskNear, taskFar]);

    // Должен быть запланирован таймаут на 30 минут (1 800 000 мс)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
  });

  it('2. при срабатывании timeout отправляется notification', () => {
    const task = createSampleTask({
      id: 'task-notify',
      title: 'Сдать отчёт',
      startTime: '10:00',
      reminderTime: '10:00',
    });

    scheduler.start(() => [task]);

    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // Перематываем время на 30 минут вперёд (до 10:00)
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      'Напоминание: Сдать отчёт',
      { body: 'Время начала: 10:00' }
    );
  });

  it('3. completed task не вызывает notification', () => {
    // Сценарий A: задача изначально завершена
    const doneTask = createSampleTask({
      id: 'task-done',
      status: 'done',
      reminderTime: '10:00',
    });

    scheduler.start(() => [doneTask]);
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // Сценарий B: задача была активна в момент планирования, но завершена до срабатывания
    let currentTasks = [
      createSampleTask({
        id: 'task-dynamic',
        status: 'todo',
        reminderTime: '10:15',
      }),
    ];

    scheduler.start(() => currentTasks);

    // Пользователь завершил задачу до наступления 10:15
    currentTasks = [{ ...currentTasks[0], status: 'done' }];

    vi.advanceTimersByTime(45 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });

  it('4. отключённые notifications не вызывают реальный показ notification', () => {
    const task = createSampleTask({
      id: 'task-disabled',
      reminderTime: '10:00',
    });

    // Запуск с отключенными уведомлениями в настройках
    scheduler.start(() => [task], { notificationsEnabled: false });

    // Время напоминания наступает
    vi.advanceTimersByTime(30 * 60 * 1000);

    // Пользовательский контракт: реальное создание и показ Browser Notification не происходит
    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });

  it('5. stop() полностью очищает timeout', () => {
    const task = createSampleTask({
      id: 'task-stop',
      reminderTime: '10:00',
    });

    scheduler.start(() => [task]);
    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);

    // Перематываем время через момент напоминания
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });

  it('6. повторный start() не создаёт несколько параллельных timers', () => {
    const task = createSampleTask({
      id: 'task-start-dup',
      reminderTime: '10:00',
    });

    // Троекратный запуск подряд
    scheduler.start(() => [task]);
    scheduler.start(() => [task]);
    scheduler.start(() => [task]);

    // Срабатывание в 10:00
    vi.advanceTimersByTime(30 * 60 * 1000);

    // Уведомление должно быть показано строго один раз
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
  });

  it('7. refresh() пересчитывает ближайший reminder', () => {
    // Изначально одна дальняя задача на 10:30 (через 60 минут)
    const taskFar = createSampleTask({
      id: 'task-far',
      title: 'Дальняя',
      reminderTime: '10:30',
    });

    scheduler.start(() => [taskFar]);

    // Появилась более близкая задача на 09:45 (через 15 минут)
    const taskNear = createSampleTask({
      id: 'task-near',
      title: 'Срочная',
      reminderTime: '09:45',
    });

    scheduler.refresh([taskFar, taskNear]);

    // Продвигаем время на 15 минут (до 09:45)
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      'Напоминание: Срочная',
      expect.any(Object)
    );

    // Продвигаем еще на 45 минут (до 10:30)
    vi.advanceTimersByTime(45 * 60 * 1000);

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(2);
    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      'Напоминание: Дальняя',
      expect.any(Object)
    );
  });

  it('8. одна задача не вызывает одно и то же reminder дважды', () => {
    const task = createSampleTask({
      id: 'task-single-fire',
      reminderTime: '10:00',
    });

    scheduler.start(() => [task]);

    // Срабатывание в 10:00
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);

    // Вызываем refresh повторно после срабатывания
    scheduler.refresh([task]);

    // Продвигаем время ещё на час вперёд
    vi.advanceTimersByTime(60 * 60 * 1000);

    // Повторного вызова быть не должно
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
  });

  it('9. напоминание через 40 дней не вызывает цикла перепланирования (задержка ограничена 2_147_483_647, число вызовов setTimeout ограничено)', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    // Напоминание через 40 дней (16 ноября 2026, 09:30)
    const taskIn40Days = createSampleTask({
      id: 'task-40-days',
      date: '2026-11-16',
      startTime: '10:00',
      reminderTime: '09:30',
    });

    scheduler.start(() => [taskIn40Days]);

    // Таймер должен быть выставлен с задержкой не более 2_147_483_647 ms
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 2_147_483_647);

    // Продвигаем время на 25 дней (~2.16 млрд мс)
    vi.advanceTimersByTime(25 * 24 * 60 * 60 * 1000);

    // Первый таймер истёк и запланировал остаток времени (~15 дней)
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // Продвигаем оставшиеся 16 дней
    vi.advanceTimersByTime(16 * 24 * 60 * 60 * 1000);

    // Напоминание успешно сработало, количество вызовов setTimeout строго ограничено (не зациклилось)
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('10. включение notificationsEnabled: true до наступления reminder показывает уведомление ровно один раз', () => {
    // 1. Scheduler запущен с notificationsEnabled: false
    const task = createSampleTask({
      id: 'task-toggle-on',
      title: 'Важная встреча',
      startTime: '10:00',
      reminderTime: '10:00',
    });

    scheduler.start(() => [task], { notificationsEnabled: false });

    // 2. Есть активная задача с ближайшим reminder (в 10:00, сейчас 09:30)
    // 3. До reminder (например, в 09:45, прошло 15 минут) уведомление не показывается
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // 4. Затем scheduler обновляется с notificationsEnabled: true
    scheduler.updateOptions({ notificationsEnabled: true });
    scheduler.refresh([task]);

    // 5. Тот же reminder наступает (ещё 15 минут, до 10:00)
    vi.advanceTimersByTime(15 * 60 * 1000);

    // 6. Уведомление показывается ровно один раз
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      'Напоминание: Важная встреча',
      { body: 'Время начала: 10:00' }
    );

    // Проверяем, что в дальнейшем уведомление не дублируется
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
  });

  it('11. отключение notificationsEnabled: false до наступления reminder предотвращает показ уведомления', () => {
    // 1. Scheduler запущен с notificationsEnabled: true
    const task = createSampleTask({
      id: 'task-toggle-off',
      title: 'Тихая задача',
      startTime: '10:00',
      reminderTime: '10:00',
    });

    scheduler.start(() => [task], { notificationsEnabled: true });

    // 2. Есть активная задача с reminder (в 10:00, сейчас 09:30)
    // До reminder уведомление не показывается
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // 3. До reminder настройки меняются на false
    scheduler.updateOptions({ notificationsEnabled: false });
    scheduler.refresh([task]);

    // 4. Reminder наступает (ещё 15 минут, до 10:00)
    vi.advanceTimersByTime(15 * 60 * 1000);

    // 5. Уведомление не показывается
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // Продвигаем время ещё дальше
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });

  it('12. refresh() после изменения настроек отменяет предыдущий таймаут и не создаёт два таймаута для одного reminder', () => {
    const task = createSampleTask({
      id: 'task-refresh-timer',
      title: 'Проверка таймеров',
      reminderTime: '10:00',
    });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    scheduler.start(() => [task], { notificationsEnabled: false });
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    const initialTimerId = (scheduler as unknown as { timerId: ReturnType<typeof setTimeout> }).timerId;
    expect(initialTimerId).not.toBeNull();

    // Прошло 10 минут
    vi.advanceTimersByTime(10 * 60 * 1000);

    // Обновляем настройки и вызываем refresh()
    scheduler.updateOptions({ notificationsEnabled: true });
    scheduler.refresh([task]);

    // Предыдущий таймер был явно очищен через clearTimeout
    expect(clearTimeoutSpy).toHaveBeenCalledWith(initialTimerId);

    // Назначен новый скорректированный таймаут
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

    // При наступлении времени reminder срабатывает ровно одно уведомление (нет дублирования от двух таймеров)
    vi.advanceTimersByTime(20 * 60 * 1000);
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);

    // При дальнейшем движении времени уведомление не дублируется
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
  });
});

function renderHook<T>(hookFn: () => T) {
  let hookIndex = 0;
  const refList: any[] = [];
  const effectCallbacks: { fn: () => void | (() => void); deps?: unknown[] }[] = [];
  const cleanups: (() => void)[] = [];
  let isMounted = true;
  const result = { current: undefined as unknown as T };

  const dispatcher = {
    useState: <S>(initial: S | (() => S)) => [initial, () => {}],
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

describe('useReminderScheduler Hook integration (src/hooks/useReminderScheduler.ts)', () => {
  let originalNotification: typeof Notification | undefined;
  let mockNotificationConstructor: ReturnType<typeof vi.fn<(title: string, options?: NotificationOptions) => void>>;
  const BASE_TIME = new Date(2026, 9, 7, 9, 30, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    reminderScheduler.stop();
    reminderScheduler.clearNotifiedHistory();

    originalNotification = (globalThis as unknown as { Notification?: typeof Notification }).Notification;
    mockNotificationConstructor = vi.fn<(title: string, options?: NotificationOptions) => void>();

    class MockNotification {
      static permission: NotificationPermission = 'granted';
      static requestPermission = vi.fn().mockResolvedValue('granted');
      constructor(title: string, options?: NotificationOptions) {
        mockNotificationConstructor(title, options);
      }
    }

    Object.defineProperty(globalThis, 'Notification', {
      value: MockNotification,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    reminderScheduler.stop();
    if (originalNotification !== undefined) {
      Object.defineProperty(globalThis, 'Notification', {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    } else {
      delete (globalThis as unknown as { Notification?: unknown }).Notification;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('при переключении notificationsEnabled с false на true в хуке уведомление показывается ровно один раз', () => {
    const task = createSampleTask({
      id: 'hook-task-toggle',
      title: 'Задача из хука',
      startTime: '10:00',
      reminderTime: '10:00',
    });

    let currentProps = { tasks: [task], notificationsEnabled: false };
    const { rerender } = renderHook(() =>
      useReminderScheduler(currentProps.tasks, { notificationsEnabled: currentProps.notificationsEnabled })
    );

    // До reminder уведомление не показывается
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // Меняем настройки на notificationsEnabled: true
    currentProps = { tasks: [task], notificationsEnabled: true };
    rerender();

    // Reminder наступает в 10:00
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
    expect(mockNotificationConstructor).toHaveBeenCalledWith(
      'Напоминание: Задача из хука',
      { body: 'Время начала: 10:00' }
    );

    // В дальнейшем не дублируется
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
  });

  it('при переключении notificationsEnabled с true на false в хуке уведомление не показывается', () => {
    const task = createSampleTask({
      id: 'hook-task-off',
      title: 'Задача без уведомления',
      startTime: '10:00',
      reminderTime: '10:00',
    });

    let currentProps = { tasks: [task], notificationsEnabled: true };
    const { rerender } = renderHook(() =>
      useReminderScheduler(currentProps.tasks, { notificationsEnabled: currentProps.notificationsEnabled })
    );

    // До reminder уведомление не показывается
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(mockNotificationConstructor).not.toHaveBeenCalled();

    // Меняем настройки на notificationsEnabled: false
    currentProps = { tasks: [task], notificationsEnabled: false };
    rerender();

    // Reminder наступает в 10:00
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(mockNotificationConstructor).not.toHaveBeenCalled();
  });
});
