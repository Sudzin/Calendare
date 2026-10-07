import { useState, useCallback, useEffect, useRef } from 'react';
import { Task } from '../types';
import { getTodayDate } from '../utils/date';
import { rolloverTasks, EscalationRecord, RolloverResult } from '../utils/rollover';
import { sound } from '../utils/sound';

export type { EscalationRecord, RolloverResult };

/**
 * Вычисляет количество миллисекунд до следующей локальной полуночи (00:00:00.000).
 * Добавляет небольшой буфер (100 мс), чтобы системные часы при срабатывании таймера
 * гарантированно перешли на новую дату в локальном часовом поясе.
 */
function getMsUntilNextLocalMidnight(): number {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  );
  return Math.max(nextMidnight.getTime() - now.getTime() + 100, 100);
}

export function useRollover(
  tasks: Task[],
  onTasksUpdated: (updated: Task[]) => void,
  pushNotification: (title: string, message: string) => void,
  soundEnabled = true,
  autoRollover = true
) {
  const [escalatedTasks, setEscalatedTasks] = useState<EscalationRecord[]>([]);
  const [isRolloverAlertOpen, setIsRolloverAlertOpen] = useState(false);

  // Ссылки на актуальные значения для таймера смены календарного дня
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const onTasksUpdatedRef = useRef(onTasksUpdated);
  onTasksUpdatedRef.current = onTasksUpdated;

  const pushNotificationRef = useRef(pushNotification);
  pushNotificationRef.current = pushNotification;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const autoRolloverRef = useRef(autoRollover);
  autoRolloverRef.current = autoRollover;

  // Дата последнего выполненного автоматического rollover (YYYY-MM-DD)
  const lastAutoRolloverDateRef = useRef<string | null>(null);

  const executeRolloverForDate = useCallback(
    (targetDate: string, forceOpenModal = false) => {
      const { updatedTasks, escalatedRecords } = rolloverTasks(tasksRef.current, targetDate);

      if (escalatedRecords.length === 0) {
        if (forceOpenModal) {
          setEscalatedTasks([]);
          setIsRolloverAlertOpen(true);
        }
        return false;
      }

      onTasksUpdatedRef.current(updatedTasks);
      setEscalatedTasks(escalatedRecords);
      setIsRolloverAlertOpen(true);

      if (soundEnabledRef.current) {
        sound.playAlert();
      }

      pushNotificationRef.current(
        'Перенос долгов',
        `Перенесено ${escalatedRecords.length} задач с повышением приоритета.`
      );

      return true;
    },
    []
  );

  const runRollover = useCallback(
    (forceOpenModal = true) => {
      const todayStr = getTodayDate();
      executeRolloverForDate(todayStr, forceOpenModal);
      lastAutoRolloverDateRef.current = todayStr;
    },
    [executeRolloverForDate]
  );

  useEffect(() => {
    if (!autoRollover) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    // 1. Запуск при монтировании (если еще не выполнялся для сегодняшней даты)
    const todayStr = getTodayDate();
    if (lastAutoRolloverDateRef.current !== todayStr) {
      lastAutoRolloverDateRef.current = todayStr;
      executeRolloverForDate(todayStr, false);
    }

    // 2. Планирование до следующей локальной полуночи
    const scheduleNextMidnight = () => {
      if (isCancelled) return;

      const delay = getMsUntilNextLocalMidnight();

      timerId = setTimeout(() => {
        if (isCancelled) return;

        const currentToday = getTodayDate();
        if (lastAutoRolloverDateRef.current !== currentToday) {
          lastAutoRolloverDateRef.current = currentToday;
          executeRolloverForDate(currentToday, false);
        }

        // Планируем следующий день
        scheduleNextMidnight();
      }, delay);
    };

    scheduleNextMidnight();

    return () => {
      isCancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [autoRollover, executeRolloverForDate]);

  return {
    runRollover,
    escalatedTasks,
    isRolloverAlertOpen,
    setIsRolloverAlertOpen,
  };
}
