import React from 'react';
import { Play, Pause, RotateCcw, FastForward, CheckCircle2 } from 'lucide-react';
import { usePomodoro } from '../../hooks/usePomodoro';

interface PomodoroWidgetProps {
  workMinutes?: number;
  breakMinutes?: number;
  soundEnabled?: boolean;
  onSessionComplete?: () => void;
  onSendNotification?: (title: string, message: string) => void;
  compact?: boolean;
}

export const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({
  workMinutes = 25,
  breakMinutes = 5,
  soundEnabled = true,
  onSessionComplete,
  onSendNotification,
  compact = false,
}) => {
  const {
    mode,
    formattedTime,
    isRunning,
    progressPercent,
    completedSessions,
    toggle,
    reset,
    skip,
  } = usePomodoro({
    workMinutes,
    breakMinutes,
    soundEnabled,
    onSessionComplete,
    onSendNotification,
  });

  return (
    <div className={`bg-[var(--color-app-bg)] border border-[var(--color-border)] rounded-lg flex flex-col gap-2 ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {mode === 'work' ? 'Фокус-сессия' : 'Перерыв'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${
            mode === 'work'
              ? 'text-[var(--color-priority-high)] border-[var(--color-priority-high)]/30 bg-[var(--color-priority-high)]/10'
              : 'text-[var(--color-priority-medium)] border-[var(--color-priority-medium)]/30 bg-[var(--color-priority-medium)]/10'
          }`}>
            {mode === 'work' ? 'Работа' : 'Отдых'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] font-mono">
          <CheckCircle2 className="w-3 h-3 text-[var(--color-priority-medium)]" />
          <span className="tabular-nums">{completedSessions}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="font-mono text-xl font-medium tracking-tight text-[var(--color-text-primary)] tabular-nums">
          {formattedTime}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            className="px-2.5 py-1 rounded bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] text-xs font-medium flex items-center gap-1 transition-colors"
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isRunning ? 'Пауза' : 'Старт'}</span>
          </button>
          <button
            type="button"
            onClick={reset}
            title="Сбросить"
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={skip}
            title="Пропустить"
            className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <FastForward className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full bg-[var(--color-surface)] h-1 rounded-full overflow-hidden border border-[var(--color-border)]">
        <div
          className="h-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
