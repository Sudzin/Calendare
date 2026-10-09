/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task } from '../types';

/**
 * Каноническая сериализация задачи для детерминированного сравнения при равенстве updatedAt.
 * Ключи сортируются в алфавитном порядке для независимости от порядка объявления полей.
 */
export function canonicalTaskSerialize(task: Task | Record<string, unknown>): string {
  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(task).sort();
  for (const k of keys) {
    const val = (task as Record<string, unknown>)[k];
    if (val !== undefined) {
      sortedObj[k] = val;
    }
  }
  return JSON.stringify(sortedObj);
}

/**
 * Детерминированное слияние двух версий одной и той же задачи (с одинаковым id).
 *
 * Правила:
 * 1. Выигрывает версия с более свежим updatedAt (лексикографическое сравнение ISO-8601).
 * 2. При равенстве updatedAt (или отсутствии) — детерминированное правило по содержимому (каноническая строка).
 *    Результат строго не зависит от порядка аргументов: mergeTaskVersions(a, b) === mergeTaskVersions(b, a).
 */
export function mergeTaskVersions(a: Task, b: Task): Task {
  if (a === b) return a;

  const timeA = a.updatedAt || '';
  const timeB = b.updatedAt || '';

  if (timeA > timeB) {
    return a;
  }
  if (timeB > timeA) {
    return b;
  }

  // При равенстве updatedAt: детерминированное сравнение содержимого
  const strA = canonicalTaskSerialize(a);
  const strB = canonicalTaskSerialize(b);

  if (strA >= strB) {
    return a;
  }
  return b;
}

/**
 * Слияние списка задач (возможно с дубликатами id из разных источников/файлов синхронизации).
 *
 * @param tasks Исходный массив задач (может содержать несколько версий одной задачи)
 * @param includeTombstones Если false (по умолчанию), задачи с deletedAt отбрасываются из результата
 * @returns Детерминированный объединённый список задач без дубликатов
 */
export function mergeTaskLists(tasks: Task[], includeTombstones = false): Task[] {
  const map = new Map<string, Task>();

  for (const task of tasks) {
    if (!task || !task.id) continue;
    const existing = map.get(task.id);
    if (!existing) {
      map.set(task.id, task);
    } else {
      map.set(task.id, mergeTaskVersions(existing, task));
    }
  }

  const result: Task[] = [];
  for (const task of map.values()) {
    if (!includeTombstones && task.deletedAt) {
      continue;
    }
    result.push(task);
  }

  // Детерминированная сортировка по id для стабильности вывода
  result.sort((a, b) => a.id.localeCompare(b.id));

  return result;
}
