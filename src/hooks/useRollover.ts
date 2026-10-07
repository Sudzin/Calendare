import { useState, useCallback } from 'react';
import { Task } from '../types';
import { getTodayDate } from '../utils/date';
import { rolloverTasks, EscalationRecord, RolloverResult } from '../utils/rollover';
import { sound } from '../utils/sound';

export type { EscalationRecord, RolloverResult };

export function useRollover(
  tasks: Task[],
  onTasksUpdated: (updated: Task[]) => void,
  pushNotification: (title: string, message: string) => void,
  soundEnabled = true
) {
  const [escalatedTasks, setEscalatedTasks] = useState<EscalationRecord[]>([]);
  const [isRolloverAlertOpen, setIsRolloverAlertOpen] = useState(false);

  const runRollover = useCallback((forceOpenModal = true) => {
    const todayStr = getTodayDate();
    const { updatedTasks, escalatedRecords } = rolloverTasks(tasks, todayStr);

    if (escalatedRecords.length === 0) {
      if (forceOpenModal) {
        setEscalatedTasks([]);
        setIsRolloverAlertOpen(true);
      }
      return;
    }

    onTasksUpdated(updatedTasks);
    setEscalatedTasks(escalatedRecords);
    setIsRolloverAlertOpen(true);

    if (soundEnabled) {
      sound.playAlert();
    }

    pushNotification(
      'Перенос долгов',
      `Перенесено ${escalatedRecords.length} задач с повышением приоритета.`
    );
  }, [tasks, onTasksUpdated, pushNotification, soundEnabled]);

  return {
    runRollover,
    escalatedTasks,
    isRolloverAlertOpen,
    setIsRolloverAlertOpen,
  };
}
