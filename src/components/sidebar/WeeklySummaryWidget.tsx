import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, CheckCircle2, Clock, CalendarDays } from 'lucide-react';
import { Task } from '../../types';
import { getWeekDays, toDateString } from '../../utils/dateUtils';
import { sound } from '../../utils/sound';
import { D3CircularProgress } from './D3CircularProgress';

interface WeeklySummaryWidgetProps {
  tasks: Task[];
  onSelectDay?: (dateStr: string) => void;
}

export const WeeklySummaryWidget: React.FC<WeeklySummaryWidgetProps> = ({
  tasks,
  onSelectDay,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Compute current week information
  const todayStr = useMemo(() => toDateString(new Date()), []);
  const weekDays = useMemo(() => getWeekDays(new Date()), []);

  const weekDateSet = useMemo(() => new Set(weekDays.map(d => d.dateStr)), [weekDays]);

  // Tasks belonging to the current week
  const weekTasks = useMemo(() => {
    return tasks.filter(t => weekDateSet.has(t.date));
  }, [tasks, weekDateSet]);

  const completedCount = useMemo(() => {
    return weekTasks.filter(t => t.status === 'done').length;
  }, [weekTasks]);

  const pendingCount = useMemo(() => {
    return weekTasks.filter(t => t.status !== 'done').length;
  }, [weekTasks]);

  const totalCount = completedCount + pendingCount;
  const ratio = totalCount > 0 ? completedCount / totalCount : 0;
  const percent = Math.round(ratio * 100);

  // Day breakdown
  const dailyStats = useMemo(() => {
    return weekDays.map(day => {
      const dayTasks = weekTasks.filter(t => t.date === day.dateStr);
      const dayCompleted = dayTasks.filter(t => t.status === 'done').length;
      const dayPending = dayTasks.filter(t => t.status !== 'done').length;
      return {
        ...day,
        total: dayTasks.length,
        completed: dayCompleted,
        pending: dayPending,
      };
    });
  }, [weekDays, weekTasks]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) sound.playModalOpen();
    else sound.playTap();
    setIsOpen(prev => !prev);
  };

  const firstDay = weekDays[0];
  const lastDay = weekDays[weekDays.length - 1];
  const dateRangeLabel = `${firstDay.dayNumber} ${firstDay.monthName} — ${lastDay.dayNumber} ${lastDay.monthName}`;

  return (
    <div ref={containerRef} className="relative flex flex-col items-center">
      {/* Sidebar Chart Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label="Итоги текущей недели"
        title={`Итоги недели: ${completedCount} выполнено из ${totalCount} (${percent}%)`}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 relative group ${
          isOpen
            ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-surface-hover)]'
            : 'hover:bg-[var(--color-surface-hover)]'
        }`}
      >
        <D3CircularProgress
          completed={completedCount}
          pending={pendingCount}
          total={totalCount}
          size={38}
          strokeWidth={3.5}
          showText={true}
        />
      </button>

      {/* Flyout Weekly Summary Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Сводка недели"
          className="absolute left-[68px] top-1/2 -translate-y-1/2 w-72 glass-panel rounded-2xl p-4 shadow-2xl z-50 text-[var(--color-text-primary)] animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Итоги недели</span>
              </div>
              <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                {dateRangeLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 rounded-md transition-colors"
              title="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Center: D3 Circular Progress Visualization */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="shrink-0 flex items-center justify-center p-1 rounded-xl bg-[var(--color-surface-solid)]/40 border border-[var(--color-border)]">
              <D3CircularProgress
                completed={completedCount}
                pending={pendingCount}
                total={totalCount}
                size={76}
                strokeWidth={6}
                showText={true}
              />
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  Выполнено
                </span>
                <span className="font-mono font-semibold tabular-nums text-[var(--color-accent)]">
                  {completedCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  В ожидании
                </span>
                <span className="font-mono font-semibold tabular-nums text-[var(--color-text-muted)]">
                  {pendingCount}
                </span>
              </div>

              <div className="pt-1.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                <span>Всего задач</span>
                <span className="font-mono tabular-nums">{totalCount}</span>
              </div>
            </div>
          </div>

          {/* Daily Distribution for the 7 Days of the Week */}
          <div className="pt-3 border-t border-[var(--color-border)]">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-muted)] mb-2">
              Распределение по дням
            </div>

            <div className="grid grid-cols-7 gap-1">
              {dailyStats.map(day => {
                const isSelectedToday = day.dateStr === todayStr;
                const hasTasks = day.total > 0;
                const allDone = hasTasks && day.completed === day.total;

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => {
                      if (onSelectDay) {
                        onSelectDay(day.dateStr);
                        setIsOpen(false);
                      }
                    }}
                    title={`${day.weekdayShort}, ${day.dayNumber}: ${day.completed}/${day.total} выполнено`}
                    className={`flex flex-col items-center py-1.5 px-0.5 rounded-lg text-center transition-all ${
                      isSelectedToday
                        ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]'
                        : 'hover:bg-[var(--color-surface-hover)]'
                    }`}
                  >
                    <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
                      {day.weekdayShort}
                    </span>
                    <span
                      className={`text-[11px] font-mono tabular-nums font-semibold mt-0.5 ${
                        isSelectedToday
                          ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-text-primary)]'
                      }`}
                    >
                      {day.dayNumber}
                    </span>

                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        !hasTasks
                          ? 'bg-transparent'
                          : allDone
                          ? 'bg-[var(--color-accent)]'
                          : 'bg-[var(--color-priority-high)]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
