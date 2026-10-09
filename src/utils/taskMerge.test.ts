import { describe, it, expect } from 'vitest';
import { mergeTaskVersions, mergeTaskLists, canonicalTaskSerialize } from './taskMerge';
import { Task } from '../types';

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Тестовая задача',
  type: 'floating',
  date: '2026-10-09',
  priority: 'medium',
  status: 'todo',
  notes: '',
  createdAt: '2026-10-09T10:00:00.000Z',
  updatedAt: '2026-10-09T10:00:00.000Z',
  ...overrides,
});

describe('Deterministic Task Merge Logic (src/utils/taskMerge.ts)', () => {
  it('выигрывает более свежий updatedAt', () => {
    const older = baseTask({
      title: 'Старое название',
      updatedAt: '2026-10-09T10:00:00.000Z',
    });
    const newer = baseTask({
      title: 'Новое название',
      updatedAt: '2026-10-09T11:00:00.000Z',
    });

    expect(mergeTaskVersions(older, newer)).toBe(newer);
    expect(mergeTaskVersions(newer, older)).toBe(newer);
  });

  it('при равенстве updatedAt применяется детерминированное правило по содержимому (не зависит от порядка)', () => {
    const versionA = baseTask({
      title: 'Альфа версия',
      notes: 'Notes A',
      updatedAt: '2026-10-09T10:00:00.000Z',
    });
    const versionB = baseTask({
      title: 'Бета версия',
      notes: 'Notes B',
      updatedAt: '2026-10-09T10:00:00.000Z',
    });

    const res1 = mergeTaskVersions(versionA, versionB);
    const res2 = mergeTaskVersions(versionB, versionA);

    // Результат строго идентичен независимо от порядка аргументов
    expect(res1).toBe(res2);
  });

  it('tombstone (deletedAt) с более свежим updatedAt побеждает старую активную версию', () => {
    const activeOld = baseTask({
      title: 'Активная старая задача',
      updatedAt: '2026-10-09T10:00:00.000Z',
    });
    const tombstoneNew = baseTask({
      title: 'Удалённая новая задача',
      deletedAt: '2026-10-09T10:30:00.000Z',
      updatedAt: '2026-10-09T10:30:00.000Z',
    });

    const merged = mergeTaskVersions(activeOld, tombstoneNew);
    expect(merged.deletedAt).toBe('2026-10-09T10:30:00.000Z');

    const list = mergeTaskLists([activeOld, tombstoneNew]);
    expect(list).toHaveLength(0); // Скрыта из интерфейса
  });

  it('активная версия с более свежим updatedAt побеждает старый tombstone (воскрешение/повторное создание)', () => {
    const tombstoneOld = baseTask({
      deletedAt: '2026-10-09T08:00:00.000Z',
      updatedAt: '2026-10-09T08:00:00.000Z',
    });
    const activeNew = baseTask({
      title: 'Повторно созданная задача',
      updatedAt: '2026-10-09T09:00:00.000Z',
      deletedAt: undefined,
    });

    const merged = mergeTaskVersions(tombstoneOld, activeNew);
    expect(merged.deletedAt).toBeUndefined();
    expect(merged.title).toBe('Повторно созданная задача');

    const list = mergeTaskLists([tombstoneOld, activeNew]);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Повторно созданная задача');
  });

  it('mergeTaskLists детерминированно объединяет массив из нескольких версий и разных задач', () => {
    const t1v1 = baseTask({ id: 't-1', title: 'T1 v1', updatedAt: '2026-10-09T10:00:00Z' });
    const t1v2 = baseTask({ id: 't-1', title: 'T1 v2', updatedAt: '2026-10-09T12:00:00Z' });
    const t2v1 = baseTask({ id: 't-2', title: 'T2 v1', updatedAt: '2026-10-09T11:00:00Z' });
    const t3Deleted = baseTask({
      id: 't-3',
      deletedAt: '2026-10-09T13:00:00Z',
      updatedAt: '2026-10-09T13:00:00Z',
    });

    const order1 = mergeTaskLists([t1v1, t2v1, t1v2, t3Deleted]);
    const order2 = mergeTaskLists([t3Deleted, t1v2, t2v1, t1v1]);

    expect(order1).toEqual(order2);
    expect(order1).toHaveLength(2);
    expect(order1.find(t => t.id === 't-1')?.title).toBe('T1 v2');
    expect(order1.find(t => t.id === 't-2')?.title).toBe('T2 v1');
    expect(order1.find(t => t.id === 't-3')).toBeUndefined();
  });
});
