import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  getTodayDate,
  parseDate,
  getDateDaysAgo,
  addDays,
  getYesterdayDate,
  getTomorrowDate,
  isSameDate,
  isBeforeDate,
  isAfterDate,
  getCurrentTimestamp,
  getMsUntilNextLocalMidnight,
} from './date';

describe('Local Date Utility (src/utils/date.ts)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatDate', () => {
    it('корректно форматирует дату в YYYY-MM-DD с ведущими нулями для месяцев и дней < 10', () => {
      // 5 мая 2026 года
      const date = new Date(2026, 4, 5);
      expect(formatDate(date)).toBe('2026-05-05');
    });

    it('корректно форматирует дату с двузначными месяцами и днями', () => {
      // 25 ноября 2026 года
      const date = new Date(2026, 10, 25);
      expect(formatDate(date)).toBe('2026-11-25');
    });

    it('корректно форматирует первое число января (01-01)', () => {
      const date = new Date(2026, 0, 1);
      expect(formatDate(date)).toBe('2026-01-01');
    });

    it('корректно форматирует последний день декабря (12-31)', () => {
      const date = new Date(2026, 11, 31);
      expect(formatDate(date)).toBe('2026-12-31');
    });
  });

  describe('getTodayDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('возвращает локальную дату YYYY-MM-DD независимо от реального времени ПК (fake timers)', () => {
      // Устанавливаем фиксированное системное время: 15 июля 2026 года
      vi.setSystemTime(new Date(2026, 6, 15, 14, 30, 0));
      expect(getTodayDate()).toBe('2026-07-15');
    });

    it('корректно возвращает локальную дату в начале года с ведущими нулями', () => {
      // 1 января 2026 года 00:05
      vi.setSystemTime(new Date(2026, 0, 1, 0, 5, 0));
      expect(getTodayDate()).toBe('2026-01-01');
    });

    it('корректно возвращает локальную дату в конце года', () => {
      // 31 декабря 2026 года 23:55
      vi.setSystemTime(new Date(2026, 11, 31, 23, 55, 0));
      expect(getTodayDate()).toBe('2026-12-31');
    });
  });

  describe('parseDate', () => {
    it('разбирает строку YYYY-MM-DD в локальный объект Date с корректными компонентами', () => {
      const parsed = parseDate('2026-04-09');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(3); // 0-indexed: April = 3
      expect(parsed.getDate()).toBe(9);
    });

    it('обратимо восстанавливается через formatDate', () => {
      const original = '2026-02-28';
      expect(formatDate(parseDate(original))).toBe(original);
    });
  });

  describe('getDateDaysAgo — переходы дат', () => {
    it('корректный переход на предыдущий день (внутри одного месяца)', () => {
      expect(getDateDaysAgo('2026-10-15', 1)).toBe('2026-10-14');
      expect(getDateDaysAgo('2026-05-02', 1)).toBe('2026-05-01');
    });

    it('корректный переход через начало месяца (не високосный год: март -> февраль)', () => {
      // 1 марта 2026 -> 28 февраля 2026
      expect(getDateDaysAgo('2026-03-01', 1)).toBe('2026-02-28');
    });

    it('корректный переход через начало месяца (високосный год: март -> 29 февраля)', () => {
      // 1 марта 2024 -> 29 февраля 2024
      expect(getDateDaysAgo('2024-03-01', 1)).toBe('2024-02-29');
    });

    it('корректный переход через начало месяца с 31 на 30 дней (май -> апрель)', () => {
      // 1 мая 2026 -> 30 апреля 2026
      expect(getDateDaysAgo('2026-05-01', 1)).toBe('2026-04-30');
    });

    it('корректный переход через начало года (1 января -> 31 декабря предыдущего года)', () => {
      // 1 января 2026 -> 31 декабря 2025
      expect(getDateDaysAgo('2026-01-01', 1)).toBe('2025-12-31');
    });

    it('корректный переход на несколько дней назад через начало года', () => {
      // 5 января 2026 - 10 дней -> 26 декабря 2025
      expect(getDateDaysAgo('2026-01-05', 10)).toBe('2025-12-26');
    });

    it('возвращает ту же дату при days = 0', () => {
      expect(getDateDaysAgo('2026-07-15', 0)).toBe('2026-07-15');
    });

    it('корректно переходит вперед при отрицательном days (в будущее)', () => {
      expect(getDateDaysAgo('2026-10-07', -1)).toBe('2026-10-08');
      expect(getDateDaysAgo('2025-12-31', -1)).toBe('2026-01-01');
    });

    it('сохраняет ведущие нули после перехода', () => {
      expect(getDateDaysAgo('2026-01-10', 5)).toBe('2026-01-05');
      expect(getDateDaysAgo('2026-10-01', 1)).toBe('2026-09-30');
    });
  });

  describe('addDays, getYesterdayDate, getTomorrowDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('addDays добавляет дни с переходом через границу месяца и года', () => {
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
      expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    });

    it('getYesterdayDate и getTomorrowDate возвращают вчера и завтра относительно mock-системного времени', () => {
      // Фиксируем системное время на 1 января 2026 года
      vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0));

      expect(getTodayDate()).toBe('2026-01-01');
      expect(getYesterdayDate()).toBe('2025-12-31');
      expect(getTomorrowDate()).toBe('2026-01-02');
    });
  });

  describe('Сравнение календарных дат YYYY-MM-DD', () => {
    it('isSameDate сравнивает строковые даты без преобразования в UTC', () => {
      expect(isSameDate('2026-10-07', '2026-10-07')).toBe(true);
      expect(isSameDate('2026-10-07', '2026-10-08')).toBe(false);
    });

    it('isBeforeDate и isAfterDate корректно сравнивают календарные даты', () => {
      expect(isBeforeDate('2026-10-06', '2026-10-07')).toBe(true);
      expect(isBeforeDate('2026-10-07', '2026-10-07')).toBe(false);
      expect(isBeforeDate('2026-10-08', '2026-10-07')).toBe(false);

      expect(isAfterDate('2026-10-08', '2026-10-07')).toBe(true);
      expect(isAfterDate('2026-10-07', '2026-10-07')).toBe(false);
      expect(isAfterDate('2026-10-06', '2026-10-07')).toBe(false);
    });
  });

  describe('getCurrentTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('возвращает полный ISO 8601 timestamp (UTC) соответствующий системному времени', () => {
      vi.setSystemTime(new Date('2026-10-07T15:30:45.123Z'));
      expect(getCurrentTimestamp()).toBe('2026-10-07T15:30:45.123Z');
    });
  });

  describe('getMsUntilNextLocalMidnight', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('обычный день: корректно вычисляет миллисекунды до локальной полуночи с буфером 100 мс', () => {
      // 7 октября 2026 года, 14:00:00 (ровно 10 часов до полуночи)
      vi.setSystemTime(new Date(2026, 9, 7, 14, 0, 0, 0));

      const ms = getMsUntilNextLocalMidnight();
      const tenHoursAndBuffer = 10 * 60 * 60 * 1000 + 100;
      expect(ms).toBe(tenHoursAndBuffer);
    });

    it('время непосредственно перед полуночью: возвращает корректную короткую задержку с буфером', () => {
      // 7 октября 2026 года, 23:59:59.950 (50 мс до полуночи)
      vi.setSystemTime(new Date(2026, 9, 7, 23, 59, 59, 950));

      const ms = getMsUntilNextLocalMidnight();
      expect(ms).toBe(150); // 50 мс + 100 мс буфер
    });

    it('защитный минимальный интервал: не возвращает 0 или отрицательное значение', () => {
      // Искусственно передаем время в момент/после полуночи
      const now = new Date(2026, 9, 8, 0, 0, 0, 0);
      const ms = getMsUntilNextLocalMidnight(now);
      expect(ms).toBeGreaterThanOrEqual(100);
    });

    it('переход месяца: корректно определяет начало следующего месяца (31 октября -> 1 ноября)', () => {
      // 31 октября 2026 года, 22:00:00 (2 часа до 1 ноября)
      vi.setSystemTime(new Date(2026, 9, 31, 22, 0, 0, 0));

      const ms = getMsUntilNextLocalMidnight();
      const twoHoursAndBuffer = 2 * 60 * 60 * 1000 + 100;
      expect(ms).toBe(twoHoursAndBuffer);

      // Проверяем перемотку по времени
      vi.advanceTimersByTime(ms);
      expect(getTodayDate()).toBe('2026-11-01');
    });

    it('переход года: корректно определяет начало нового года (31 декабря -> 1 января)', () => {
      // 31 декабря 2026 года, 23:00:00 (1 час до 1 января 2027)
      vi.setSystemTime(new Date(2026, 11, 31, 23, 0, 0, 0));

      const ms = getMsUntilNextLocalMidnight();
      const oneHourAndBuffer = 1 * 60 * 60 * 1000 + 100;
      expect(ms).toBe(oneHourAndBuffer);

      // Проверяем перемотку по времени
      vi.advanceTimersByTime(ms);
      expect(getTodayDate()).toBe('2027-01-01');
    });

    it('расчёт использует именно локальную полночь', () => {
      // 7 октября 2026 года, 10:15:30.000
      vi.setSystemTime(new Date(2026, 9, 7, 10, 15, 30, 0));

      const ms = getMsUntilNextLocalMidnight();
      vi.advanceTimersByTime(ms);

      // После перемотки часы должны показывать ровно локальное начало следующего дня + 100 мс
      const advancedDate = new Date();
      expect(advancedDate.getHours()).toBe(0);
      expect(advancedDate.getMinutes()).toBe(0);
      expect(advancedDate.getSeconds()).toBe(0);
      expect(advancedDate.getMilliseconds()).toBe(100);
      expect(getTodayDate()).toBe('2026-10-08');
    });
  });

  describe('Отсутствие использования toISOString() для локальной даты', () => {
    it('ни одна из функций date utility не вызывает toISOString()', () => {
      const isoSpy = vi.spyOn(Date.prototype, 'toISOString');

      // Вызываем все функции utility
      const sampleDate = new Date(2026, 9, 7);
      formatDate(sampleDate);
      getTodayDate();
      parseDate('2026-10-07');
      getDateDaysAgo('2026-10-07', 1);
      addDays('2026-10-07', 2);
      getYesterdayDate();
      getTomorrowDate();
      getMsUntilNextLocalMidnight();

      expect(isoSpy).not.toHaveBeenCalled();
    });

    it('formatDate использует строго локальные методы getFullYear, getMonth, getDate', () => {
      const utcFullYearSpy = vi.spyOn(Date.prototype, 'getUTCFullYear');
      const utcMonthSpy = vi.spyOn(Date.prototype, 'getUTCMonth');
      const utcDateSpy = vi.spyOn(Date.prototype, 'getUTCDate');

      formatDate(new Date(2026, 4, 12));

      expect(utcFullYearSpy).not.toHaveBeenCalled();
      expect(utcMonthSpy).not.toHaveBeenCalled();
      expect(utcDateSpy).not.toHaveBeenCalled();
    });
  });
});
