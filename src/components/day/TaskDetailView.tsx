import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [localTitle, setLocalTitle] = useState(task?.title || '');
  const [localNotes, setLocalNotes] = useState(task?.notes || '');

  const taskRef = useRef(task);
  taskRef.current = task;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title?: string; notes?: string }>({});

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const currentTask = taskRef.current;
    const pending = pendingRef.current;
    if (currentTask && (pending.title !== undefined || pending.notes !== undefined)) {
      const nextTitle = pending.title !== undefined ? pending.title : currentTask.title;
      const nextNotes = pending.notes !== undefined ? pending.notes : (currentTask.notes || '');
      if (nextTitle !== currentTask.title || nextNotes !== (currentTask.notes || '')) {
        onUpdateTask({
          ...currentTask,
          title: nextTitle,
          notes: nextNotes,
        });
      }
      pendingRef.current = {};
    }
  }, [onUpdateTask]);

  // При смене ID задачи синхронизируем локальные поля и сбрасываем предыдущий flush
  useEffect(() => {
    flush();
    setLocalTitle(task?.title || '');
    setLocalNotes(task?.notes || '');
  }, [task?.id, flush]);

  // Flush при размонтировании (закрытие модального окна / смене контекста)
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  const handleTitleChange = (newTitle: string) => {
    setLocalTitle(newTitle);
    pendingRef.current.title = newTitle;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, 500);
  };

  const handleNotesChange = (newNotes: string) => {
    setLocalNotes(newNotes);
    pendingRef.current.notes = newNotes;
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
              onUpdateTask({ ...task, startTime: e.target.value });
            }}
            className="bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-mono"
          />
          <span>–</span>
          <input
            type="time"
            value={task.endTime || '10:30'}
            onChange={e => {
              flush();
              onUpdateTask({ ...task, endTime: e.target.value });
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
                  onUpdateTask({ ...task, status: st });
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
                    onUpdateTask({ ...task, priority: pr });
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
