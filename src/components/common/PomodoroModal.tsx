import React, { useEffect } from 'react';
import { X, Timer } from 'lucide-react';
import { PomodoroWidget } from '../pomodoro/PomodoroWidget';

interface PomodoroModalProps {
  workMinutes: number;
  breakMinutes: number;
  soundEnabled: boolean;
  onSendNotification: (title: string, message: string) => void;
  onClose: () => void;
}

export const PomodoroModal: React.FC<PomodoroModalProps> = ({
  workMinutes,
  breakMinutes,
  soundEnabled,
  onSendNotification,
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
        className="bg-[var(--color-surface-glass)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl w-full max-w-[400px] overflow-hidden flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-solid)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
              <Timer className="w-4 h-4" />
            </div>
            <h3 className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
              Фокус-таймер
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 bg-[var(--color-surface-solid)]">
          <PomodoroWidget
            workMinutes={workMinutes}
            breakMinutes={breakMinutes}
            soundEnabled={soundEnabled}
            onSendNotification={onSendNotification}
          />
        </div>
      </div>
    </div>
  );
};
