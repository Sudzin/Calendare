import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatHumanDate, parseDateString, toDateString } from '../../utils/dateUtils';

interface DayHeaderProps {
  dateStr: string;
  totalCount: number;
  completedCount: number;
  onChangeDate: (newDateStr: string) => void;
  onClose: () => void;
}

export const DayHeader: React.FC<DayHeaderProps> = ({
  dateStr,
  totalCount,
  completedCount,
  onChangeDate,
  onClose,
}) => {
  const handlePrevDay = () => {
    const d = parseDateString(dateStr);
    d.setDate(d.getDate() - 1);
    onChangeDate(toDateString(d));
  };

  const handleNextDay = () => {
    const d = parseDateString(dateStr);
    d.setDate(d.getDate() + 1);
    onChangeDate(toDateString(d));
  };

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
      {/* Date stepper & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-[var(--color-app-bg)] rounded-lg p-0.5 border border-[var(--color-border)]">
          <button
            type="button"
            onClick={handlePrevDay}
            title="Предыдущий день"
            className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeDate(toDateString(new Date()))}
            className="px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded transition-colors"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            title="Следующий день"
            className="p-1 hover:bg-[var(--color-surface-hover)] rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <h2 className="font-serif text-base font-medium text-[var(--color-text-primary)]">
          {formatHumanDate(dateStr)}
        </h2>
      </div>

      {/* Progress & Close */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <span className="font-mono tabular-nums">
            {completedCount}/{totalCount} ({progressPercent}%)
          </span>
          <div className="w-14 bg-[var(--color-app-bg)] h-1 rounded-full overflow-hidden border border-[var(--color-border)]">
            <div
              className="bg-[var(--color-accent)] h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Закрыть (Esc)"
          className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
