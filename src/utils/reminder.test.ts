import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getReminderDateTime } from './reminder';
import { Task } from '../types';

function createSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-reminder',
    title: 'Тестовая задача',
    type: 'timed',
    date: '2026-10-07',
    startTime: '09:00',
    endTime: '10:00',
    priority: 'high',
    status: 'todo',
    notes: '',
    reminderTime: '08:45',
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
    ...overrides,
  };
}

describe('Reminder Time Calculation (src/utils/reminder.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getReminderDateTime', () => {
    it('задача с reminderTime → возвращает корректный локальный момент Date', () => {
      const task = createSampleTask({
        date: '2026-10-07',
        reminderTime: '08:45',
        status: 'todo',
      });

      const reminderMoment = getReminderDateTime(task);

      expect(reminderMoment).not.toBeNull();
      expect(reminderMoment instanceof Date).toBe(true);

      // Проверяем компоненты в локальном часовом поясе
      expect(reminderMoment?.getFullYear()).toBe(2026);
      expect(reminderMoment?.getMonth()).toBe(9); // Октябрь = 9 (0-indexed)
      expect(reminderMoment?.getDate()).toBe(7);
      expect(reminderMoment?.getHours()).toBe(8);
      expect(reminderMoment?.getMinutes()).toBe(45);
      expect(reminderMoment?.getSeconds()).toBe(0);
      expect(reminderMoment?.getMilliseconds()).toBe(0);
    });

    it('задача без reminderTime (undefined или пустая строка) → возвращает null', () => {
      const taskWithoutReminder = createSampleTask({
        reminderTime: undefined,
      });
      expect(getReminderDateTime(taskWithoutReminder)).toBeNull();

      const taskWithEmptyReminder = createSampleTask({
        reminderTime: '',
      });
      expect(getReminderDateTime(taskWithEmptyReminder)).toBeNull();

      const taskWithWhitespaceReminder = createSampleTask({
        reminderTime: '   ',
      });
      expect(getReminderDateTime(taskWithWhitespaceReminder)).toBeNull();
    });

    it('завершённая задача (status === "done") → возвращает null', () => {
      const completedTask = createSampleTask({
        date: '2026-10-07',
        reminderTime: '08:45',
        status: 'done',
      });

      expect(getReminderDateTime(completedTask)).toBeNull();
    });

    describe('корректная работа на границах суток', () => {
      it('начало суток: 00:00 (полночь)', () => {
        const midnightTask = createSampleTask({
          date: '2026-01-01',
          reminderTime: '00:00',
          status: 'todo',
        });

        const moment = getReminderDateTime(midnightTask);

        expect(moment).not.toBeNull();
        expect(moment?.getFullYear()).toBe(2026);
        expect(moment?.getMonth()).toBe(0); // Январь
        expect(moment?.getDate()).toBe(1);
        expect(moment?.getHours()).toBe(0);
        expect(moment?.getMinutes()).toBe(0);
        expect(moment?.getSeconds()).toBe(0);
      });

      it('конец суток: 23:59', () => {
        const endOfDayTask = createSampleTask({
          date: '2026-12-31',
          reminderTime: '23:59',
          status: 'in_progress',
        });

        const moment = getReminderDateTime(endOfDayTask);

        expect(moment).not.toBeNull();
        expect(moment?.getFullYear()).toBe(2026);
        expect(moment?.getMonth()).toBe(11); // Декабрь
        expect(moment?.getDate()).toBe(31);
        expect(moment?.getHours()).toBe(23);
        expect(moment?.getMinutes()).toBe(59);
        expect(moment?.getSeconds()).toBe(0);
      });
    });

    describe('корректная работа с форматом YYYY-MM-DD + HH:mm', () => {
      it('корректно парсит различные комбинации часов и минут с ведущими нулями и без', () => {
        const task1 = createSampleTask({ date: '2026-03-05', reminderTime: '09:05' });
        const moment1 = getReminderDateTime(task1);
        expect(moment1?.getDate()).toBe(5);
        expect(moment1?.getMonth()).toBe(2);
        expect(moment1?.getHours()).toBe(9);
        expect(moment1?.getMinutes()).toBe(5);

        const task2 = createSampleTask({ date: '2026-11-20', reminderTime: '17:30' });
        const moment2 = getReminderDateTime(task2);
        expect(moment2?.getDate()).toBe(20);
        expect(moment2?.getMonth()).toBe(10);
        expect(moment2?.getHours()).toBe(17);
        expect(moment2?.getMinutes()).toBe(30);
      });

      it('возвращает null при некорректном формате времени (24:00, 12:60, буквы)', () => {
        expect(getReminderDateTime(createSampleTask({ reminderTime: '24:00' }))).toBeNull();
        expect(getReminderDateTime(createSampleTask({ reminderTime: '12:60' }))).toBeNull();
        expect(getReminderDateTime(createSampleTask({ reminderTime: 'invalid' }))).toBeNull();
        expect(getReminderDateTime(createSampleTask({ reminderTime: '12' }))).toBeNull();
        expect(getReminderDateTime(createSampleTask({ reminderTime: '12:00:00' }))).toBeNull();
      });
    });

    describe('работа с опциональным referenceDate', () => {
      it('использует referenceDate как дату задачи, если у задачи не указана дата', () => {
        const taskWithoutDate = {
          date: '',
          reminderTime: '14:20',
          status: 'todo' as const,
        };
        const refDate = new Date(2026, 7, 19, 10, 0, 0); // 19 августа 2026

        const moment = getReminderDateTime(taskWithoutDate, refDate);

        expect(moment?.getFullYear()).toBe(2026);
        expect(moment?.getMonth()).toBe(7);
        expect(moment?.getDate()).toBe(19);
        expect(moment?.getHours()).toBe(14);
        expect(moment?.getMinutes()).toBe(20);
      });
    });
  });
});

