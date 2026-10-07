import React, { useEffect } from 'react';
import { X, Timer } from 'lucide-react';
import { PomodoroWidget } from '../pomodoro/PomodoroWidget';
import { sound } from '../../utils/sound';

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
        className="glass-panel rounded-3xl w-full max-w-[420px] overflow-hidden flex flex-col shadow-2xl border border-[var(--color-border-glass)] transition-all animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border-glass)] flex items-center justify-center text-[var(--color-accent)] shadow-xs">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-normal text-[var(--color-content-primary)] tracking-tight">
                Фокус-таймер
              </h3>
              <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                Техника Pomodoro
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

        <div className="p-6 bg-[var(--color-surface-elevated)]/90 backdrop-blur-md">
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
