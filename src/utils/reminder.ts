/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from '../types';
import { parseDate, formatDate } from './date';

/**
 * Определяет точный локальный момент напоминания для задачи.
 *
 * Правила:
 * - Календарная дата задачи: YYYY-MM-DD.
 * - Время напоминания: HH:mm.
 * - Вычисление происходит строго в ЛОКАЛЬНОМ часовом поясе пользователя.
 * - UTC и toISOString() НЕ используются для определения календарного дня и времени.
 * - Если reminderTime отсутствует, пуст или некорректен — возвращает null.
 * - Если задача завершена (status === 'done') — напоминание не требуется, возвращает null.
 *
 * @param task - задача (обязательные поля: date, reminderTime, опционально status)
 * @param referenceDate - опциональная контрольная дата (используется как fallback, если у задачи не указана date)
 * @returns Date объект момента напоминания в локальном часовом поясе или null
 */
export function getReminderDateTime(
  task: Pick<Task, 'date' | 'reminderTime'> & Partial<Pick<Task, 'status'>>,
  referenceDate?: Date
): Date | null {
  if (!task.reminderTime || typeof task.reminderTime !== 'string' || task.reminderTime.trim() === '') {
    return null;
  }

  // Завершённая задача не требует напоминаний
  if (task.status === 'done') {
    return null;
  }

  const parts = task.reminderTime.trim().split(':');
  if (parts.length !== 2) {
    return null;
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const dateStr = task.date || (referenceDate ? formatDate(referenceDate) : '');
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const baseDate = parseDate(dateStr);
  if (isNaN(baseDate.getTime())) {
    return null;
  }

  // Создаём локальный момент времени с нулевыми секундами и миллисекундами
  const reminderDateTime = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes,
    0,
    0
  );

  return isNaN(reminderDateTime.getTime()) ? null : reminderDateTime;
}
