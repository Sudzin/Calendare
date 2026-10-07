import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReminderScheduler } from './reminderScheduler';
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
});
