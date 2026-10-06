import React, { useEffect } from 'react';
import { X, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { EscalationRecord } from '../../hooks/useRollover';
import { PRIORITY_META } from '../../utils/priorityUtils';
import { TaskPriority } from '../../types';

interface RolloverAlertModalProps {
  escalatedTasks: EscalationRecord[];
  onClose: () => void;
}

export const RolloverAlertModal: React.FC<RolloverAlertModalProps> = ({
  escalatedTasks,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-glass)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl w-full max-w-[500px] overflow-hidden flex flex-col max-h-[85vh] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
              Перенос невыполненных дел
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Смена суток: не закрытые вовремя задачи перенесены с повышением приоритета (+1)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List (solid inside for clear reading) */}
        <div className="p-5 space-y-2.5 overflow-y-auto flex-1 bg-[var(--color-surface-solid)]">
          {escalatedTasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-text-muted)] space-y-2">
              <ShieldCheck className="w-8 h-8 mx-auto text-[var(--color-text-secondary)] stroke-[1.5]" />
              <p>Все вчерашние задачи закрыты! Долгов нет.</p>
            </div>
          ) : (
            escalatedTasks.map(({ task, oldPriority, newPriority }) => {
              const oldMeta = PRIORITY_META[oldPriority as TaskPriority];
              const newMeta = PRIORITY_META[newPriority as TaskPriority];
              return (
                <div
                  key={task.id}
                  className="p-3 rounded-lg bg-[var(--color-app-bg)] border border-[var(--color-border)] space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-normal text-[var(--color-text-primary)] truncate">
                      {task.title}
                    </span>
                    <span className="text-[10px] text-[var(--color-priority-critical)] font-medium shrink-0">
                      +1 уровень
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                    <span className="capitalize">{oldMeta?.label || oldPriority}</span>
                    <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
                    <span className={`px-1.5 py-0.2 rounded border font-medium ${newMeta?.badgeStyle}`}>
                      {newMeta?.label || newPriority}
                    </span>
                    {newPriority === 'critical' && (
                      <span className="text-[10px] text-[var(--color-priority-critical)]">
                        (Срочный долг)
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Понятно</span>
          </button>
        </div>
      </div>
    </div>
  );
};
