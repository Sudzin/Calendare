import React, { useEffect } from 'react';
import { X, Calendar, Clock, ArrowRight, Plus } from 'lucide-react';
import { Task } from '../../types';
import { formatHumanDate } from '../../utils/dateUtils';
import { PRIORITY_META } from '../../utils/priorityUtils';
import { sound } from '../../utils/sound';

interface DayPreviewModalProps {
  dateStr: string;
  tasks: Task[];
  onClose: () => void;
  onOpenFullDay: (dateStr: string) => void;
  onQuickAddTask: (dateStr: string) => void;
}

export const DayPreviewModal: React.FC<DayPreviewModalProps> = ({
  dateStr,
  tasks,
  onClose,
  onOpenFullDay,
  onQuickAddTask,
}) => {
  // Play airy modal open sweep sound and handle Esc
  useEffect(() => {
    sound.playModalOpen();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playModalClose();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const dayTasks = tasks.filter(t => t.date === dateStr);
  const timedTasks = dayTasks.filter(t => t.type === 'timed');
  const floatingTasks = dayTasks.filter(t => t.type === 'floating');
  const completed = dayTasks.filter(t => t.status === 'done').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 glass-modal-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => {
        sound.playModalClose();
        onClose();
      }}
    >
      <div
        className="glass-panel rounded-3xl w-full max-w-[520px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-[var(--color-border-glass)] transition-all transform scale-100 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border-glass)] flex items-center justify-center text-[var(--color-accent)] shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-normal text-[var(--color-content-primary)] tracking-tight">
                {formatHumanDate(dateStr)}
              </h3>
              <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                Задач: {dayTasks.length} · Выполнено: {completed}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playModalClose();
              onClose();
            }}
            className="p-2 text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list with opaque frosted interior for 100% legibility */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-[var(--color-surface-elevated)]/90 backdrop-blur-md">
          {/* Section 1: Timed Schedule */}
          {timedTasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--color-content-muted)] flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>По расписанию</span>
              </div>
              <div className="space-y-2">
                {timedTasks.map(t => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-[var(--color-canvas)]/75 border border-[var(--color-border-glass)] flex items-center justify-between text-xs transition-all hover:border-[var(--color-accent)]/50 shadow-xs"
                  >
                    <span
                      className={`font-medium ${
                        t.status === 'done'
                          ? 'line-through text-[var(--color-content-muted)]'
                          : 'text-[var(--color-content-primary)]'
                      }`}
                    >
                      {t.title}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-accent)] font-semibold bg-[var(--color-surface-hover)] px-2.5 py-1 rounded-full border border-[var(--color-border-glass)]">
                      {t.startTime} – {t.endTime || '...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Floating Tasks */}
          {floatingTasks.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--color-content-muted)] uppercase tracking-wider">
                Плавающие дела
              </div>
              <div className="space-y-2">
                {floatingTasks.map(t => {
                  const meta = PRIORITY_META[t.priority];
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-[var(--color-canvas)]/75 border border-[var(--color-border-glass)] flex items-center justify-between text-xs transition-all hover:border-[var(--color-accent)]/50 shadow-xs"
                    >
                      <span
                        className={`font-normal truncate max-w-[280px] ${
                          t.status === 'done'
                            ? 'line-through text-[var(--color-content-muted)]'
                            : 'text-[var(--color-content-primary)]'
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${meta.badgeStyle}`}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dayTasks.length === 0 && (
            <div className="text-center py-10 text-[var(--color-content-muted)] text-xs italic">
              На этот день ничего не запланировано.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onQuickAddTask(dateStr);
            }}
            className="px-4 py-2 text-xs text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-glass)] rounded-full flex items-center gap-1.5 transition-colors font-medium shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span>Добавить дело</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onOpenFullDay(dateStr);
            }}
            className="px-5 py-2 text-xs font-medium text-[var(--color-accent-text)] bg-[var(--color-accent)] hover:opacity-95 rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <span>Открыть день</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
