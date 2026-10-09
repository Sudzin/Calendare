import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rolloverTasks, hasOverdueTasks, EscalationRecord } from './rollover';
import { Task } from '../types';

function createSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-1',
    title: 'Тестовая задача',
    type: 'floating',
    date: '2026-10-06',
    priority: 'low',
    status: 'todo',
    notes: '',
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
    ...overrides,
  };
}

describe('Pure Rollover Logic (src/utils/rollover.ts)', () => {
  const targetToday = '2026-10-07';
  const fixedNow = '2026-10-07T12:34:56.789Z';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedNow));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('вчерашняя незавершённая задача → переносится на сегодня с повышением приоритета', () => {
    const yesterdayTask = createSampleTask({
      id: 'task-yesterday',
      date: '2026-10-06',
      priority: 'low',
      status: 'todo',
    });

    const result = rolloverTasks([yesterdayTask], targetToday);

    expect(result.updatedTasks).toHaveLength(1);
    expect(result.escalatedRecords).toHaveLength(1);

    const updated = result.updatedTasks[0];
    expect(updated.date).toBe(targetToday);
    expect(updated.priority).toBe('medium');
    expect(updated.isEscalated).toBe(true);
    expect(updated.escalationReason).toBe('Авто-перенос с 2026-10-06 (+1 уровень приоритета)');
    expect(updated.rolloverCount).toBe(1);
    expect(updated.updatedAt).toBe(fixedNow);
  });

  it('задача двухдневной давности → также корректно обрабатывается согласно текущим правилам', () => {
    const twoDaysAgoTask = createSampleTask({
      id: 'task-2-days-ago',
      date: '2026-10-05',
      priority: 'medium',
      status: 'in_progress',
      rolloverCount: 1,
    });

    const result = rolloverTasks([twoDaysAgoTask], targetToday);

    expect(result.updatedTasks).toHaveLength(1);
    expect(result.escalatedRecords).toHaveLength(1);

    const updated = result.updatedTasks[0];
    expect(updated.date).toBe(targetToday);
    expect(updated.priority).toBe('high');
    expect(updated.status).toBe('in_progress'); // статус остаётся прежним (не done)
    expect(updated.isEscalated).toBe(true);
    expect(updated.escalationReason).toBe('Авто-перенос с 2026-10-05 (+1 уровень приоритета)');
    expect(updated.rolloverCount).toBe(2);
    expect(updated.updatedAt).toBe(fixedNow);
  });

  it('завершённая задача (status === "done") → не переносится', () => {
    const completedYesterdayTask = createSampleTask({
      id: 'task-done',
      date: '2026-10-06',
      priority: 'high',
      status: 'done',
      rolloverCount: 0,
    });

    const result = rolloverTasks([completedYesterdayTask], targetToday);

    expect(result.escalatedRecords).toHaveLength(0);
    expect(result.updatedTasks[0].date).toBe('2026-10-06');
    expect(result.updatedTasks[0].priority).toBe('high');
    expect(result.updatedTasks[0].isEscalated).toBeUndefined();
    expect(result.updatedTasks[0].rolloverCount).toBe(0);
  });

  it('приоритет critical остаётся critical при переносе', () => {
    const criticalTask = createSampleTask({
      id: 'task-critical',
      date: '2026-10-06',
      priority: 'critical',
      status: 'todo',
    });

    const result = rolloverTasks([criticalTask], targetToday);

    const updated = result.updatedTasks[0];
    expect(updated.date).toBe(targetToday);
    expect(updated.priority).toBe('critical'); // остался critical
    expect(updated.isEscalated).toBe(true);

    const record = result.escalatedRecords[0];
    expect(record.oldPriority).toBe('critical');
    expect(record.newPriority).toBe('critical');
  });

  it('priority повышается строго по правилам: low -> medium -> high -> critical', () => {
    const lowTask = createSampleTask({ id: '1', date: '2026-10-06', priority: 'low' });
    const medTask = createSampleTask({ id: '2', date: '2026-10-06', priority: 'medium' });
    const highTask = createSampleTask({ id: '3', date: '2026-10-06', priority: 'high' });
    const critTask = createSampleTask({ id: '4', date: '2026-10-06', priority: 'critical' });

    const result = rolloverTasks([lowTask, medTask, highTask, critTask], targetToday);

    expect(result.updatedTasks.find(t => t.id === '1')?.priority).toBe('medium');
    expect(result.updatedTasks.find(t => t.id === '2')?.priority).toBe('high');
    expect(result.updatedTasks.find(t => t.id === '3')?.priority).toBe('critical');
    expect(result.updatedTasks.find(t => t.id === '4')?.priority).toBe('critical');
  });

  it('rolloverCount увеличивается на 1 при каждом переносе (с 0 или с отсутствующего значения)', () => {
    const taskWithoutCount = createSampleTask({ id: 't1', date: '2026-10-06', rolloverCount: undefined });
    const taskWithZero = createSampleTask({ id: 't2', date: '2026-10-06', rolloverCount: 0 });
    const taskWithCount2 = createSampleTask({ id: 't3', date: '2026-10-06', rolloverCount: 2 });

    const result = rolloverTasks([taskWithoutCount, taskWithZero, taskWithCount2], targetToday);

    expect(result.updatedTasks.find(t => t.id === 't1')?.rolloverCount).toBe(1);
    expect(result.updatedTasks.find(t => t.id === 't2')?.rolloverCount).toBe(1);
    expect(result.updatedTasks.find(t => t.id === 't3')?.rolloverCount).toBe(3);
  });

  it('isEscalated устанавливается в true и формируется понятный escalationReason', () => {
    const task = createSampleTask({
      id: 't-esc',
      date: '2026-10-04',
      isEscalated: false,
    });

    const result = rolloverTasks([task], targetToday);
    const updated = result.updatedTasks[0];

    expect(updated.isEscalated).toBe(true);
    expect(updated.escalationReason).toBe('Авто-перенос с 2026-10-04 (+1 уровень приоритета)');
  });

  it('сегодняшние задачи (date === targetDate) не изменяются', () => {
    const todayTask = createSampleTask({
      id: 'task-today',
      date: targetToday,
      priority: 'low',
      status: 'todo',
      rolloverCount: 0,
    });

    const result = rolloverTasks([todayTask], targetToday);

    expect(result.escalatedRecords).toHaveLength(0);
    expect(result.updatedTasks[0]).toBe(todayTask); // ссылка не изменилась
    expect(result.updatedTasks[0].priority).toBe('low');
    expect(result.updatedTasks[0].rolloverCount).toBe(0);
  });

  it('будущие задачи (date > targetDate) не изменяются', () => {
    const tomorrowTask = createSampleTask({
      id: 'task-tomorrow',
      date: '2026-10-08',
      priority: 'low',
      status: 'todo',
    });

    const result = rolloverTasks([tomorrowTask], targetToday);

    expect(result.escalatedRecords).toHaveLength(0);
    expect(result.updatedTasks[0]).toBe(tomorrowTask);
    expect(result.updatedTasks[0].date).toBe('2026-10-08');
  });

  it('исходный массив задач не мутируется напрямую', () => {
    const originalTask = createSampleTask({
      id: 'task-immutable',
      date: '2026-10-06',
      priority: 'low',
      status: 'todo',
      rolloverCount: 0,
    });
    const originalList = [originalTask];

    const result = rolloverTasks(originalList, targetToday);

    // Новый массив возвращён
    expect(result.updatedTasks).not.toBe(originalList);

    // Поля исходного объекта задачи не изменились
    expect(originalTask.date).toBe('2026-10-06');
    expect(originalTask.priority).toBe('low');
    expect(originalTask.rolloverCount).toBe(0);
    expect(originalTask.isEscalated).toBeUndefined();
  });

  it('hasOverdueTasks корректно определяет наличие незавершённых просроченных задач', () => {
    const donePast = createSampleTask({ date: '2026-10-05', status: 'done' });
    const todayTodo = createSampleTask({ date: targetToday, status: 'todo' });
    const futureTodo = createSampleTask({ date: '2026-10-08', status: 'todo' });

    expect(hasOverdueTasks([donePast, todayTodo, futureTodo], targetToday)).toBe(false);

    const overdueTodo = createSampleTask({ date: '2026-10-06', status: 'todo' });
    expect(hasOverdueTasks([donePast, overdueTodo, todayTodo], targetToday)).toBe(true);
  });

  it('идемпотентность rollover: повторный запуск для той же даты не эскалирует повторно', () => {
    const overdueTask = createSampleTask({
      id: 'task-idem',
      date: '2026-10-06',
      priority: 'low',
      status: 'todo',
    });

    // 1-й прогон: задача переносится на сегодня с повышением до medium
    const firstRun = rolloverTasks([overdueTask], targetToday);
    expect(firstRun.escalatedRecords).toHaveLength(1);
    const rolledTask = firstRun.updatedTasks[0];
    expect(rolledTask.date).toBe(targetToday);
    expect(rolledTask.priority).toBe('medium');
    expect(rolledTask.lastRolloverDate).toBe(targetToday);

    // 2-й прогон с результатом 1-го прогона для той же даты
    const secondRun = rolloverTasks(firstRun.updatedTasks, targetToday);
    expect(secondRun.escalatedRecords).toHaveLength(0);
    expect(secondRun.updatedTasks[0].priority).toBe('medium'); // Не повысилась повторно
    expect(secondRun.updatedTasks[0].rolloverCount).toBe(1); // Не увеличился повторно
  });

  it('надгробия (tombstones с deletedAt) никогда не переносятся и не эскалируются', () => {
    const deletedPastTask = createSampleTask({
      id: 'task-deleted-past',
      date: '2026-10-05',
      status: 'todo',
      priority: 'low',
      deletedAt: '2026-10-06T10:00:00.000Z',
    });

    expect(hasOverdueTasks([deletedPastTask], targetToday)).toBe(false);

    const result = rolloverTasks([deletedPastTask], targetToday);
    expect(result.escalatedRecords).toHaveLength(0);
    expect(result.updatedTasks[0].date).toBe('2026-10-05');
    expect(result.updatedTasks[0].priority).toBe('low');
    expect(result.updatedTasks[0].isEscalated).toBeUndefined();
  });
});
