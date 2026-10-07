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
} from './date';

describe('Local Date Utility (src/utils/date.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
