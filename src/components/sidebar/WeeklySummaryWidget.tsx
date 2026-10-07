import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Clock, CalendarDays } from 'lucide-react';
import { Task } from '../../types';
import { getWeekDays } from '../../utils/dateUtils';
import { getTodayDate } from '../../utils/date';
import { sound } from '../../utils/sound';
import { D3CircularProgress } from './D3CircularProgress';
import { WeeklyCelebration, getMotivation } from './WeeklyCelebration';

interface WeeklySummaryWidgetProps {
  tasks: Task[];
  onSelectDay?: (dateStr: string) => void;
}

export const WeeklySummaryWidget: React.FC<WeeklySummaryWidgetProps> = ({
  tasks,
  onSelectDay,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Compute current week information
  const todayStr = getTodayDate();
  const weekDays = useMemo(() => getWeekDays(new Date()), [todayStr]);

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

  const isAllDone = totalCount > 0 && completedCount === totalCount;

  const close = () => {
    sound.playModalClose();
    setIsOpen(false);
  };

  // Закрытие по Escape + фокус на кнопке закрытия
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playModalClose();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Звук победы при открытии окна, если всё выполнено
  useEffect(() => {
    if (isOpen && isAllDone) sound.playSuccess();
  }, [isOpen, isAllDone]);

  const handleToggle = () => {
    if (!isOpen) sound.playModalOpen();
    else sound.playModalClose();
    setIsOpen(prev => !prev);
  };

  const firstDay = weekDays[0];
  const lastDay = weekDays[weekDays.length - 1];
  const dateRangeLabel = `${firstDay.dayNumber} ${firstDay.monthName} — ${lastDay.dayNumber} ${lastDay.monthName}`;

  return (
    <div className="relative flex flex-col items-center">
      {/* Кнопка в сайдбаре */}
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="dialog"
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
          size={40}
          strokeWidth={3.8}
          showText={true}
        />
      </button>

      {/* Окно по центру экрана. Через portal, иначе backdrop-filter сайдбара
          ломает и позиционирование (fixed), и размытие фона. */}
      {isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Итоги недели"
            className="fixed inset-0 z-50 glass-modal-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={close}
          >
            {/* Непрозрачная подложка + лёгкий тон поверх, чтобы календарь не просвечивал */}
            <div
              className="w-full max-w-[440px] max-h-[88vh] overflow-y-auto rounded-3xl bg-[var(--color-app-bg)] border border-[var(--color-border-glass)] shadow-2xl animate-in zoom-in-95 duration-200 text-[var(--color-text-primary)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[var(--color-surface-elevated)] p-6 space-y-5">
                {/* Шапка */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Итоги недели</span>
                    </div>
                    <div className="font-serif text-xl mt-1">{dateRangeLabel}</div>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={close}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                    title="Закрыть"
                    aria-label="Закрыть"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Кольцо + цифры */}
                <div className="flex items-center gap-6">
                  <div className="shrink-0 flex items-center justify-center p-2 rounded-2xl bg-[var(--color-surface-solid)]/40 border border-[var(--color-border)]">
                    <D3CircularProgress
                      completed={completedCount}
                      pending={pendingCount}
                      total={totalCount}
                      size={104}
                      strokeWidth={8}
                      showText={true}
                    />
                  </div>

                  <div className="flex-1 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-accent)]" />
                        Выполнено
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-[var(--color-accent)]">
                        {completedCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                        В ожидании
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-[var(--color-text-muted)]">
                        {pendingCount}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span>Всего задач</span>
                      <span className="font-mono tabular-nums">{totalCount}</span>
                    </div>
                  </div>
                </div>

                {/* Награда или мотивация */}
                {isAllDone ? (
                  <WeeklyCelebration />
                ) : (
                  <p className="text-sm text-center text-[var(--color-text-secondary)]">
                    {getMotivation(percent, totalCount)}
                  </p>
                )}

                {/* Распределение по дням */}
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--color-text-muted)] mb-2">
                    Распределение по дням
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
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
                          className={`flex flex-col items-center py-2 px-0.5 rounded-xl text-center transition-all ${
                            isSelectedToday
                              ? 'bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]'
                              : 'hover:bg-[var(--color-surface-hover)]'
                          }`}
                        >
                          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                            {day.weekdayShort}
                          </span>
                          <span
                            className={`text-sm font-mono tabular-nums font-semibold mt-0.5 ${
                              isSelectedToday
                                ? 'text-[var(--color-accent)]'
                                : 'text-[var(--color-text-primary)]'
                            }`}
                          >
                            {day.dayNumber}
                          </span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
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
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
