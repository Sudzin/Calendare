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
 * Проверяет, есть ли среди задач незавершённые задачи старше целевой даты (исключая done и postponed).
 */
export function hasOverdueTasks(tasks: Task[], targetDate: string): boolean {
  return tasks.some(
    t => !t.deletedAt && isBeforeDate(t.date, targetDate) && t.status !== 'done' && t.status !== 'postponed'
  );
}

/**
 * Чистая бизнес-функция переноса задач (rollover).
 *
 * Правила:
 * - Удалённые задачи (deletedAt) не переносятся.
 * - Незавершённые задачи прошлых дат (date < targetDate) переносятся на targetDate.
 * - Завершённые задачи (status === 'done') и отложенные задачи (status === 'postponed') не переносятся и не эскалируются.
 * - Задачи на targetDate и будущие даты не изменяются.
 * - Задача, уже перенесённая на targetDate (lastRolloverDate === targetDate), повторно не эскалируется.
 * - Приоритет задачи повышается на 1 уровень (low -> medium -> high -> critical).
 * - Приоритет critical остаётся critical.
 * - Поле isEscalated устанавливается в true.
 * - rolloverCount увеличивается на 1.
 * - lastRolloverDate устанавливается в targetDate.
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
    if (
      !t.deletedAt &&
      isBeforeDate(t.date, targetDate) &&
      t.status !== 'done' &&
      t.status !== 'postponed' &&
      t.lastRolloverDate !== targetDate
    ) {
      const oldPriority = t.priority;
      const newPriority = getNextPriority(t.priority);

      const updatedTask: Task = {
        ...t,
        date: targetDate,
        priority: newPriority,
        isEscalated: true,
        escalationReason: `Авто-перенос с ${t.date} (+1 уровень приоритета)`,
        rolloverCount: (t.rolloverCount || 0) + 1,
        lastRolloverDate: targetDate,
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
