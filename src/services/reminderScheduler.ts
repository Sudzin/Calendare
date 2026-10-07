/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from '../types';
import { getReminderDateTime } from '../utils/reminder';
import { showNotification } from './notificationService';

export interface ReminderSchedulerOptions {
  notificationsEnabled?: boolean;
  onReminder?: (task: Task) => void;
}

export type TasksProvider = () => Task[];

interface ScheduledItem {
  task: Task;
  timeMs: number;
  key: string;
}

export class ReminderScheduler {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private tasksProvider: TasksProvider = () => [];
  private options: ReminderSchedulerOptions = { notificationsEnabled: true };
  private started = false;
  private notifiedReminders = new Set<string>();

  /**
   * Запускает планировщик напоминаний.
   * При повторном вызове гарантированно перезапускает таймер без создания параллельных процессов.
   */
  start(tasksProvider: TasksProvider, options?: ReminderSchedulerOptions): void {
    this.tasksProvider = tasksProvider;
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this.started = true;
    this.scheduleNext();
  }

  /**
   * Полностью останавливает планировщик и очищает активный таймер.
   */
  stop(): void {
    this.started = false;
    this.clearTimer();
  }

  /**
   * Обновляет настройки планировщика (например, статус notificationsEnabled).
   */
  updateOptions(options: Partial<ReminderSchedulerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Пересчитывает ближайший reminder при изменении списка задач.
   */
  refresh(newTasks?: Task[]): void {
    if (newTasks) {
      this.tasksProvider = () => newTasks;
    }
    if (!this.started) {
      return;
    }
    this.scheduleNext();
  }

  /**
   * Проверяет, активен ли планировщик.
   */
  isRunning(): boolean {
    return this.started;
  }

  /**
   * Сбрасывает историю отправленных напоминаний (полезна для тестов).
   */
  clearNotifiedHistory(): void {
    this.notifiedReminders.clear();
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private getReminderKey(task: Task, timeMs: number): string {
    return `${task.id}:${task.date}:${task.reminderTime || ''}:${timeMs}`;
  }

  private scheduleNext(): void {
    this.clearTimer();

    if (!this.started) {
      return;
    }

    const tasks = this.tasksProvider();
    const now = Date.now();

    const upcoming: ScheduledItem[] = [];

    for (const task of tasks) {
      if (task.status === 'done') {
        continue;
      }
      if (!task.reminderTime) {
        continue;
      }

      const reminderDate = getReminderDateTime(task);
      if (!reminderDate) {
        continue;
      }

      const timeMs = reminderDate.getTime();
      const key = this.getReminderKey(task, timeMs);

      // Игнорируем уже отправленные напоминания
      if (this.notifiedReminders.has(key)) {
        continue;
      }

      // Рассматриваем только будущие напоминания или те, что должны сработать прямо сейчас
      if (timeMs >= now) {
        upcoming.push({ task, timeMs, key });
      }
    }

    if (upcoming.length === 0) {
      // Нет будущих напоминаний — таймер не запускается
      return;
    }

    // Сортируем по времени наступления
    upcoming.sort((a, b) => a.timeMs - b.timeMs);
    const earliestTime = upcoming[0].timeMs;
    const delay = Math.max(0, earliestTime - now);

    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.handleTrigger(earliestTime);
    }, delay);
  }

  private handleTrigger(targetTimeMs: number): void {
    if (!this.started) {
      return;
    }

    const currentTasks = this.tasksProvider();
    const now = Date.now();

    // Находим все актуальные задачи, чьё время напоминания наступило (<= now)
    for (const task of currentTasks) {
      if (task.status === 'done' || !task.reminderTime) {
        continue;
      }

      const reminderDate = getReminderDateTime(task);
      if (!reminderDate) {
        continue;
      }

      const timeMs = reminderDate.getTime();
      const key = this.getReminderKey(task, timeMs);

      // Проверяем, что напоминание актуально для этого срабатывания и еще не отправлено
      if (timeMs <= now && !this.notifiedReminders.has(key)) {
        this.notifiedReminders.add(key);

        const title = `Напоминание: ${task.title}`;
        const body = task.startTime
          ? `Время начала: ${task.startTime}`
          : `Время напоминания: ${task.reminderTime}`;

        const isEnabled = this.options.notificationsEnabled ?? true;
        showNotification(title, { body }, isEnabled);

        if (this.options.onReminder) {
          try {
            this.options.onReminder(task);
          } catch {
            // Изоляция ошибок пользовательского коллбэка
          }
        }
      }
    }

    // Планируем следующее напоминание
    this.scheduleNext();
  }
}

// Экспортируем синглтон для приложения
export const reminderScheduler = new ReminderScheduler();
