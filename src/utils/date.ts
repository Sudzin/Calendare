/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility-модуль для работы с локальными календарными датами (YYYY-MM-DD).
 *
 * Правила:
 * - Календарная дата задачи: YYYY-MM-DD.
 * - Все календарные даты (сегодня, вчера, дата задачи, rollover) вычисляются
 *   исключительно в ЛОКАЛЬНОМ часовом поясе пользователя.
 * - UTC и toISOString() НЕ используются для вычисления локальной календарной даты.
 * - Сравнение календарных дат выполняется лексикографически ('YYYY-MM-DD').
 */

/**
 * Форматирует объект Date в локальную календарную дату формата 'YYYY-MM-DD'.
 * Использует локальные методы getFullYear(), getMonth(), getDate() без UTC.
 */
export function formatDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Возвращает сегодняшнюю календарную дату в локальном часовом поясе в формате 'YYYY-MM-DD'.
 */
export function getTodayDate(): string {
  return formatDate(new Date());
}

/**
 * Разбирает строку календарной даты 'YYYY-MM-DD' в локальный объект Date.
 * Инициализирует дату в полдень (12:00:00) по локальному времени для защиты
 * от сдвигов при переходе на летнее/зимнее время (DST).
 */
export function parseDate(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Вычисляет дату, отстоящую на `days` дней назад относительно заданной даты.
 * При отрицательном `days` смещает дату вперед (в будущее).
 * Корректно обрабатывает смену месяца, високосные годы и смену года.
 *
 * @param date - исходная дата в формате 'YYYY-MM-DD'
 * @param days - количество дней назад
 */
export function getDateDaysAgo(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

/**
 * Вычисляет дату, отстоящую на `days` дней вперед относительно заданной даты.
 */
export function addDays(date: string, days: number): string {
  return getDateDaysAgo(date, -days);
}

/**
 * Возвращает вчерашнюю календарную дату в формате 'YYYY-MM-DD'.
 */
export function getYesterdayDate(): string {
  return getDateDaysAgo(getTodayDate(), 1);
}

/**
 * Возвращает завтрашнюю календарную дату в формате 'YYYY-MM-DD'.
 */
export function getTomorrowDate(): string {
  return getDateDaysAgo(getTodayDate(), -1);
}

/**
 * Проверяет равенство двух календарных дат ('YYYY-MM-DD').
 */
export function isSameDate(dateA: string, dateB: string): boolean {
  return dateA === dateB;
}

/**
 * Проверяет, предшествует ли дата A дате B ('YYYY-MM-DD').
 */
export function isBeforeDate(dateA: string, dateB: string): boolean {
  return dateA < dateB;
}

/**
 * Проверяет, следует ли дата A за датой B ('YYYY-MM-DD').
 */
export function isAfterDate(dateA: string, dateB: string): boolean {
  return dateA > dateB;
}

// Алиасы для совместимости с существующим кодом
export const toDateString = formatDate;
export const parseDateString = parseDate;
