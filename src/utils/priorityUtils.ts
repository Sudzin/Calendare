import { TaskPriority, TaskStatus } from '../types';

export const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export function getNextPriority(current: TaskPriority): TaskPriority {
  const idx = PRIORITY_ORDER.indexOf(current);
  if (idx === -1) return 'medium';
  return PRIORITY_ORDER[Math.min(idx + 1, PRIORITY_ORDER.length - 1)];
}

export interface PriorityMeta {
  label: string;
  colorVar: string;
  badgeStyle: string;
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  low: {
    label: 'Низкий',
    colorVar: 'var(--color-priority-low)',
    badgeStyle: 'text-[var(--color-priority-low)] border-[var(--color-priority-low)]/30 bg-[var(--color-priority-low)]/10',
  },
  medium: {
    label: 'Средний',
    colorVar: 'var(--color-priority-medium)',
    badgeStyle: 'text-[var(--color-priority-medium)] border-[var(--color-priority-medium)]/30 bg-[var(--color-priority-medium)]/10',
  },
  high: {
    label: 'Высокий',
    colorVar: 'var(--color-priority-high)',
    badgeStyle: 'text-[var(--color-priority-high)] border-[var(--color-priority-high)]/30 bg-[var(--color-priority-high)]/10',
  },
  critical: {
    label: 'Критический',
    colorVar: 'var(--color-priority-critical)',
    badgeStyle: 'text-[var(--color-priority-critical)] border-[var(--color-priority-critical)]/30 bg-[var(--color-priority-critical)]/10',
  },
};

export const STATUS_META: Record<TaskStatus, { label: string }> = {
  todo: { label: 'К выполнению' },
  in_progress: { label: 'В процессе' },
  done: { label: 'Завершено' },
  postponed: { label: 'Отложено' },
};
