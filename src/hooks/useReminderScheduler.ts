/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { Task } from '../types';
import { reminderScheduler } from '../services/reminderScheduler';

export interface UseReminderSchedulerOptions {
  notificationsEnabled?: boolean;
  onReminder?: (task: Task) => void;
}

/**
 * Хук для интеграции жизненного цикла приложения со службой планировщика напоминаний.
 * Запускает планировщик при монтировании, обновляет при изменении задач или настроек
 * и останавливает при размонтировании.
 */
export function useReminderScheduler(
  tasks: Task[],
  options: UseReminderSchedulerOptions = {}
): void {
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    reminderScheduler.start(
      () => tasksRef.current,
      {
        notificationsEnabled: optionsRef.current.notificationsEnabled,
        onReminder: optionsRef.current.onReminder,
      }
    );

    return () => {
      reminderScheduler.stop();
    };
  }, []);

  useEffect(() => {
    reminderScheduler.updateOptions({
      notificationsEnabled: options.notificationsEnabled,
      onReminder: options.onReminder,
    });
    reminderScheduler.refresh(tasks);
  }, [tasks, options.notificationsEnabled, options.onReminder]);
}
