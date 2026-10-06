import { useState, useCallback } from 'react';
import { Task } from '../types';
import { toDateString } from '../utils/dateUtils';
import { getNextPriority } from '../utils/priorityUtils';
import { sound } from '../utils/sound';

export interface EscalationRecord {
  task: Task;
  oldPriority: string;
  newPriority: string;
}

export function useRollover(
  tasks: Task[],
  onTasksUpdated: (updated: Task[]) => void,
  pushNotification: (title: string, message: string) => void,
  soundEnabled = true
) {
  const [escalatedTasks, setEscalatedTasks] = useState<EscalationRecord[]>([]);
  const [isRolloverAlertOpen, setIsRolloverAlertOpen] = useState(false);

  const runRollover = useCallback((forceOpenModal = true) => {
    const todayStr = toDateString(new Date());
    const overdueTasks = tasks.filter(t => t.date < todayStr && t.status !== 'done');

    if (overdueTasks.length === 0) {
      if (forceOpenModal) {
        setEscalatedTasks([]);
        setIsRolloverAlertOpen(true);
      }
      return;
    }

    const records: EscalationRecord[] = [];

    const updated = tasks.map(t => {
      if (t.date < todayStr && t.status !== 'done') {
        const oldPriority = t.priority;
        const newPriority = getNextPriority(t.priority);

        const updatedTask: Task = {
          ...t,
          date: todayStr,
          priority: newPriority,
          isEscalated: true,
          escalationReason: `Авто-перенос с ${t.date} (+1 уровень приоритета)`,
          rolloverCount: (t.rolloverCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        };

        records.push({
          task: updatedTask,
          oldPriority,
          newPriority,
        });

        return updatedTask;
      }
      return t;
    });

    onTasksUpdated(updated);
    setEscalatedTasks(records);
    setIsRolloverAlertOpen(true);

    if (soundEnabled) {
      sound.playAlert();
    }

    pushNotification(
      'Перенос долгов',
      `Перенесено ${records.length} задач с повышением приоритета.`
    );
  }, [tasks, onTasksUpdated, pushNotification, soundEnabled]);

  return {
    runRollover,
    escalatedTasks,
    isRolloverAlertOpen,
    setIsRolloverAlertOpen,
  };
}
