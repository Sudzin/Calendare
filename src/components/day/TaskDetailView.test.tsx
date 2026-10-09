// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { TaskDetailView } from './TaskDetailView';
import { Task } from '../../types';

vi.mock('../../utils/sound', () => ({
  sound: {
    playDelete: vi.fn(),
    playTaskComplete: vi.fn(),
    playTabSwitch: vi.fn(),
    playTap: vi.fn(),
  },
}));

function createTestTask(id: string, title: string, notes = ''): Task {
  return {
    id,
    title,
    type: 'floating',
    date: '2026-10-09',
    priority: 'medium',
    status: 'todo',
    notes,
    createdAt: '2026-10-09T10:00:00.000Z',
    updatedAt: '2026-10-09T10:00:00.000Z',
  };
}

describe('TaskDetailView debouncing and flush isolation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('редактируем A, до 500 мс переключаем на B: обновление уходит только для A, а B не меняется', () => {
    const taskA = createTestTask('task-A', 'Задача A');
    const taskB = createTestTask('task-B', 'Задача B');
    const onUpdateTask = vi.fn();
    const onDeleteTask = vi.fn();

    // 1. Рендерим с задачей A
    const { rerender, container } = render(
      <TaskDetailView
        task={taskA}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    );

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe('Задача A');

    // 2. Вводим новый заголовок для задачи A
    fireEvent.change(titleInput, { target: { value: 'Новый заголовок A' } });

    // Прошло только 100 мс (меньше 500 мс debounce)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // onUpdateTask еще не должен был сработать от таймера
    expect(onUpdateTask).not.toHaveBeenCalled();

    // 3. Переключаемся на задачу B до истечения 500 мс
    rerender(
      <TaskDetailView
        task={taskB}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    );

    // При переключении в cleanup эффекта сработал flush для task-A!
    expect(onUpdateTask).toHaveBeenCalledTimes(1);
    expect(onUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-A',
        title: 'Новый заголовок A',
      })
    );

    // Проверяем, что задача B отобразилась со своим заголовком и для task-B не было вызова onUpdateTask
    const newTitleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(newTitleInput.value).toBe('Задача B');

    // Продвигаем таймер вперед на 1000 мс
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Для task-B никаких обновлений вызвано не было
    const callsForB = onUpdateTask.mock.calls.filter(call => call[0]?.id === 'task-B');
    expect(callsForB).toHaveLength(0);
  });

  it('после автосохранения (flush 500 мс) набор текста не сбрасывается и продолжается корректно', () => {
    let currentTask = createTestTask('task-A', 'Старт');
    const onUpdateTask = vi.fn((update) => {
      currentTask = { ...currentTask, ...update };
    });
    const onDeleteTask = vi.fn();

    const { rerender, container } = render(
      <TaskDetailView
        task={currentTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    );

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;

    // Вводим первую часть текста
    fireEvent.change(titleInput, { target: { value: 'Старт часть 1' } });

    // Ждем 500 мс для срабатывания дебаунса
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Автосохранение вызвало onUpdateTask
    expect(onUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-A',
        title: 'Старт часть 1',
      })
    );

    // Родительский компонент перерендеривает с обновленным taskA (тот же id)
    rerender(
      <TaskDetailView
        task={currentTask}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />
    );

    // Текст в инпуте не сбросился
    expect(titleInput.value).toBe('Старт часть 1');

    // Продолжаем набор текста без сброса
    fireEvent.change(titleInput, { target: { value: 'Старт часть 1 часть 2' } });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onUpdateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'task-A',
        title: 'Старт часть 1 часть 2',
      })
    );
    expect(titleInput.value).toBe('Старт часть 1 часть 2');
  });
});
