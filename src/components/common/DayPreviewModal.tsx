import React, { useEffect } from 'react';
import { X, Calendar, Clock, ArrowRight, Plus } from 'lucide-react';
import { Task } from '../../types';
import { formatHumanDate } from '../../utils/dateUtils';
import { PRIORITY_META } from '../../utils/priorityUtils';

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
  // Esc keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-glass)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl w-full max-w-[520px] overflow-hidden flex flex-col max-h-[85vh] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-solid)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
                {formatHumanDate(dateStr)}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Задач: {dayTasks.length} · Закрыто: {completed}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list (Solid background inside for clear reading) */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-[var(--color-surface-solid)]">
          {timedTasks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Расписание</span>
              </div>
              <div className="space-y-1.5">
                {timedTasks.map(t => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-[var(--color-app-bg)]/80 border border-[var(--color-border)] flex items-center justify-between text-xs"
                  >
                    <span className={`font-normal ${t.status === 'done' ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                      {t.title}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-text-secondary)] font-medium">
                      {t.startTime} – {t.endTime || '...'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {floatingTasks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Плавающие дела
              </div>
              <div className="space-y-1.5">
                {floatingTasks.map(t => {
                  const meta = PRIORITY_META[t.priority];
                  return (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-[var(--color-app-bg)]/80 border border-[var(--color-border)] flex items-center justify-between text-xs"
                    >
                      <span className={`font-normal truncate max-w-[320px] ${t.status === 'done' ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                        {t.title}
                      </span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${meta.badgeStyle}`}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dayTasks.length === 0 && (
            <div className="text-center py-8 text-[var(--color-text-muted)] text-xs italic">
              На этот день ничего не запланировано.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface-glass)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onQuickAddTask(dateStr)}
            className="px-3.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl flex items-center gap-1.5 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить дело</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFullDay(dateStr)}
            className="px-4 py-1.5 text-xs font-medium text-[#051F20] bg-[var(--color-accent)] hover:opacity-90 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span>Открыть день</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
