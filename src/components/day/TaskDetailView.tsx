import React from 'react';
import { Clock, Trash2, AlertCircle } from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { PRIORITY_META, STATUS_META } from '../../utils/priorityUtils';
import { MarkdownWorkspace } from '../markdown/MarkdownWorkspace';
import { sound } from '../../utils/sound';

interface TaskDetailViewProps {
  task: Task | null;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  task,
  onUpdateTask,
  onDeleteTask,
}) => {
  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--color-text-muted)] space-y-2">
        <AlertCircle className="w-8 h-8 text-[var(--color-text-muted)] stroke-[1.5]" />
        <p className="font-medium text-[var(--color-text-secondary)]">Задача не выбрана</p>
        <p className="max-w-xs text-[11px]">
          Выберите дело из списка слева, чтобы просмотреть заметки и переключить статус.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full text-xs">
      {/* Escalation notice */}
      {task.isEscalated && (
        <div className="p-2.5 rounded-lg border border-[var(--color-priority-critical)]/30 bg-[var(--color-priority-critical)]/10 text-[var(--color-priority-critical)] flex items-start gap-2 text-xs">
          <span className="font-medium">⚠️ Перенесено:</span>
          <span className="text-[11px] leading-snug">
            {task.escalationReason || 'Задача не была закрыта вовремя и повышена в приоритете.'}
          </span>
        </div>
      )}

      {/* Title & Delete */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={task.title}
          onChange={e => onUpdateTask({ ...task, title: e.target.value, updatedAt: new Date().toISOString() })}
          className="font-serif text-base font-medium text-[var(--color-text-primary)] bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none w-full py-0.5 transition-colors"
        />
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onDeleteTask(task.id);
          }}
          title="Удалить задачу"
          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-priority-critical)] hover:bg-[var(--color-surface-hover)] rounded transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Time if timed */}
      {task.type === 'timed' && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <Clock className="w-3.5 h-3.5" />
          <span>Интервал:</span>
          <input
            type="time"
            value={task.startTime || '09:00'}
            onChange={e => onUpdateTask({ ...task, startTime: e.target.value, updatedAt: new Date().toISOString() })}
            className="bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-mono"
          />
          <span>–</span>
          <input
            type="time"
            value={task.endTime || '10:30'}
            onChange={e => onUpdateTask({ ...task, endTime: e.target.value, updatedAt: new Date().toISOString() })}
            className="bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-mono"
          />
        </div>
      )}

      {/* Status & Priority segment buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Status */}
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Статус
          </span>
          <div className="grid grid-cols-2 gap-1 bg-[var(--color-app-bg)] p-1 rounded-lg border border-[var(--color-border)]">
            {(['todo', 'in_progress', 'done', 'postponed'] as TaskStatus[]).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  sound.playClick();
                  onUpdateTask({ ...task, status: st, updatedAt: new Date().toISOString() });
                }}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  task.status === st
                    ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {STATUS_META[st].label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Приоритет
          </span>
          <div className="grid grid-cols-4 gap-1 bg-[var(--color-app-bg)] p-1 rounded-lg border border-[var(--color-border)]">
            {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map(pr => {
              const meta = PRIORITY_META[pr];
              const isCurrent = task.priority === pr;
              return (
                <button
                  key={pr}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    onUpdateTask({ ...task, priority: pr, updatedAt: new Date().toISOString() });
                  }}
                  className={`px-1.5 py-1 rounded text-[10px] transition-colors font-medium border ${
                    isCurrent
                      ? meta.badgeStyle
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Markdown Notes & Subtasks */}
      <div className="space-y-1 pt-1">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Заметки и подзадачи
        </span>
        <MarkdownWorkspace
          content={task.notes || ''}
          onChange={newNotes => onUpdateTask({ ...task, notes: newNotes, updatedAt: new Date().toISOString() })}
        />
      </div>
    </div>
  );
};
