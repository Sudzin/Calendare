import React, { useEffect } from 'react';
import { X, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { EscalationRecord } from '../../hooks/useRollover';
import { PRIORITY_META } from '../../utils/priorityUtils';
import { TaskPriority } from '../../types';
import { sound } from '../../utils/sound';

interface RolloverAlertModalProps {
  escalatedTasks: EscalationRecord[];
  onClose: () => void;
}

export const RolloverAlertModal: React.FC<RolloverAlertModalProps> = ({
  escalatedTasks,
  onClose,
}) => {
  useEffect(() => {
    sound.playAlert();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playModalClose();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
        className="glass-panel rounded-3xl w-full max-w-[520px] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-[var(--color-border-glass)] transition-all animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-serif text-xl font-normal text-[var(--color-content-primary)] tracking-tight">
              Перенос невыполненных дел
            </h3>
            <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
              Смена суток: не закрытые вовремя задачи перенесены с повышением приоритета (+1)
            </p>
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

        {/* List */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1 bg-[var(--color-surface-elevated)]/90 backdrop-blur-md">
          {escalatedTasks.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-content-muted)] space-y-2">
              <ShieldCheck className="w-9 h-9 mx-auto text-[var(--color-accent)] stroke-[1.5]" />
              <p>Все вчерашние задачи закрыты! Долгов нет.</p>
            </div>
          ) : (
            escalatedTasks.map(({ task, oldPriority, newPriority }) => {
              const oldMeta = PRIORITY_META[oldPriority as TaskPriority];
              const newMeta = PRIORITY_META[newPriority as TaskPriority];
              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-[var(--color-canvas)]/75 border border-[var(--color-border-glass)] space-y-2 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--color-content-primary)] truncate">
                      {task.title}
                    </span>
                    <span className="text-[10px] text-[var(--color-priority-critical)] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-priority-critical)]/15 border border-[var(--color-priority-critical)]/30 shrink-0">
                      +1 уровень
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[var(--color-content-secondary)]">
                    <span className="capitalize">{oldMeta?.label || oldPriority}</span>
                    <ArrowRight className="w-3 h-3 text-[var(--color-content-muted)]" />
                    <span className={`px-2 py-0.5 rounded-full border font-medium ${newMeta?.badgeStyle}`}>
                      {newMeta?.label || newPriority}
                    </span>
                    {newPriority === 'critical' && (
                      <span className="text-[10px] text-[var(--color-priority-critical)] font-medium">
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
        <div className="px-6 py-4 border-t border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex justify-end">
          <button
            type="button"
            onClick={() => {
              sound.playModalClose();
              onClose();
            }}
            className="px-5 py-2 bg-[var(--color-accent)] hover:opacity-95 text-[var(--color-accent-text)] text-xs font-medium rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Понятно</span>
          </button>
        </div>
      </div>
    </div>
  );
};
