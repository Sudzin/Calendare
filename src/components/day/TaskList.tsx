import React, { useState } from 'react';
import { Clock, Check, Plus } from 'lucide-react';
import { Task, TaskPriority } from '../../types';
import { PRIORITY_META } from '../../utils/priorityUtils';
import { sound } from '../../utils/sound';
import { PriorityFilterValue, PrioritySortValue } from './PriorityFilterDropdown';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onToggleTaskDone: (task: Task) => void;
  onOpenAddForm: () => void;
  prioritySort?: PrioritySortValue;
  priorityFilter?: PriorityFilterValue;
  onResetPriorityFilter?: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleTaskDone,
  onOpenAddForm,
  prioritySort = 'default',
  priorityFilter = 'all',
  onResetPriorityFilter,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return t.status !== 'done';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  const weight: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const timedTasks = filteredTasks
    .filter(t => t.type === 'timed')
    .sort((a, b) => {
      if (prioritySort === 'critical-first') {
        const diff = weight[b.priority] - weight[a.priority];
        if (diff !== 0) return diff;
      } else if (prioritySort === 'low-first') {
        const diff = weight[a.priority] - weight[b.priority];
        if (diff !== 0) return diff;
      }
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
    });

  const floatingTasks = filteredTasks
    .filter(t => t.type === 'floating')
    .sort((a, b) => {
      if (prioritySort === 'critical-first') {
        return weight[b.priority] - weight[a.priority];
      } else if (prioritySort === 'low-first') {
        return weight[a.priority] - weight[b.priority];
      }
      return 0;
    });

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-solid)]">
      {/* Filter Toolbar */}
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between text-xs gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-[var(--color-app-bg)] p-1 rounded-full border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => {
                if (filter !== 'all') sound.playTabSwitch();
                setFilter('all');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] transition-colors ${
                filter === 'all'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Все ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (filter !== 'active') sound.playTabSwitch();
                setFilter('active');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] transition-colors ${
                filter === 'active'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Активные ({tasks.filter(t => t.status !== 'done').length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (filter !== 'done') sound.playTabSwitch();
                setFilter('done');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] transition-colors ${
                filter === 'done'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Закрытые ({tasks.filter(t => t.status === 'done').length})
            </button>
          </div>

          {/* Active Priority Filter Indicator */}
          {priorityFilter !== 'all' && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-[var(--color-app-bg)] border border-[var(--color-border)]">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: PRIORITY_META[priorityFilter].colorVar }}
              />
              <span className="text-[var(--color-text-secondary)]">
                {PRIORITY_META[priorityFilter].label}
              </span>
              {onResetPriorityFilter && (
                <button
                  type="button"
                  onClick={onResetPriorityFilter}
                  className="ml-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-priority-critical)] font-bold text-xs leading-none"
                  title="Сбросить фильтр"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenAddForm}
          className="px-3 py-1 bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-xl text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-90 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Задача</span>
        </button>
      </div>

      {/* Task List Items: Crisp, dense, opaque */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Timed section */}
        {timedTasks.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              <span>По расписанию</span>
            </span>
            {timedTasks.map(task => {
              const isSelected = selectedTaskId === task.id;
              const isDone = task.status === 'done';
              const meta = PRIORITY_META[task.priority];

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-[var(--color-surface-hover)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                      : 'bg-[var(--color-app-bg)]/80 border-[var(--color-border)] hover:border-[var(--color-accent)]/40'
                  } ${isDone ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onToggleTaskDone(task);
                    }}
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-on-accent)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-solid)]'
                    }`}
                  >
                    {isDone && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-mono text-[11px] text-[var(--color-text-secondary)] font-medium">
                        {task.startTime} – {task.endTime || '...'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.2 rounded-full border font-medium ${meta.badgeStyle}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className={`text-xs font-normal truncate ${isDone ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                      {task.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Floating section */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Плавающие дела
          </span>
          {floatingTasks.length === 0 && timedTasks.length === 0 ? (
            <div className="text-xs text-[var(--color-text-muted)] py-6 text-center italic">
              Нет задач на этот день.
            </div>
          ) : (
            floatingTasks.map(task => {
              const isSelected = selectedTaskId === task.id;
              const isDone = task.status === 'done';
              const meta = PRIORITY_META[task.priority];

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-[var(--color-surface-hover)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                      : 'bg-[var(--color-app-bg)]/80 border-[var(--color-border)] hover:border-[var(--color-accent)]/40'
                  } ${isDone ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onToggleTaskDone(task);
                    }}
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      isDone
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--color-on-accent)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-solid)]'
                    }`}
                  >
                    {isDone && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {task.isEscalated ? '⚠️ Срочный долг' : 'В течение дня'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.2 rounded-full border font-medium ${meta.badgeStyle}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className={`text-xs font-normal truncate ${isDone ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                      {task.title}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
