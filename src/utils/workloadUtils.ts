import { DayWorkload, Task } from '../types';

export function calculateDayWorkload(tasks: Task[], dateStr: string, todayStr: string): DayWorkload {
  const dayTasks = tasks.filter(t => t.date === dateStr);
  const total = dayTasks.length;
  const completed = dayTasks.filter(t => t.status === 'done').length;
  const hasCritical = dayTasks.some(t => t.priority === 'critical');
  const hasOverdue = dateStr < todayStr && dayTasks.some(t => t.status !== 'done');

  let level: DayWorkload['level'] = 'none';
  if (total === 0) level = 'none';
  else if (total <= 2) level = 'light';
  else if (total <= 4) level = 'moderate';
  else level = 'heavy';

  return {
    total,
    completed,
    hasCritical,
    hasOverdue,
    level,
  };
}
