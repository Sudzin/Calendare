import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Trash2, AlertCircle } from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { UpdateTaskInput } from '../../repositories/TaskRepository';
import { PRIORITY_META, STATUS_META } from '../../utils/priorityUtils';
import { MarkdownWorkspace } from '../markdown/MarkdownWorkspace';
import { sound } from '../../utils/sound';

interface PendingEdit {
  taskId: string;
  title?: string;
  notes?: string;
}

interface TaskDetailViewProps {
  task: Task | null;
  onUpdateTask: (task: UpdateTaskInput) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  task,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [localTitle, setLocalTitle] = useState(task?.title || '');
  const [localNotes, setLocalNotes] = useState(task?.notes || '');

  const pendingRef = useRef<PendingEdit | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending) {
      const updatePayload: UpdateTaskInput = { id: pending.taskId };
      let hasChanges = false;
      if (pending.title !== undefined) {
        updatePayload.title = pending.title;
        hasChanges = true;
      }
      if (pending.notes !== undefined) {
        updatePayload.notes = pending.notes;
        hasChanges = true;
      }
      if (hasChanges) {
        onUpdateTask(updatePayload);
      }
      pendingRef.current = null;
    }
  }, [onUpdateTask]);

  // 4. Синхронизацию localTitle/localNotes из пропсов делаем только по [task?.id]
  // 3. Flush при смене задачи делаем в cleanup эффекта с зависимостью [task?.id], чтобы он выполнялся до подмены
  useEffect(() => {
    setLocalTitle(task?.title || '');
    setLocalNotes(task?.notes || '');

    return () => {
      flush();
    };
  }, [task?.id, flush]);

  const handleTitleChange = (newTitle: string) => {
    if (!task) return;
    // 1. Если приходит изменение для другого id, сначала flush() прежней
    if (pendingRef.current && pendingRef.current.taskId !== task.id) {
      flush();
    }
    setLocalTitle(newTitle);
    pendingRef.current = {
      taskId: task.id,
      notes: pendingRef.current?.taskId === task.id ? pendingRef.current.notes : undefined,
      title: newTitle,
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, 500);
  };

  const handleNotesChange = (newNotes: string) => {
    if (!task) return;
    // 1. Если приходит изменение для другого id, сначала flush() прежней
    if (pendingRef.current && pendingRef.current.taskId !== task.id) {
      flush();
    }
    setLocalNotes(newNotes);
    pendingRef.current = {
      taskId: task.id,
      title: pendingRef.current?.taskId === task.id ? pendingRef.current.title : undefined,
      notes: newNotes,
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, 500);
  };

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
          value={localTitle}
          onChange={e => handleTitleChange(e.target.value)}
          onBlur={flush}
          className="font-serif text-base font-medium text-[var(--color-text-primary)] bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none w-full py-0.5 transition-colors"
        />
        <button
          type="button"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            pendingRef.current = null;
            sound.playDelete();
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
            onChange={e => {
              flush();
              onUpdateTask({ id: task.id, startTime: e.target.value });
            }}
            className="bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-mono"
          />
          <span>–</span>
          <input
            type="time"
            value={task.endTime || '10:30'}
            onChange={e => {
              flush();
              onUpdateTask({ id: task.id, endTime: e.target.value });
            }}
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
                  flush();
                  if (st === 'done' && task.status !== 'done') {
                    sound.playTaskComplete();
                  } else if (task.status !== st) {
                    sound.playTabSwitch();
                  }
                  onUpdateTask({ id: task.id, status: st });
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
                    flush();
                    if (task.priority !== pr) {
                      sound.playTabSwitch();
                    }
                    onUpdateTask({ id: task.id, priority: pr });
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
          content={localNotes}
          onChange={handleNotesChange}
          onBlur={flush}
        />
      </div>
    </div>
  );
};
