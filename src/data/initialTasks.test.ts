import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getInitialTasks } from './initialTasks';

describe('initialTasks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('возвращает задачи с корректными локальными датами и ISO-таймстемпами', () => {
    vi.setSystemTime(new Date('2026-10-07T14:30:00.000Z'));

    const tasks = getInitialTasks();
    expect(tasks.length).toBeGreaterThan(0);

    const isoTimestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const localDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const task of tasks) {
      expect(task.date).toMatch(localDateRegex);
      expect(task.createdAt).toMatch(isoTimestampRegex);
      expect(task.updatedAt).toMatch(isoTimestampRegex);
      expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(task.updatedAt))).toBe(false);
    }
  });
});
