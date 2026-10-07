/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, TaskPriority } from '../types';
import { isBeforeDate, getCurrentTimestamp } from './date';
import { getNextPriority } from './priorityUtils';

export interface EscalationRecord {
  task: Task;
  oldPriority: string;
  newPriority: string;
}

export interface RolloverResult {
  updatedTasks: Task[];
  escalatedRecords: EscalationRecord[];
}

/**
 * Проверяет, есть ли среди задач незавершённые задачи старше целевой даты.
 */
export function hasOverdueTasks(tasks: Task[], targetDate: string): boolean {
  return tasks.some(t => isBeforeDate(t.date, targetDate) && t.status !== 'done');
}

/**
 * Чистая бизнес-функция переноса задач (rollover).
 *
 * Правила:
 * - Незавершённые задачи прошлых дат (date < targetDate) переносятся на targetDate.
 * - Завершённые задачи (status === 'done') не переносятся.
 * - Задачи на targetDate и будущие даты не изменяются.
 * - Приоритет задачи повышается на 1 уровень (low -> medium -> high -> critical).
 * - Приоритет critical остаётся critical.
 * - Поле isEscalated устанавливается в true.
 * - rolloverCount увеличивается на 1.
 * - escalationReason заполняется описанием переноса.
 * - updatedAt обновляется до текущего момента.
 * - Исходный массив задач не мутируется.
 *
 * @param tasks - исходный список задач
 * @param targetDate - целевая календарная дата в формате YYYY-MM-DD
 * @returns результат с новым массивом задач и списком записей эскалации
 */
export function rolloverTasks(tasks: Task[], targetDate: string): RolloverResult {
  const escalatedRecords: EscalationRecord[] = [];

  const updatedTasks = tasks.map(t => {
    if (isBeforeDate(t.date, targetDate) && t.status !== 'done') {
      const oldPriority = t.priority;
      const newPriority = getNextPriority(t.priority);

      const updatedTask: Task = {
        ...t,
        date: targetDate,
        priority: newPriority,
        isEscalated: true,
        escalationReason: `Авто-перенос с ${t.date} (+1 уровень приоритета)`,
        rolloverCount: (t.rolloverCount || 0) + 1,
        updatedAt: getCurrentTimestamp(),
      };

      escalatedRecords.push({
        task: updatedTask,
        oldPriority,
        newPriority,
      });

      return updatedTask;
    }
    return t;
  });

  return {
    updatedTasks,
    escalatedRecords,
  };
}

// Алиас для удобства
export const performRollover = rolloverTasks;
