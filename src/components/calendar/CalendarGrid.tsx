import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '../../types';
import { 
  MONTH_NAMES_RU, WEEKDAYS_RU, getMonthMatrix, getWeekDays, toDateString 
} from '../../utils/dateUtils';
import { calculateDayWorkload } from '../../utils/workloadUtils';
import { CalendarDayCell } from './CalendarDayCell';
import { sound } from '../../utils/sound';

interface CalendarGridProps {
  tasks: Task[];
  customWeekends: number[];
  currentDate: Date;
  onNavigateDate: (newDate: Date) => void;
  onSelectDay: (dateStr: string) => void;
  onOpenFullDay: (dateStr: string) => void;
}

function formatTaskCount(count: number): string {
  if (count === 0) return 'нет активных задач сегодня';
  const rem10 = count % 10;
  const rem100 = count % 100;
  if (rem10 === 1 && rem100 !== 11) return `${count} задача сегодня`;
  if (rem10 >= 2 && rem10 <= 4 && (rem100 < 10 || rem100 >= 20)) return `${count} задачи сегодня`;
  return `${count} задач сегодня`;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  tasks,
  customWeekends,
  currentDate,
  onNavigateDate,
  onSelectDay,
  onOpenFullDay,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = toDateString(new Date());

  const todayRemainingCount = useMemo(() => {
    return tasks.filter(t => t.date === todayStr && t.status !== 'done').length;
  }, [tasks, todayStr]);

  const handlePrev = () => {
    sound.playClick();
    if (viewMode === 'month') {
      onNavigateDate(new Date(year, month - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      onNavigateDate(prevWeek);
    }
  };

  const handleNext = () => {
    sound.playClick();
    if (viewMode === 'month') {
      onNavigateDate(new Date(year, month + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      onNavigateDate(nextWeek);
    }
  };

  const handleToday = () => {
    sound.playClick();
    onNavigateDate(new Date());
  };

  // Keyboard arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, viewMode]);

  const monthCells = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const tasksByDate = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((acc, t) => {
      if (!acc[t.date]) acc[t.date] = [];
      acc[t.date].push(t);
      return acc;
    }, {});
  }, [tasks]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Header: Seamless within floating glass-panel */}
      <header className="px-6 py-4 border-b border-[var(--color-border)] bg-transparent flex items-center justify-between shrink-0 select-none">
        {/* Large Month Title + Quiet kicker */}
        <div className="flex items-baseline gap-3">
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[var(--color-text-primary)] tracking-tight">
            {MONTH_NAMES_RU[month]}
            <span className="font-sans text-lg text-[var(--color-text-secondary)] font-normal ml-2">
              {year}
            </span>
          </h2>
          <span className="text-xs text-[var(--color-text-muted)] font-normal">
            · {formatTaskCount(todayRemainingCount)}
          </span>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[var(--color-surface)]/60 rounded-xl p-1 border border-[var(--color-border)]">
            <button
              type="button"
              onClick={handlePrev}
              title="Предыдущий период (←)"
              className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors font-medium"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Следующий период (→)"
              className="p-1.5 hover:bg-[var(--color-surface-hover)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex bg-[var(--color-surface)]/60 p-1 rounded-xl border border-[var(--color-border)] text-xs">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setViewMode('month');
              }}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'month'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Месяц
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setViewMode('week');
              }}
              className={`px-3 py-1 rounded-lg transition-colors ${
                viewMode === 'week'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Неделя
            </button>
          </div>
        </div>
      </header>

      {/* Weekday Names Bar (Clean & translucent) */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-transparent text-xs font-medium text-[var(--color-text-muted)] select-none shrink-0">
        {WEEKDAYS_RU.map(w => {
          const isWeekend = customWeekends.includes(w.index);
          return (
            <div
              key={w.index}
              className={`py-2.5 text-center border-r border-[var(--color-border)]/50 last:border-r-0 ${
                isWeekend ? 'text-[var(--color-priority-critical)]' : ''
              }`}
            >
              <span>{w.short}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar Grid: Transparent cells letting glass-panel backdrop-blur show */}
      {viewMode === 'month' ? (
        <div className="flex-1 grid grid-cols-7 overflow-y-auto bg-transparent">
          {monthCells.map(cell => {
            const dateTasks = tasksByDate[cell.dateStr] || [];
            const isWeekend = customWeekends.includes(cell.dayOfWeek);
            const workload = calculateDayWorkload(tasks, cell.dateStr, todayStr);

            return (
              <CalendarDayCell
                key={cell.dateStr}
                dayNumber={cell.dayNumber}
                dateStr={cell.dateStr}
                isCurrentMonth={cell.isCurrentMonth}
                isToday={cell.isToday}
                isWeekend={isWeekend}
                workload={workload}
                tasks={dateTasks}
                onSelectDay={onSelectDay}
                onOpenFullDay={onOpenFullDay}
              />
            );
          })}
        </div>
      ) : (
        /* Week View */
        <div className="flex-1 grid grid-cols-7 overflow-y-auto bg-transparent">
          {weekDays.map(w => {
            const dateTasks = tasksByDate[w.dateStr] || [];
            const isWeekend = customWeekends.includes(w.dayOfWeek);
            const workload = calculateDayWorkload(tasks, w.dateStr, todayStr);

            return (
              <CalendarDayCell
                key={w.dateStr}
                dayNumber={w.dayNumber}
                dateStr={w.dateStr}
                isCurrentMonth={true}
                isToday={w.isToday}
                isWeekend={isWeekend}
                workload={workload}
                tasks={dateTasks}
                onSelectDay={onSelectDay}
                onOpenFullDay={onOpenFullDay}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
